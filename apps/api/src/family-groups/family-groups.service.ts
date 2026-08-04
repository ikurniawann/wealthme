import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConfigService } from "@nestjs/config";
import { Role } from "@prisma/client";

import {
  NOTIFICATION_SENDER_PORT,
  type NotificationSenderPort,
} from "../notifications/notification-sender.port";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { Env } from "../config/env";
import type { CreateFamilyGroupDto } from "./dto/create-family-group.dto";
import type { CreateInvitationDto } from "./dto/create-invitation.dto";
import type { FamilyGroupResponseDto } from "./dto/family-group-response.dto";
import type { GoldPriceResponseDto } from "./dto/gold-price-response.dto";
import type { InvitationResponseDto } from "./dto/invitation-response.dto";
import type { MemberResponseDto } from "./dto/member-response.dto";
import type { UpdateGoldPriceDto } from "./dto/update-gold-price.dto";
import type { UpdateMemberRoleDto } from "./dto/update-member-role.dto";

const INVITATION_TTL_DAYS = 7;

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
  ) {}

  async findMine(userId: string): Promise<FamilyGroupResponseDto[]> {
    const memberships = await this.prisma.member.findMany({
      where: { userId },
      include: {
        familyGroup: {
          include: { _count: { select: { members: true } } },
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
      include: { _count: { select: { members: true } } },
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
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      familyGroupId: m.familyGroupId,
      role: m.role,
      name: m.user.name,
      email: m.user.email,
      createdAt: m.createdAt.toISOString(),
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
      include: { user: { select: { name: true, email: true } } },
    });
    if (!member) throw new NotFoundException("Member not found");

    const updated = await this.prisma.member.update({
      where: { id: memberId },
      data: { role: dto.role },
      include: { user: { select: { name: true, email: true } } },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      familyGroupId: updated.familyGroupId,
      role: updated.role,
      name: updated.user.name,
      email: updated.user.email,
      createdAt: updated.createdAt.toISOString(),
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
    await this.prisma.$transaction([
      this.prisma.account.updateMany({
        where: { familyGroupId, ownerUserId: member.userId },
        data: { ownerUserId: null },
      }),
      this.prisma.member.delete({ where: { id: memberId } }),
    ]);
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
      expiresAt: invitation.expiresAt.toISOString(),
      usedAt: null,
      createdAt: invitation.createdAt.toISOString(),
    };
  }

  async acceptInvitation(
    token: string,
    userId: string,
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

    const [member] = await this.prisma.$transaction([
      this.prisma.member.create({
        data: {
          userId,
          familyGroupId: invitation.familyGroupId,
          role: invitation.role,
        },
        include: { user: { select: { name: true, email: true } } },
      }),
      this.prisma.invitation.update({
        where: { token },
        data: { usedAt: new Date() },
      }),
    ]);

    return {
      id: member.id,
      userId: member.userId,
      familyGroupId: member.familyGroupId,
      role: member.role,
      name: member.user.name,
      email: member.user.email,
      createdAt: member.createdAt.toISOString(),
    };
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
