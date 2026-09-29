import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConfigService } from "@nestjs/config";
import { MemberRelationship, Prisma, Role } from "@prisma/client";
import {
  FAMILY_HANDLE_PATTERN,
  buildFamilyLoginId,
  slugifyHandleBase,
} from "@wealthme/contracts";
import * as argon2 from "argon2";

import { parsePermissions } from "../access/member-access.util";
import {
  NOTIFICATION_SENDER_PORT,
  type NotificationSenderPort,
} from "../notifications/notification-sender.port";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { RedisService } from "../redis/redis.service";

import type { Env } from "../config/env";
import type { CreateDependantMemberDto } from "./dto/create-dependant-member.dto";
import type { CreateFamilyGroupDto } from "./dto/create-family-group.dto";
import type { CreateInvitationDto } from "./dto/create-invitation.dto";
import type { DependantMemberResponseDto } from "./dto/dependant-member-response.dto";
import type { FamilyGroupResponseDto } from "./dto/family-group-response.dto";
import type { FamilyReligionResponseDto } from "./dto/family-religion-response.dto";
import type { GoldPriceResponseDto } from "./dto/gold-price-response.dto";
import type { InvitationResponseDto } from "./dto/invitation-response.dto";
import type { MemberResponseDto } from "./dto/member-response.dto";
import type { ResetMemberPasswordDto } from "./dto/reset-member-password.dto";
import type { UpdateFamilyReligionDto } from "./dto/update-family-religion.dto";
import type { UpdateGoldPriceDto } from "./dto/update-gold-price.dto";
import type { UpdateMemberRoleDto } from "./dto/update-member-role.dto";

const INVITATION_TTL_DAYS = 7;

// EPIC-023 D1/D6 (US-FAM-12, US-AUTH-9) — a head-created dependant/
// operational member has no real email; `User.email` is NOT NULL + unique
// at the Prisma level (see schema.prisma), so a synthetic placeholder is
// required. `.invalid` is the IANA-reserved TLD set aside exactly for
// addresses that must never resolve or receive mail (RFC 2606 §2) — no DNS
// registrar can ever issue it, so this can never collide with, or be
// mistaken for, a real signup's address. The UUID component makes a
// collision with another synthetic row astronomically unlikely on top of
// that (2^122 possibilities) — and even if it somehow happened, `User.email`
// is `@unique`, so the transaction would simply fail closed (P2002) rather
// than silently overwrite another account.
const SYNTHETIC_EMAIL_DOMAIN = "members.internal.wealthme.invalid";

/**
 * A "managed login" is an account THIS family's Master created from /iam
 * (EPIC-031: `User.managedByFamilyGroupId`, backfilled for the synthetic
 * `.invalid` logins created before it). Only these can have their password
 * set by that Master — with or without a real email. An account the person
 * registered themselves owns its own credential and recovers it by email.
 */
function isManagedLogin(
  user: { managedByFamilyGroupId: string | null },
  familyGroupId: string,
): boolean {
  return user.managedByFamilyGroupId === familyGroupId;
}

const MEMBER_USER_SELECT = {
  name: true,
  email: true,
  username: true,
  managedByFamilyGroupId: true,
  pendingEmail: true,
} as const satisfies Prisma.UserSelect;

function withCode(
  message: string,
  code: string,
): { message: string; code: string } {
  return { message, code };
}

