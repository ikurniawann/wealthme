import { createHash, randomBytes } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConfigService } from "@nestjs/config";
import { Prisma, Role } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TransactionalMailService } from "../mail/transactional-mail.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { Env } from "../config/env";

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

const escapeHtml = (raw: string) =>
  raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function withCode(message: string, code: string) {
  return { message, code };
}

/**
 * EPIC-031 — an email address for a Master-created member, with consent.
 *
 * The Master may type an address, but it is only a *pending* email until the
 * person who owns that mailbox clicks the link we send there. Until then it
 * cannot be used to sign in or for "Lupa Password", so a Master can never
 * bind someone else's address to an account whose password they know. The
 * request never reveals whether the address already has an account (no
 * enumeration); that is only checked when the mailbox owner confirms.
 */
@Injectable()
export class MemberEmailService {
  private readonly logger = new Logger(MemberEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: TransactionalMailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Master sets (or clears, with null) a pending email for a member they created. */
  async setForMember(
    familyGroupId: string,
    memberId: string,
    requesterId: string,
    email: string | null,
  ): Promise<{ pendingEmail: string | null }> {
    await this.assertOwner(familyGroupId, requesterId);
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, familyGroupId },
      select: {
        userId: true,
        user: { select: { managedByFamilyGroupId: true } },
      },
    });
    if (!member) throw new NotFoundException("Member not found");
    if (member.user.managedByFamilyGroupId !== familyGroupId) {
      throw new ForbiddenException(
        withCode(
          "Akun ini tidak dibuat oleh Master keluarga ini",
          "NOT_MANAGED_BY_FAMILY",
        ),
      );
    }
    if (email === null) {
      await this.prisma.user.update({
        where: { id: member.userId },
        data: {
          pendingEmail: null,
          pendingEmailTokenHash: null,
          pendingEmailExpiresAt: null,
        },
      });
      return { pendingEmail: null };
    }
    await this.startConfirmation(member.userId, email);
    return { pendingEmail: email.trim().toLowerCase() };
  }

  /**
   * Stores the address as pending with a fresh single-use token and mails the
   * confirmation link. Delivery failures are logged, not thrown: the member
   * and the pending address are saved either way, and the Master can resend.
   */
  async startConfirmation(userId: string, rawEmail: string): Promise<void> {
    const email = rawEmail.trim().toLowerCase();
    const token = randomBytes(32).toString("base64url");
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        pendingEmail: email,
        pendingEmailTokenHash: hashToken(token),
        pendingEmailExpiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
      select: { name: true, username: true },
    });
    const origin = this.config.get("WEB_ORIGIN", { infer: true });
    const link = `${origin}/konfirmasi-email?token=${encodeURIComponent(token)}`;
    const login = user.username ? ` (login: ${user.username})` : "";
    try {
      await this.mail.send({
        to: email,
        toName: user.name,
        subject: "Konfirmasi email akun WealthMe",
        text:
          `Halo ${user.name},\n\n` +
          `Master keluarga Anda menambahkan email ini ke akun WealthMe Anda${login}.\n` +
          `Klik link berikut untuk mengonfirmasi, lalu Anda bisa masuk dengan email ini dan memakai Lupa Password:\n${link}\n\n` +
          `Link berlaku 7 hari. Bukan Anda? Abaikan email ini — email tidak akan terhubung ke akun mana pun.`,
        html:
          `<p>Halo ${escapeHtml(user.name)},</p>` +
          `<p>Master keluarga Anda menambahkan email ini ke akun WealthMe Anda${escapeHtml(login)}.</p>` +
          `<p><a href="${escapeHtml(link)}">Konfirmasi email saya</a></p>` +
          `<p>Setelah dikonfirmasi, Anda bisa masuk dengan email ini dan memakai Lupa Password. Link berlaku 7 hari.</p>` +
          `<p>Bukan Anda? Abaikan email ini — email tidak akan terhubung ke akun mana pun.</p>`,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send email confirmation for user ${userId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /** Public: the mailbox owner clicked the link. */
  async confirm(token: string): Promise<{ email: string }> {
    const user = await this.prisma.user.findUnique({
      where: { pendingEmailTokenHash: hashToken(token) },
      select: { id: true, pendingEmail: true, pendingEmailExpiresAt: true },
    });
    if (
      !user?.pendingEmail ||
      !user.pendingEmailExpiresAt ||
      user.pendingEmailExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException(
        withCode(
          "Link konfirmasi tidak valid atau sudah kedaluwarsa. Minta Master mengirim ulang.",
          "INVALID_EMAIL_TOKEN",
        ),
      );
    }
    const taken = await this.prisma.user.findUnique({
      where: { email: user.pendingEmail },
      select: { id: true },
    });
    if (taken && taken.id !== user.id) {
      throw new ConflictException(
        withCode(
          "Email ini sudah dipakai akun WealthMe lain. Minta Master memakai email lain.",
          "EMAIL_TAKEN",
        ),
      );
    }
    try {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          email: user.pendingEmail,
          emailVerified: true,
          pendingEmail: null,
          pendingEmailTokenHash: null,
          pendingEmailExpiresAt: null,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictException(
          withCode(
            "Email ini sudah dipakai akun WealthMe lain.",
            "EMAIL_TAKEN",
          ),
        );
      }
      throw err;
    }
    return { email: user.pendingEmail };
  }

  private async assertOwner(familyGroupId: string, userId: string) {
    const member = await this.prisma.member.findUnique({
      where: { userId_familyGroupId: { userId, familyGroupId } },
      select: { role: true },
    });
    if (!member || member.role !== Role.owner) {
      throw new ForbiddenException("Only owners can perform this action");
    }
  }
}
