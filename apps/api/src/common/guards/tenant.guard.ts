import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { canAccessPage } from "@wealthme/contracts";

import {
  MEMBER_ACCESS_SELECT,
  effectiveAccessForMember,
} from "../../access/member-access.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../prisma/prisma.service";

import type { JwtPayload } from "../../auth/strategies/jwt.strategy";
import type { Request } from "express";

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as JwtPayload | undefined;

    if (!user) return true; // unauthenticated routes pass through

    const familyGroupId = req.params["familyGroupId"] as string | undefined;

    if (!familyGroupId) {
      req.tenantContext = {
        userId: user.sub,
        familyGroupId: null,
        role: null,
        member: null,
        access: null,
      };
      return true;
    }

    const member = await this.prisma.member.findUnique({
      where: { userId_familyGroupId: { userId: user.sub, familyGroupId } },
      select: {
        id: true,
        userId: true,
        familyGroupId: true,
        ...MEMBER_ACCESS_SELECT,
      },
    });

    if (!member) throw new ForbiddenException("Access denied");

    // EPIC-030 — resolved once per request; PageAccessGuard, CASL and the
    // privacy helpers all read this same object.
    const access = effectiveAccessForMember(member);

    req.tenantContext = {
      userId: user.sub,
      familyGroupId,
      role: member.role,
      member: {
        id: member.id,
        userId: member.userId,
        familyGroupId: member.familyGroupId,
        role: member.role,
        rowScoped: access.dataScope === "own",
        // Family-shared bank/cash accounts stay visible to an "own data"
        // member who has either account page (read-only; writes stay own).
        seesSharedAccounts:
          canAccessPage(access, "rekening") || canAccessPage(access, "dana"),
      },
      access,
    };
    return true;
  }
}
