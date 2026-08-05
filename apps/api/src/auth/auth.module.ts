import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
// EPIC-023 D1/D6 (US-FAM-12, US-AUTH-9) — a NEW controller/service, kept
// separate from the legacy AuthController/AuthService above (out of scope
// for this task), sharing the same "/auth" route prefix.
import { PasswordPolicyController } from "./password-policy.controller";
import { PasswordPolicyService } from "./password-policy.service";
import { GoogleStrategy } from "./strategies/google.strategy";
import { JwtRefreshStrategy } from "./strategies/jwt-refresh.strategy";
import { JwtStrategy } from "./strategies/jwt.strategy";

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController, PasswordPolicyController],
  providers: [
    AuthService,
    PasswordPolicyService,
    JwtStrategy,
    JwtRefreshStrategy,
    GoogleStrategy,
  ],
})
export class AuthModule {}
