import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConfigService } from "@nestjs/config";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { RedisService } from "../redis/redis.service";

import type { Env } from "../config/env";
import type { LoginDto } from "./dto/login.dto";
import type { RegisterDto } from "./dto/register.dto";
import type { GoogleProfile } from "./strategies/google.strategy";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

type UserProfile = {
  id: string;
  email: string;
  name: string;
  avatarInitials: string | null;
  createdAt: Date;
  familyGroupId: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async register(dto: RegisterDto): Promise<TokenPair> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException("Email already in use");

    let passwordHash: string;
    try {
      passwordHash = await argon2.hash(dto.password, {
        type: argon2.argon2id,
      });
    } catch {
      throw new InternalServerErrorException("Failed to process registration");
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        avatarInitials: dto.name
          .split(" ")
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() ?? "")
          .join(""),
      },
    });

    return this.issueTokens(user.id, user.email);
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user?.passwordHash) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return this.issueTokens(user.id, user.email);
  }

  async logout(userId: string): Promise<void> {
    await this.redis.del(`refresh:${userId}`);
  }

  async refresh(userId: string, email: string): Promise<TokenPair> {
    return this.issueTokens(userId, email);
  }

  async getMe(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarInitials: true,
        createdAt: true,
        memberships: {
          select: { familyGroupId: true },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarInitials: user.avatarInitials,
      createdAt: user.createdAt,
      familyGroupId: user.memberships?.[0]?.familyGroupId ?? null,
    };
  }

  async loginWithGoogle(profile: GoogleProfile): Promise<TokenPair> {
    // Look up by googleId first to detect already-linked accounts.
    const byGoogleId = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });
    if (byGoogleId) {
      return this.issueTokens(byGoogleId.id, byGoogleId.email);
    }

    // Check for an existing email-only account — prevent account-takeover.
    const byEmail = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });
    if (byEmail) {
      throw new ConflictException(
        "An account with this email already exists. Please log in with your password and link Google from your profile settings.",
      );
    }

    const initials = profile.name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("");

    const created = await this.prisma.user.create({
      data: {
        email: profile.email,
        name: profile.name,
        googleId: profile.googleId,
        passwordHash: null,
        avatarInitials: initials,
      },
    });

    return this.issueTokens(created.id, created.email);
  }

  private async issueTokens(userId: string, email: string): Promise<TokenPair> {
    const payload = { sub: userId, email };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get("JWT_SECRET", { infer: true }),
      expiresIn: this.config.get("JWT_EXPIRES_IN", { infer: true }),
    });

    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get("JWT_REFRESH_SECRET", { infer: true }),
      expiresIn: this.config.get("JWT_REFRESH_EXPIRES_IN", { infer: true }),
    });

    // Overwrite previous refresh token (rotation — old token is invalidated immediately).
    const ttlSeconds = this.parseTtl(
      this.config.get("JWT_REFRESH_EXPIRES_IN", { infer: true }),
    );
    await this.redis.set(`refresh:${userId}`, refreshToken, ttlSeconds);

    return { accessToken, refreshToken };
  }

  private parseTtl(expiry: string): number {
    const match = /^(\d+)([smhd])$/.exec(expiry);
    if (!match || !match[1] || !match[2]) return 7 * 24 * 3600; // fallback 7d
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    return value * (multipliers[unit] ?? 1);
  }
}
