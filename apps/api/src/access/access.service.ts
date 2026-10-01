import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";
import {
  AccessRoleInputSchema,
  MemberAccessInputSchema,
  type AccessPermissions,
  type AccessRoleResponse,
} from "@wealthme/contracts";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import { parsePermissions } from "./member-access.util";

function badRequest(error: { issues: { message: string }[] }): never {
  throw new BadRequestException({
    message: error.issues.map((i) => i.message).join("; "),
    code: "INVALID_ACCESS_INPUT",
  });
}

/**
 * EPIC-030 — the Master's IAM operations: custom roles (page levels + data
 * scope) and per-member assignment/overrides. Every method re-checks that the
 * requester is an owner of THIS family (defense in depth behind
 * PageAccessGuard's Master-only `iam` resource).
 */
@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async listRoles(
    familyGroupId: string,
    requesterId: string,
  ): Promise<AccessRoleResponse[]> {
    await this.assertOwner(familyGroupId, requesterId);
    const roles = await this.prisma.accessRole.findMany({
      where: { familyGroupId },
      include: {
        _count: { select: { members: { where: { deletedAt: null } } } },
      },
      orderBy: { createdAt: "asc" },
    });
    return roles.map((r) => this.toResponse(r, r._count.members));
  }

  async createRole(
    familyGroupId: string,
    requesterId: string,
    body: unknown,
  ): Promise<AccessRoleResponse> {
    await this.assertOwner(familyGroupId, requesterId);
    const parsed = AccessRoleInputSchema.safeParse(body);
    if (!parsed.success) badRequest(parsed.error);
    try {
      const role = await this.prisma.accessRole.create({
        data: {
          familyGroupId,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          dataScope: parsed.data.dataScope,
          permissions: parsed.data.permissions,
        },
      });
      return this.toResponse(role, 0);
    } catch (err) {
      this.rethrowDuplicateName(err);
    }
  }

  async updateRole(
    familyGroupId: string,
    roleId: string,
    requesterId: string,
    body: unknown,
  ): Promise<AccessRoleResponse> {
    await this.assertOwner(familyGroupId, requesterId);
    await this.findRole(familyGroupId, roleId);
    const parsed = AccessRoleInputSchema.safeParse(body);
    if (!parsed.success) badRequest(parsed.error);
    try {
      const role = await this.prisma.accessRole.update({
        where: { id: roleId },
        data: {
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          dataScope: parsed.data.dataScope,
          permissions: parsed.data.permissions,
        },
        include: {
          _count: { select: { members: { where: { deletedAt: null } } } },
        },
      });
      return this.toResponse(role, role._count.members);
    } catch (err) {
      this.rethrowDuplicateName(err);
    }
  }

  /** Members holding the role fall back to their built-in role (FK SetNull). */
  async deleteRole(
    familyGroupId: string,
    roleId: string,
    requesterId: string,
  ): Promise<void> {
    await this.assertOwner(familyGroupId, requesterId);
    await this.findRole(familyGroupId, roleId);
    await this.prisma.accessRole.delete({ where: { id: roleId } });
  }

  async setMemberAccess(
    familyGroupId: string,
    memberId: string,
    requesterId: string,
    body: unknown,
  ): Promise<void> {
    await this.assertOwner(familyGroupId, requesterId);
    const parsed = MemberAccessInputSchema.safeParse(body);
    if (!parsed.success) badRequest(parsed.error);

    const member = await this.prisma.member.findFirst({
      where: { id: memberId, familyGroupId },
      select: { id: true, role: true, userId: true },
    });
    if (!member) throw new NotFoundException("Member not found");
    if (
      parsed.data.canViewBalances !== undefined &&
      member.userId === requesterId
    ) {
      throw new ForbiddenException({
        message: "Tidak bisa mengubah izin saldo milik sendiri",
        code: "OWN_BALANCE_ACCESS_FIXED",
      });
    }
    if (member.role === Role.owner) {
      throw new BadRequestException({
        message: "Master selalu punya akses penuh",
        code: "MASTER_ACCESS_FIXED",
      });
    }
    if (parsed.data.accessRoleId) {
      await this.findRole(familyGroupId, parsed.data.accessRoleId);
    }

    const overrides: AccessPermissions = parsed.data.overrides;
    await this.prisma.member.update({
      where: { id: memberId },
      data: {
        accessRoleId: parsed.data.accessRoleId,
        accessOverrides:
          Object.keys(overrides).length > 0 ? overrides : Prisma.DbNull,
        ...(parsed.data.canViewBalances !== undefined && {
          canViewBalances: parsed.data.canViewBalances,
        }),
      },
    });
  }

  private async findRole(familyGroupId: string, roleId: string) {
    const role = await this.prisma.accessRole.findFirst({
      where: { id: roleId, familyGroupId },
      select: { id: true },
    });
    if (!role) throw new NotFoundException("Role not found");
    return role;
  }

  private rethrowDuplicateName(err: unknown): never {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new ConflictException({
        message: "Nama role sudah dipakai",
        code: "ACCESS_ROLE_NAME_TAKEN",
      });
    }
    throw err;
  }

  private toResponse(
    role: {
      id: string;
      name: string;
      description: string | null;
      dataScope: "all" | "own";
      permissions: Prisma.JsonValue;
      createdAt: Date;
    },
    memberCount: number,
  ): AccessRoleResponse {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      dataScope: role.dataScope,
      permissions: parsePermissions(role.permissions),
      memberCount,
      createdAt: role.createdAt.toISOString(),
    };
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
