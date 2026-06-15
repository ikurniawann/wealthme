import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { type Request as ExpressRequest } from "express";

import { Public } from "../common/decorators/public.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AuthService } from "./auth.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ChangePasswordDto } from "./dto/change-password.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { LoginDto } from "./dto/login.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { RegisterDto } from "./dto/register.dto";
import { TokenPairDto } from "./dto/token-pair.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UserProfileDto } from "./dto/user-profile.dto";
import { GoogleAuthGuard } from "./guards/google-auth.guard";
import { JwtRefreshGuard } from "./guards/jwt-refresh.guard";
import { type GoogleProfile } from "./strategies/google.strategy";
import { type JwtPayload } from "./strategies/jwt.strategy";

interface AuthenticatedRequest extends ExpressRequest {
  user: JwtPayload;
}

interface GoogleCallbackRequest extends ExpressRequest {
  user: GoogleProfile;
}

@ApiTags("auth")
@UseGuards(ThrottlerGuard)
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: "Register a new user" })
  @ApiResponse({ status: 201, type: TokenPairDto })
  register(@Body() dto: RegisterDto): Promise<TokenPairDto> {
    return this.auth.register(dto);
  }

  @Post("login")
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: "Login with email/password" })
  @ApiResponse({ status: 200, type: TokenPairDto })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  login(@Body() dto: LoginDto): Promise<TokenPairDto> {
    return this.auth.login(dto);
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Logout (invalidate refresh token)" })
  @ApiResponse({ status: 204 })
  logout(@Request() req: AuthenticatedRequest): Promise<void> {
    return this.auth.logout(req.user.sub);
  }

  @Post("refresh")
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @UseGuards(JwtRefreshGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Refresh access token (rotates refresh token)" })
  @ApiResponse({ status: 200, type: TokenPairDto })
  refresh(@Request() req: AuthenticatedRequest): Promise<TokenPairDto> {
    return this.auth.refresh(req.user.sub, req.user.email);
  }

  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user profile" })
  @ApiResponse({ status: 200, type: UserProfileDto })
  me(@Request() req: AuthenticatedRequest): Promise<UserProfileDto> {
    return this.auth.getMe(req.user.sub);
  }

  @Patch("profile")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update current user profile (name, avatarInitials)",
  })
  @ApiResponse({ status: 200, type: UserProfileDto })
  updateProfile(
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    return this.auth.updateProfile(req.user.sub, dto);
  }

  @Post("change-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Change user password" })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 401, description: "Current password incorrect" })
  changePassword(
    @Request() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.auth.changePassword(req.user.sub, dto);
  }

  @Get("google")
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({
    summary: "Initiate Google OAuth login (redirects to Google)",
  })
  @ApiResponse({ status: 302, description: "Redirect to Google" })
  googleLogin(): void {
    // Passport intercepts and redirects — no body needed.
  }

  @Get("google/callback")
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @UseGuards(GoogleAuthGuard)
  @ApiExcludeEndpoint()
  googleCallback(@Request() req: GoogleCallbackRequest): Promise<TokenPairDto> {
    return this.auth.loginWithGoogle(req.user);
  }
}
