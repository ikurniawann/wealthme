import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { type Request as ExpressRequest } from "express";

import { SkipPasswordCheck } from "../common/decorators/skip-password-check.decorator";

import { PasswordStatusResponseDto } from "./dto/password-status-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SetPasswordDto } from "./dto/set-password.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PasswordPolicyService } from "./password-policy.service";
import { type JwtPayload } from "./strategies/jwt.strategy";

interface AuthRequest extends ExpressRequest {
  user: JwtPayload;
}

/**
 * EPIC-023 D1/D6 (US-FAM-12, US-AUTH-9) — a NEW controller (not the legacy
 * `AuthController`, which is out of scope for this task) sharing the same
 * `/auth` prefix. Both routes are `@SkipPasswordCheck()`-exempt so an
 * account stuck in `mustChangePassword: true` can still check its own
 * status and actually clear it — see `ForcePasswordChangeGuard`.
 */
@ApiTags("auth")
@ApiBearerAuth()
@Controller("auth")
export class PasswordPolicyController {
  constructor(private readonly passwordPolicy: PasswordPolicyService) {}

  @Get("password-status")
  @SkipPasswordCheck()
  @ApiOperation({
    summary:
      "Whether the current user must change their password before continuing (D1 forced first-login change)",
  })
  @ApiResponse({ status: 200, type: PasswordStatusResponseDto })
  getStatus(@Request() req: AuthRequest): Promise<PasswordStatusResponseDto> {
    return this.passwordPolicy.getStatus(req.user.sub);
  }

  @Post("set-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @SkipPasswordCheck()
  @ApiOperation({
    summary:
      "Set a new password (used for the forced first-login change); requires the current password",
  })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 401, description: "Current password incorrect" })
  setPassword(
    @Request() req: AuthRequest,
    @Body() dto: SetPasswordDto,
  ): Promise<void> {
    return this.passwordPolicy.setPassword(req.user.sub, dto);
  }
}