function initialsFromName(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

@Injectable()
export class FamilyGroupsService {
  private readonly logger = new Logger(FamilyGroupsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_SENDER_PORT)
    private readonly notificationSender: NotificationSenderPort,
    private readonly config: ConfigService<Env, true>,
    private readonly redis: RedisService,
  ) {}

  async findMine(userId: string): Promise<FamilyGroupResponseDto[]> {
    // EPIC-024 A3 (Evidence #1) — `createdAt: "asc"` (oldest membership
    // first) is the canonical rule; `apps/web/src/lib/auth.ts` and
    // `apps/api/src/auth/auth.service.ts` were unified to match this same
    // ordering rather than the reverse.
    const memberships = await this.prisma.member.findMany({
      where: { userId },
      include: {
        familyGroup: {
          include: {
            // EPIC-027 A7 — nested aggregate; the soft-delete extension does not
            // reach it, so removed members would still be counted.
            _count: { select: { members: { where: { deletedAt: null } } } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return memberships.map((m) => ({
      id: m.familyGroup.id,
      name: m.familyGroup.name,
      memberCount: m.familyGroup._count.members,
      myRole: m.role,
      createdAt: m.familyGroup.createdAt.toISOString(),
    }));
  }

  async create(
    userId: string,
    dto: CreateFamilyGroupDto,
  ): Promise<FamilyGroupResponseDto> {
    const group = await this.prisma.familyGroup.create({
      data: {
        name: dto.name,
        members: {
          create: { userId, role: Role.owner },
        },
      },
      include: {
        // EPIC-027 A7 — nested aggregate; the soft-delete extension does not
        // reach it, so removed members would still be counted.
        _count: { select: { members: { where: { deletedAt: null } } } },
      },
    });

    return {
      id: group.id,
      name: group.name,
      memberCount: group._count.members,
      myRole: Role.owner,
      createdAt: group.createdAt.toISOString(),
    };
  }

  async listMembers(
    familyGroupId: string,
    requesterId: string,
  ): Promise<MemberResponseDto[]> {
    await this.assertMember(familyGroupId, requesterId);
    const members = await this.prisma.member.findMany({
      where: { familyGroupId },
      include: {
        user: { select: MEMBER_USER_SELECT },
        accessRole: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      familyGroupId: m.familyGroupId,
      role: m.role,
      relationship: m.relationship,
      name: m.user.name,
      email: m.user.email,
      username: m.user.username,
      managedLogin: isManagedLogin(m.user, m.familyGroupId),
      pendingEmail: m.user.pendingEmail,
      accessRoleId: m.accessRoleId,
      accessRoleName: m.accessRole?.name ?? null,
      accessOverrides: parsePermissions(m.accessOverrides),
      createdAt: m.createdAt.toISOString(),
      largeTxnThreshold: m.largeTxnThreshold?.toString() ?? null,
    }));
  }

  async updateMemberRole(
    familyGroupId: string,
    memberId: string,
    requesterId: string,
    dto: UpdateMemberRoleDto,
  ): Promise<MemberResponseDto> {
    await this.assertOwner(familyGroupId, requesterId);

    const member = await this.prisma.member.findFirst({
      where: { id: memberId, familyGroupId },
      include: { user: { select: MEMBER_USER_SELECT } },
    });
    if (!member) throw new NotFoundException("Member not found");

    // EPIC-024 A1/review-fix (D1) — this endpoint can also set
    // `relationship: istri` on an EXISTING member (unlike
    // `createDependantMember`, `role: owner` is already excluded from
    // `ASSIGNABLE_ROLES`, so this path can't mint a second co-master via
    // `role` — but it CAN still produce a second `relationship: istri`
    // row, which violates the same max-1-istri invariant). Guard it with
    // the identical lock-then-recheck pattern used in
    // `createDependantMember`, only when the target member does not
    // already carry `relationship: istri` (re-saving the current istri's
    // own row must stay a no-op, not a false conflict against herself).
    const isSettingNewIstri =
      dto.relationship === MemberRelationship.istri &&
      member.relationship !== MemberRelationship.istri;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (isSettingNewIstri) {
        // NOTE: raw SQL table name is "family_groups", the `@@map`'d
        // Postgres table for the `FamilyGroup` model (schema.prisma) — not
        // the Prisma model name itself.
        await tx.$queryRaw`SELECT id FROM "family_groups" WHERE id = ${familyGroupId} FOR UPDATE`;
        const existingIstri = await tx.member.findFirst({
          where: {
            familyGroupId,
            relationship: MemberRelationship.istri,
            id: { not: memberId },
          },
          select: { id: true },
        });
        if (existingIstri) {
          throw new ConflictException(
            withCode(
              "Keluarga ini sudah memiliki istri (co-master)",
              "MAX_ONE_ISTRI",
            ),
          );
        }
      }

      return tx.member.update({
        where: { id: memberId },
        data: {
          role: dto.role,
          // EPIC-023 Task C (D1) — `relationship` is optional on this DTO:
          // `undefined` leaves it unchanged, `null` explicitly clears it,
          // any enum value sets/replaces it. Kinship is not authority — this
          // never constrains which `role` above may be paired with it.
          ...(dto.relationship !== undefined && {
            relationship: dto.relationship,
          }),
          // EPIC-023 Task D (D3/D9) — same undefined/null/value contract as
          // relationship above: undefined leaves it unchanged, null clears
          // the gate, a number sets/replaces it.
          ...(dto.largeTxnThreshold !== undefined && {
            largeTxnThreshold:
              dto.largeTxnThreshold === null
                ? null
                : BigInt(dto.largeTxnThreshold),
          }),
        },
        include: { user: { select: MEMBER_USER_SELECT } },
      });
    });

    return {
      id: updated.id,
      userId: updated.userId,
      familyGroupId: updated.familyGroupId,
      role: updated.role,
      relationship: updated.relationship,
      name: updated.user.name,
      email: updated.user.email,
      username: updated.user.username,
      managedLogin: isManagedLogin(updated.user, updated.familyGroupId),
      pendingEmail: updated.user.pendingEmail,
      createdAt: updated.createdAt.toISOString(),
      largeTxnThreshold: updated.largeTxnThreshold?.toString() ?? null,
    };
  }

  async removeMember(
    familyGroupId: string,
    memberId: string,
    requesterId: string,
  ): Promise<void> {
    await this.assertOwner(familyGroupId, requesterId);

    const member = await this.prisma.member.findFirst({
      where: { id: memberId, familyGroupId },
    });
    if (!member) throw new NotFoundException("Member not found");

    if (member.role === Role.owner) {
      const ownerCount = await this.prisma.member.count({
        where: { familyGroupId, role: Role.owner },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException(
          "Cannot remove the last owner of a family group",
        );
      }
    }

    // EPIC-019 Task A — a removed member is no longer a Member of this
    // family group, so any account still pointing at them via ownerUserId
    // would otherwise dangle (the user row itself may still exist — they can
    // belong to other family groups). Revert those accounts to
    // family-shared in the SAME transaction as the member removal.
    // EPIC-027 A7 (D4) — soft delete, not `member.delete`. The row survives
    // with `deletedAt` set: every read path already ignores it (the
    // member-soft-delete Prisma extension), the member's recorded transactions
    // keep their author, and the head can restore them from /iam. Hard-deleting
    // here while the User + credential rows lived on is exactly what let a
    // removed child keep signing in.
    await this.prisma.$transaction([
      this.prisma.account.updateMany({
        where: { familyGroupId, ownerUserId: member.userId },
        data: { ownerUserId: null },
      }),
      this.prisma.member.update({
        where: { id: memberId },
        data: { deletedAt: new Date() },
      }),
    ]);

    await this.revokeSessions(member.userId);
  }

  /**
   * A Master sets a new password for a head-created (managed) login — the
   * only recovery path those members have, since their synthetic email can
   * never receive a "Lupa Password" link. Accounts with a real email are
   * refused: they own their credential, and letting one owner silently take
   * over another's email login would be an account-takeover primitive.
   *
   * The password is TEMPORARY: mustChangePassword is set, so the member's
   * next login is sent to /ubah-password-wajib (ForcePasswordChangeGuard)
   * and must pick their own — the Master never knows the final password.
   * Every live session of the member is revoked so the old password's
   * sessions cannot outlive the change.
   */
  async resetMemberPassword(
    familyGroupId: string,
    memberId: string,
    requesterId: string,
    dto: ResetMemberPasswordDto,
  ): Promise<void> {
    await this.assertOwner(familyGroupId, requesterId);

    const member = await this.prisma.member.findFirst({
      where: { id: memberId, familyGroupId },
      include: { user: { select: { managedByFamilyGroupId: true } } },
    });
    if (!member) throw new NotFoundException("Member not found");

    if (member.userId === requesterId) {
      throw new BadRequestException(
        withCode(
          "Ganti password Anda sendiri lewat menu Akun → Keamanan",
          "CANNOT_RESET_OWN_PASSWORD",
        ),
      );
    }
    if (!isManagedLogin(member.user, familyGroupId)) {
      throw new ForbiddenException(
        withCode(
          "Akun ini tidak dibuat oleh Master keluarga ini — minta dia memakai Lupa Password",
          "MEMBER_MANAGES_OWN_PASSWORD",
        ),
      );
    }

    const passwordHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
    });

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.baAccount.updateMany({
        where: { userId: member.userId, providerId: "credential" },
        data: { password: passwordHash },
      });
      if (count === 0) {
        throw new NotFoundException(
          withCode(
            "Anggota ini tidak punya login password",
            "NO_CREDENTIAL_LOGIN",
          ),
        );
      }
      await tx.user.update({
        where: { id: member.userId },
        data: { mustChangePassword: true },
      });
    });

    await this.revokeSessions(member.userId);
  }

  /**
   * EPIC-027 A9 (D7) — a removed member may be holding a live session right
   * now. Soft-deleting the membership stops the NEXT request from resolving a
   * family group, but an already-issued access token keeps working until it
   * expires, so tear the credentials down explicitly:
   *
   *  - the Redis refresh key, so no new access token can be minted (same key
   *    shape `logout()` deletes);
   *  - every better-auth session row for that user, which is what the web app
   *    actually authenticates with.
   *
   * Deliberately best-effort: the member IS already removed at this point, and
   * throwing here would turn a completed removal into a 500 that invites the
   * operator to retry an operation that already succeeded. A revocation
   * failure is logged for follow-up instead.
   */
  private async revokeSessions(userId: string): Promise<void> {
    try {
      await this.redis.del(`refresh:${userId}`);
      await this.prisma.baSession.deleteMany({ where: { userId } });
    } catch (err: unknown) {
      this.logger.error(
        `Failed to revoke sessions for user ${userId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * EPIC-027 A8 (D5) — undo a removal. Restoring is the only way to bring a
   * removed member back: their `User` row still holds the username, so
   * re-creating them under the same username would 409, and the
   * `@@unique([userId, familyGroupId])` constraint counts the soft-deleted row.
   */
  async restoreMember(
    familyGroupId: string,
    memberId: string,
    requesterId: string,
  ): Promise<void> {
    await this.assertOwner(familyGroupId, requesterId);

    // The extension hides removed rows from every read, so ask for one
    // explicitly — `deletedAt: { not: null }` is the documented opt-out.
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, familyGroupId, deletedAt: { not: null } },
    });
    if (!member) throw new NotFoundException("Removed member not found");

    await this.prisma.member.update({
      where: { id: memberId },
      data: { deletedAt: null },
    });
  }

  /** EPIC-027 A8 — the "Anggota Nonaktif" panel on /iam. */
  async listRemovedMembers(
    familyGroupId: string,
    requesterId: string,
  ): Promise<MemberResponseDto[]> {
    await this.assertOwner(familyGroupId, requesterId);

    const members = await this.prisma.member.findMany({
      where: { familyGroupId, deletedAt: { not: null } },
      include: { user: { select: MEMBER_USER_SELECT } },
      orderBy: { deletedAt: "desc" },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      familyGroupId: m.familyGroupId,
      role: m.role,
      relationship: m.relationship,
      name: m.user.name,
      email: m.user.email,
      username: m.user.username,
      managedLogin: isManagedLogin(m.user, m.familyGroupId),
      pendingEmail: m.user.pendingEmail,
      createdAt: m.createdAt.toISOString(),
      largeTxnThreshold: m.largeTxnThreshold?.toString() ?? null,
    }));
  }

  async createInvitation(
    familyGroupId: string,
    requesterId: string,
    dto: CreateInvitationDto,
  ): Promise<InvitationResponseDto> {
    await this.assertOwner(familyGroupId, requesterId);

    const group = await this.prisma.familyGroup.findUnique({
      where: { id: familyGroupId },
      select: { name: true },
    });
    if (!group) throw new NotFoundException("Family group not found");

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_TTL_DAYS);

    const invitation = await this.prisma.invitation.create({
      data: {
        familyGroupId,
        email: dto.email,
        role: dto.role ?? Role.member,
        // EPIC-023 Task C (D1/D6) — purely descriptive; carried through to
        // the Member row on acceptance. Spouse/bookkeeper still arrive by
        // email (D6), so `role` above stays the head's explicit choice —
        // relationship never auto-derives a role on this endpoint.
        relationship: dto.relationship ?? null,
        expiresAt,
      },
    });

    // Fire-and-forget — a delivery failure must never fail the invite itself
    // (mirrors the budget-alert email pattern in transactions.service.ts).
    void this.sendInvitationEmail(
      invitation.email,
      invitation.token,
      group.name,
      invitation.expiresAt,
    );

    return {
      id: invitation.id,
      token: invitation.token,
      familyGroupId: invitation.familyGroupId,
      familyGroupName: group.name,
      email: invitation.email,
      role: invitation.role,
      relationship: invitation.relationship,
      expiresAt: invitation.expiresAt.toISOString(),
      usedAt: null,
      createdAt: invitation.createdAt.toISOString(),
    };
  }

  /**
   * Emails the invitation link (`WEB_ORIGIN/join/:token`, matching the
   * frontend's accept flow at `apps/web/src/app/join/[token]/page.tsx`).
   * Errors are logged and swallowed — see the fire-and-forget call site.
   */
  private async sendInvitationEmail(
    toEmail: string,
    token: string,
    familyGroupName: string,
    expiresAt: Date,
  ): Promise<void> {
    try {
      const webOrigin = this.config.get("WEB_ORIGIN", { infer: true });
      const joinUrl = `${webOrigin}/join/${token}`;
      const safeGroupName = escapeHtml(familyGroupName);
      const subject = `Undangan bergabung ke ${safeGroupName} di WealthMe`;
      const htmlBody = `<p>Anda diundang untuk bergabung dengan <strong>${safeGroupName}</strong> di WealthMe.</p>
<p>Klik tautan berikut untuk menerima undangan:</p>
<p><a href="${joinUrl}">${joinUrl}</a></p>
<p>Tautan ini berlaku hingga ${expiresAt.toLocaleDateString("id-ID")}.</p>`;

      await this.notificationSender.sendEmail(
        toEmail,
        toEmail,
        subject,
        htmlBody,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Invitation email skipped: ${msg}`);
    }
  }

  async getInvitationByToken(token: string): Promise<InvitationResponseDto> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: { familyGroup: { select: { name: true } } },
    });
    if (!invitation) throw new NotFoundException("Invitation not found");
    if (invitation.expiresAt < new Date()) {
      throw new GoneException("Invitation has expired");
    }
    if (invitation.usedAt) {
      throw new BadRequestException("Invitation has already been used");
    }

    // usedAt is null here (verified above)
    return {
      id: invitation.id,
      token: invitation.token,
      familyGroupId: invitation.familyGroupId,
      familyGroupName: invitation.familyGroup.name,
      email: invitation.email,
      role: invitation.role,
      relationship: invitation.relationship,
      expiresAt: invitation.expiresAt.toISOString(),
      usedAt: null,
      createdAt: invitation.createdAt.toISOString(),
    };
  }

  async acceptInvitation(
    token: string,
    userId: string,
    callerEmail: string,
  ): Promise<MemberResponseDto> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: { familyGroup: { select: { name: true } } },
    });
    if (!invitation) throw new NotFoundException("Invitation not found");
    if (invitation.expiresAt < new Date()) {
      throw new GoneException("Invitation has expired");
    }
    if (invitation.usedAt) {
      throw new BadRequestException("Invitation has already been used");
    }
    // Hardening audit (validation, HIGH) — a forwarded link used to let
    // ANY signed-in holder of the token join with the invited role. The
    // token proves possession of the link, not that the caller is the
    // invited person, so it must be bound to the invited email too.
    if (invitation.email.toLowerCase() !== callerEmail.toLowerCase()) {
      throw new ForbiddenException(
        "This invitation was sent to a different email address",
      );
    }

    const existing = await this.prisma.member.findUnique({
      where: {
        userId_familyGroupId: {
          userId,
          familyGroupId: invitation.familyGroupId,
        },
      },
    });
    if (existing) {
      throw new BadRequestException(
        "You are already a member of this family group",
      );
    }

    // Hardening audit (validation, HIGH) — the read-then-write above (check
    // usedAt, then unconditionally `update({ where: { token } })`) races:
    // two concurrent accepts could both pass the `usedAt` check and both
    // create a Member row before either write lands. Redeeming the token is
    // now a conditional `updateMany` (`usedAt: null` in the WHERE clause) in
    // the SAME transaction as the member create, so only the first caller to
    // land the claim gets a count of 1; a loser rolls the whole transaction
    // back instead of creating a duplicate/orphaned member.
    const member = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.invitation.updateMany({
        where: { token, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (claim.count === 0) {
        throw new BadRequestException("Invitation has already been used");
      }
      return tx.member.create({
        data: {
          userId,
          familyGroupId: invitation.familyGroupId,
          role: invitation.role,
          // EPIC-023 Task C (D1) — carried through from the invitation.
          relationship: invitation.relationship,
        },
        include: { user: { select: MEMBER_USER_SELECT } },
      });
    });

    return {
      id: member.id,
      userId: member.userId,
      familyGroupId: member.familyGroupId,
      role: member.role,
      relationship: member.relationship,
      name: member.user.name,
      email: member.user.email,
      username: member.user.username,
      managedLogin: isManagedLogin(member.user, member.familyGroupId),
      pendingEmail: member.user.pendingEmail,
      createdAt: member.createdAt.toISOString(),
      largeTxnThreshold: member.largeTxnThreshold?.toString() ?? null,
    };
  }

  /**
   * EPIC-023 D1/D6 (US-FAM-12, US-AUTH-9) — head-created dependant/
   * operational member: name + username + initial password, no email,
   * forced password change at first login. The caller's own familyGroupId
   * (URL param) and role are already verified by `TenantGuard` + the
   * controller's `@CheckAbility(manage Member)` (owner/spouse only) before
   * this method runs — see casl-ability.factory.ts.
   *
   * Deliberately bypasses better-auth's own user-creation API (its
   * `databaseHooks.user.create.after` in `apps/web/src/lib/auth.ts` would
   * auto-create a BRAND NEW family for this user, the opposite of what's
   * needed here) with a single raw Prisma transaction: `User` + a credential
   * `BaAccount` row (same `providerId: "credential"` / `accountId: user.id`
   * convention better-auth's own `/sign-up/email` route uses — verified
   * against node_modules/.../better-auth/dist/api/routes/sign-up.mjs — so a
   * real `signInUsername` call finds and verifies it) + the target `Member`
   * row, atomically.
   */
  async createDependantMember(
    familyGroupId: string,
    dto: CreateDependantMemberDto,
  ): Promise<DependantMemberResponseDto> {
    // EPIC-024 A1 (D1) — "istri = co-master penuh": the ONLY case this
    // endpoint accepts `role: owner` is paired with `relationship: istri`.
    // Every other relationship/role combination still goes through the
    // dependant/operational path unchanged.
    // EPIC-032 R1 — istri = Co-Master (`spouse`): the head stays the only
    // `owner`. This supersedes EPIC-024 A1's "istri = owner".
    const isIstriCoMaster =
      dto.role === Role.spouse && dto.relationship === MemberRelationship.istri;

    if (
      dto.role !== Role.dependant &&
      dto.role !== Role.operational &&
      dto.role !== Role.member &&
      !isIstriCoMaster
    ) {
      throw new BadRequestException(
        withCode(
          "role must be 'dependant', 'operational', or 'member' for this endpoint (or 'spouse' when relationship is 'istri')",
          "INVALID_ROLE_FOR_DEPENDANT_CREATION",
        ),
      );
    }

    // better-auth's `username` plugin default `usernameNormalization` is
    // `(u) => u.toLowerCase()` (verified — see auth.ts's `plugins: [username()]`,
    // no override passed). Store/compare the same way so a case-insensitive
    // collision is caught here AND a real `/sign-in/username` lookup (which
    // normalizes the same way) actually finds this row.
    // EPIC-031 — the stored login ID is `<username>@<kode keluarga>`, so a
    // username only has to be unique inside this family.
    const handle = await this.ensureHandle(familyGroupId);
    const normalizedUsername = buildFamilyLoginId(dto.username, handle);
    // `dto.email` is NOT written here: an address a Master types only becomes
    // the login email after its owner confirms it (MemberEmailService).

    // Same argon2 config used everywhere else in this codebase (auth.ts's
    // `emailAndPassword.password.hash`) — the hash must verify correctly
    // the moment better-auth's own credential provider checks it.
    const passwordHash = await argon2.hash(dto.initialPassword, {
      type: argon2.argon2id,
    });

    try {
      const member = await this.prisma.$transaction(async (tx) => {
        // EPIC-024 A1 (D1) — max 1 istri (co-master) per family group,
        // enforced race-safely under concurrent requests. There is no
        // existing istri row to key a `SELECT ... FOR UPDATE` on for the
        // FIRST istri (the invariant is about ABSENCE, not presence of a
        // specific row) — a naive `count() -> create()` has a TOCTOU gap:
        // two simultaneous requests can both read count=0 and both insert.
        // Locking the FamilyGroup row itself closes that gap: any two
        // concurrent istri-creation transactions for the SAME family group
        // serialize on this lock (Postgres blocks the second `FOR UPDATE`
        // until the first transaction commits or rolls back), so the
        // recheck below always sees the first transaction's write once it
        // proceeds. Only taken on the istri path — every other
        // dependant/operational creation is unaffected and keeps its
        // existing (lock-free) throughput.
        if (isIstriCoMaster) {
          // NOTE: raw SQL table name is "family_groups", the `@@map`'d
          // Postgres table for the `FamilyGroup` model (schema.prisma) —
          // not the Prisma model name itself.
          await tx.$queryRaw`SELECT id FROM "family_groups" WHERE id = ${familyGroupId} FOR UPDATE`;
          const existingIstri = await tx.member.findFirst({
            where: {
              familyGroupId,
              relationship: MemberRelationship.istri,
            },
            select: { id: true },
          });
          if (existingIstri) {
            throw new ConflictException(
              withCode(
                "Keluarga ini sudah memiliki istri (co-master)",
                "MAX_ONE_ISTRI",
              ),
            );
          }
        }

        const existingUsername = await tx.user.findUnique({
          where: { username: normalizedUsername },
          select: { id: true },
        });
        if (existingUsername) {
          throw new ConflictException(
            withCode(
              "Username sudah dipakai anggota lain di keluarga ini",
              "USERNAME_TAKEN",
            ),
          );
        }

        const user = await tx.user.create({
          data: {
            // See SYNTHETIC_EMAIL_DOMAIN above for the collision-avoidance
            // reasoning (`.invalid` TLD + UUID). A real email is attached
            // only after confirmation (EPIC-031, MemberEmailService).
            email: `member-${randomUUID()}@${SYNTHETIC_EMAIL_DOMAIN}`,
            name: dto.name,
            username: normalizedUsername,
            displayUsername: dto.username,
            managedByFamilyGroupId: familyGroupId,
            avatarInitials: initialsFromName(dto.name),
            mustChangePassword: true,
            emailVerified: false,
          },
        });

        await tx.baAccount.create({
          data: {
            userId: user.id,
            providerId: "credential",
            accountId: user.id,
            password: passwordHash,
          },
        });

        return tx.member.create({
          data: {
            userId: user.id,
            familyGroupId,
            role: dto.role,
            relationship: dto.relationship ?? null,
          },
        });
      });

      return {
        id: member.id,
        userId: member.userId,
        familyGroupId: member.familyGroupId,
        role: member.role,
        relationship: member.relationship,
        name: dto.name,
        username: normalizedUsername,
        createdAt: member.createdAt.toISOString(),
      };
    } catch (err) {
      // The pre-check above has a TOCTOU gap under real concurrency (two
      // simultaneous requests for the same username) — `User.username`'s DB
      // unique constraint is the actual enforcement; this converts that
      // race into the same clean, code-carrying 409 instead of a raw 500.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        (err.meta?.["target"] as string[] | undefined)?.includes("username")
      ) {
        throw new ConflictException(
          withCode(
            "Username sudah dipakai anggota lain di keluarga ini",
            "USERNAME_TAKEN",
          ),
        );
      }
      throw err;
    }
  }

  /**
   * EPIC-031 — the family's "kode keluarga". Assigned lazily for a family
   * created after the backfill migration: first word of its name + 6 random
   * hex chars, retried on the (astronomically rare) unique collision.
   */
  async ensureHandle(familyGroupId: string): Promise<string> {
    const group = await this.prisma.familyGroup.findUnique({
      where: { id: familyGroupId },
      select: { handle: true, name: true },
    });
    if (!group) throw new NotFoundException("Family group not found");
    if (group.handle) return group.handle;

    const base = slugifyHandleBase(group.name);
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `${base}-${randomUUID().replace(/-/g, "").slice(0, 6)}`;
      try {
        const updated = await this.prisma.familyGroup.updateMany({
          where: { id: familyGroupId, handle: null },
          data: { handle: candidate },
        });
        if (updated.count === 1) return candidate;
        // Someone else assigned one concurrently — use theirs.
        const again = await this.prisma.familyGroup.findUnique({
          where: { id: familyGroupId },
          select: { handle: true },
        });
        if (again?.handle) return again.handle;
      } catch (err) {
        if (
          !(err instanceof Prisma.PrismaClientKnownRequestError) ||
          err.code !== "P2002"
        ) {
          throw err;
        }
      }
    }
    throw new ConflictException("Could not assign a family login handle");
  }

  async getLoginHandle(
    familyGroupId: string,
    requesterId: string,
  ): Promise<{ handle: string }> {
    await this.assertMember(familyGroupId, requesterId);
    return { handle: await this.ensureHandle(familyGroupId) };
  }

  /**
   * Master renames the kode keluarga. Every login ID this family's Master
   * created (`x@old`) is rewritten to `x@new` in the same transaction, so
   * members keep signing in — with the new code. Legacy plain usernames and
   * self-registered accounts are untouched.
   */
  async updateLoginHandle(
    familyGroupId: string,
    requesterId: string,
    rawHandle: string,
  ): Promise<{ handle: string }> {
    await this.assertOwner(familyGroupId, requesterId);
    const next = rawHandle.trim().toLowerCase();
    if (!FAMILY_HANDLE_PATTERN.test(next)) {
      throw new BadRequestException(
        withCode(
          "Kode keluarga 3–24 karakter: huruf kecil, angka, dan tanda minus",
          "INVALID_FAMILY_HANDLE",
        ),
      );
    }
    const current = await this.ensureHandle(familyGroupId);
    if (current === next) return { handle: current };

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.familyGroup.update({
          where: { id: familyGroupId },
          data: { handle: next },
        });
        const managed = await tx.user.findMany({
          where: {
            managedByFamilyGroupId: familyGroupId,
            username: { endsWith: `@${current}` },
          },
          select: { id: true, username: true },
        });
        for (const u of managed) {
          const local = (u.username ?? "").slice(0, -(current.length + 1));
          await tx.user.update({
            where: { id: u.id },
            data: { username: buildFamilyLoginId(local, next) },
          });
        }
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictException(
          withCode("Kode keluarga sudah dipakai keluarga lain", "HANDLE_TAKEN"),
        );
      }
      throw err;
    }
    return { handle: next };
  }

  /**
   * EPIC-021 Group F (#6) — read the family's manually-entered gold price
   * per gram. Any member may read it (needed to render the consolidated
   * total); only the owner may change it (see `updateGoldPrice`).
   */
  async getGoldPrice(
    familyGroupId: string,
    requesterId: string,
  ): Promise<GoldPriceResponseDto> {
    await this.assertMember(familyGroupId, requesterId);

    const group = await this.prisma.familyGroup.findUnique({
      where: { id: familyGroupId },
      select: { goldPricePerGram: true, goldPriceUpdatedAt: true },
    });
    if (!group) throw new NotFoundException("Family group not found");

    return {
      pricePerGram: group.goldPricePerGram?.toString() ?? null,
      updatedAt: group.goldPriceUpdatedAt?.toISOString() ?? null,
    };
  }

  /**
   * EPIC-021 Group F (#6) — owner-only: set/replace the family's manually
   * entered gold price per gram. No live gold price feed exists or may be
   * fabricated (Open Design Decision #6) — `goldPriceUpdatedAt` is stamped
   * so every display can honestly label the value "diinput manual, per
   * <date>" rather than implying a live quote.
   */
  async updateGoldPrice(
    familyGroupId: string,
    requesterId: string,
    dto: UpdateGoldPriceDto,
  ): Promise<GoldPriceResponseDto> {
    await this.assertOwner(familyGroupId, requesterId);

    const now = new Date();
    const group = await this.prisma.familyGroup.update({
      where: { id: familyGroupId },
      data: {
        goldPricePerGram: BigInt(dto.pricePerGram),
        goldPriceUpdatedAt: now,
      },
      select: { goldPricePerGram: true, goldPriceUpdatedAt: true },
    });

    return {
      pricePerGram: group.goldPricePerGram?.toString() ?? null,
      updatedAt: group.goldPriceUpdatedAt?.toISOString() ?? null,
    };
  }

  /**
   * EPIC-023 F2 (D20, US-DON-6/7) — read the family's religion setting
   * (zakat / perpuluhan / neither). Any member may read it (the donation
   * page needs it to pick which calculator to show); only the owner may
   * change it (see `updateReligion`) — mirrors `getGoldPrice`/
   * `updateGoldPrice`'s owner-writable/member-readable shape.
   */
  async getReligion(
    familyGroupId: string,
    requesterId: string,
  ): Promise<FamilyReligionResponseDto> {
    await this.assertMember(familyGroupId, requesterId);

    const group = await this.prisma.familyGroup.findUnique({
      where: { id: familyGroupId },
      select: { religion: true },
    });
    if (!group) throw new NotFoundException("Family group not found");

    return { religion: group.religion };
  }

  /**
   * EPIC-023 F2 (D20, US-DON-6/7) — owner-only: set/replace the family's
   * religion setting. This never rewrites existing `Donation` rows or their
   * `isTaxDeductible` flag — changing the setting only changes which
   * calculator the donation page shows and which NEW donations may be
   * marked deductible going forward (see donations.service.ts).
   */
  async updateReligion(
    familyGroupId: string,
    requesterId: string,
    dto: UpdateFamilyReligionDto,
  ): Promise<FamilyReligionResponseDto> {
    await this.assertOwner(familyGroupId, requesterId);

    const group = await this.prisma.familyGroup.update({
      where: { id: familyGroupId },
      data: { religion: dto.religion },
      select: { religion: true },
    });

    return { religion: group.religion };
  }

  private async assertMember(
    familyGroupId: string,
    userId: string,
  ): Promise<void> {
    const member = await this.prisma.member.findUnique({
      where: { userId_familyGroupId: { userId, familyGroupId } },
      select: { id: true },
    });
    if (!member)
      throw new ForbiddenException("Not a member of this family group");
  }

  private async assertOwner(
    familyGroupId: string,
    userId: string,
  ): Promise<void> {
    const member = await this.prisma.member.findUnique({
      where: { userId_familyGroupId: { userId, familyGroupId } },
      select: { role: true },
    });
    if (!member || member.role !== Role.owner) {
      throw new ForbiddenException("Only owners can perform this action");
    }
  }
}
