import { Injectable, UnauthorizedException } from "@nestjs/common";
import * as argon2 from "argon2";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { PasswordStatusResponseDto } from "./dto/password-status-response.dto";
import type { SetPasswordDto } from "./dto/set-password.dto";

/**
 * EPIC-023 D1/D6 (US-FAM-12, US-AUTH-9) — forced first-login password
 * change for a head-created dependant/operational member.
 *
 * Updates the credential `BaAccount.password` row directly with argon2
 * (the SAME hash config used everywhere else in this codebase — see
 * `apps/web/src/lib/auth.ts`'s `emailAndPassword.password.hash`), rather
 * than calling better-auth's own `auth.api.changePassword`: the `auth`
 * instance lives in `apps/web` (a separate Next.js process/package) and
 * `apps/api` has no dependency on it and no way to reach it in-process —
 * this is the only reachable path from a NestJS controller. The result is
 * byte-for-byte what better-auth's own credential provider expects, so a
 * subsequent `signInUsername` verifies it exactly as if better-auth had
 * written it itself.
 */
@Injectable()
export class PasswordPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(userId: string): Promise<PasswordStatusResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mustChangePassword: true },
    });
    return { mustChangePassword: user?.mustChangePassword ?? false };
  }

  async setPassword(userId: string, dto: SetPasswordDto): Promise<void> {
    const account = await this.prisma.baAccount.findFirst({
      where: { userId, providerId: "credential" },
      select: { id: true, password: true },
    });
    if (!account?.password) {
      throw new UnauthorizedException("No password credential on this account");
    }

    const valid = await argon2
      .verify(account.password, dto.currentPassword)
      .catch(() => false);
    if (!valid) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    const newHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
    });

    await this.prisma.$transaction([
      this.prisma.baAccount.update({
        where: { id: account.id },
        data: { password: newHash },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { mustChangePassword: false },
      }),
    ]);
  }
}
