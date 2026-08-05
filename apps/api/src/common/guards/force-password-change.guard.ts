import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { Reflector } from "@nestjs/core";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../prisma/prisma.service";
import { SKIP_PASSWORD_CHECK_KEY } from "../decorators/skip-password-check.decorator";

import type { JwtPayload } from "../../auth/strategies/jwt.strategy";
import type { Request } from "express";

/**
 * EPIC-023 D1/D6 (US-FAM-12, US-AUTH-9) — a head-created dependant/
 * operational account (`FamilyGroupsService#createDependantMember`) is
 * provisioned with `User.mustChangePassword = true`. This guard runs
 * globally, right after `BetterAuthGuard` populates `req.user`: every
 * request from such an account is refused with 403
 * `{ code: "PASSWORD_CHANGE_REQUIRED" }` until the password is changed
 * (`PasswordPolicyService#setPassword` clears the flag), except a small
 * allowlist.
 *
 * New routes opt out via `@SkipPasswordCheck()`. The two pre-existing
 * legacy `AuthController` routes that must stay reachable (`GET /auth/me`,
 * `POST /auth/logout`) are allowlisted below by exact method+path instead —
 * that controller is explicitly out of scope for this task (see the task
 * brief / AGENTS.md), so it cannot be decorated directly.
 *
 * A `mustChangePassword: false` (or missing) user is completely unaffected —
 * this is a no-op for every pre-existing account.
 */
const LEGACY_ALLOWLIST: ReadonlyArray<{ method: string; path: string }> = [
  { method: "GET", path: "/auth/me" },
  { method: "POST", path: "/auth/logout" },
];

@Injectable()
export class ForcePasswordChangeGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as JwtPayload | undefined;
    // Unauthenticated / @Public() routes — BetterAuthGuard already let them
    // through without setting req.user; nothing to check.
    if (!user) return true;

    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_PASSWORD_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip || this.isLegacyAllowlisted(request)) return true;

    const record = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { mustChangePassword: true },
    });
    if (!record?.mustChangePassword) return true;

    throw new ForbiddenException({
      message: "Password change required before continuing",
      code: "PASSWORD_CHANGE_REQUIRED",
    });
  }

  private isLegacyAllowlisted(request: Request): boolean {
    return LEGACY_ALLOWLIST.some(
      (entry) => entry.method === request.method && entry.path === request.path,
    );
  }
}
