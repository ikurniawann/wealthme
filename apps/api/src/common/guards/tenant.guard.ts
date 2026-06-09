import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";

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
      };
      return true;
    }

    const member = await this.prisma.member.findUnique({
      where: { userId_familyGroupId: { userId: user.sub, familyGroupId } },
      select: { id: true, userId: true, familyGroupId: true, role: true },
    });

    if (!member) throw new ForbiddenException("Access denied");

    req.tenantContext = {
      userId: user.sub,
      familyGroupId,
      role: member.role,
      member,
    };
    return true;
  }
}
