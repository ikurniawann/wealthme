import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Role } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { CreateFamilyGroupDto } from "./dto/create-family-group.dto";
import type { CreateInvitationDto } from "./dto/create-invitation.dto";
import type { FamilyGroupResponseDto } from "./dto/family-group-response.dto";
import type { InvitationResponseDto } from "./dto/invitation-response.dto";
import type { MemberResponseDto } from "./dto/member-response.dto";
import type { UpdateMemberRoleDto } from "./dto/update-member-role.dto";

const INVITATION_TTL_DAYS = 7;

@Injectable()
export class FamilyGroupsService {
  constructor(private readonly prisma: PrismaService) {}

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

    await this.prisma.member.delete({ where: { id: memberId } });
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
