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
import { buildReferenceItemSeed } from "@wealthme/contracts";
import * as argon2 from "argon2";

import {
  defaultCoaCodeForCategory,
  GENERIC_COA_CHART,
} from "../common/coa/default-coa-chart";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CryptoService } from "../crypto/crypto.service";
import { resolveNotifPrefs } from "../notifications/notification-prefs";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { RedisService } from "../redis/redis.service";

import type { Env } from "../config/env";
import type { NotificationPrefs } from "../notifications/notification-prefs";
import type { ChangePasswordDto } from "./dto/change-password.dto";
import type { LoginDto } from "./dto/login.dto";
import type { RegisterDto } from "./dto/register.dto";
import type { UpdateProfileDto } from "./dto/update-profile.dto";
import type { GoogleProfile } from "./strategies/google.strategy";

const DEFAULT_CATEGORIES = [
  { name: "Gaji", kind: "income" as const, icon: "💰" },
  { name: "Investasi", kind: "income" as const, icon: "📈" },
  { name: "Transfer Masuk", kind: "income" as const, icon: "📥" },
  { name: "Lainnya Pemasukan", kind: "income" as const, icon: "➕" },
  { name: "Makanan & Minuman", kind: "expense" as const, icon: "🍽️" },
  { name: "Transportasi", kind: "expense" as const, icon: "🚗" },
  { name: "Belanja", kind: "expense" as const, icon: "🛒" },
  { name: "Kesehatan", kind: "expense" as const, icon: "🏥" },
  { name: "Hiburan", kind: "expense" as const, icon: "🎮" },
  { name: "Tagihan & Utilitas", kind: "expense" as const, icon: "💡" },
  { name: "Pendidikan", kind: "expense" as const, icon: "📚" },
  { name: "Lainnya Pengeluaran", kind: "expense" as const, icon: "➖" },
];

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

type MembershipInfo = {
  id: string;
  familyGroupId: string;
  role: string;
};

type UserProfile = {
  id: string;
  email: string;
  name: string;
  avatarInitials: string | null;
  createdAt: Date;
  familyGroupId: string | null;
  memberships: MembershipInfo[];
  // Only populated by endpoints that select them (getProfileDetail/updateProfile);
  // getMe() intentionally omits these to keep its Prisma select minimal.
  phone?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  jobTitle?: string | null;
  monthlyIncome?: string | null;
  currency?: string;
  notificationPrefs?: NotificationPrefs;
};

const PROFILE_DETAIL_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarInitials: true,
  phone: true,
  birthDate: true,
  gender: true,
  jobTitle: true,
  monthlyIncome: true,
  currency: true,
  notificationPrefs: true,
  createdAt: true,
  // EPIC-024 A3 (Evidence #1) — `createdAt: "asc"` so `memberships[0]` below
  // is always the OLDEST membership, matching auth.ts (web) and
  // family-groups.service.ts#findMine. This select previously had NO
  // orderBy, so `memberships[0]` returned whatever order Postgres/Prisma
  // happened to return rows in (not guaranteed stable) — a third,
  // independent way of picking "the active group" from the two already
  // documented in the Evidence section.
  memberships: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      familyGroupId: true,
      role: true,
    },
  },
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    private readonly config: ConfigService<Env, true>,
    private readonly crypto: CryptoService,
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

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
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

      const fg = await tx.familyGroup.create({
        data: { name: `${dto.name}'s Family` },
      });

      await tx.member.create({
        data: { userId: created.id, familyGroupId: fg.id, role: "owner" },
      });

      // Provision the generic COA chart so every default category can be linked
      // to a COA account in the same group (EPIC-017: mandatory COA link).
      await tx.coaAccount.createMany({
        data: GENERIC_COA_CHART.map((c) => ({
          familyGroupId: fg.id,
          code: c.code,
          name: c.name,
          groupNum: c.groupNum,
          direction: c.direction,
          budgetType: c.budgetType,
        })),
      });
      const coaAccounts = await tx.coaAccount.findMany({
        where: { familyGroupId: fg.id },
        select: { id: true, code: true },
      });
      const coaIdByCode = new Map(coaAccounts.map((a) => [a.code, a.id]));

      await tx.category.createMany({
        data: DEFAULT_CATEGORIES.map((c) => {
          const code = defaultCoaCodeForCategory(c.kind, c.name);
          const coaAccountId = coaIdByCode.get(code);
          if (!coaAccountId) {
            throw new InternalServerErrorException(
              `Missing COA account "${code}" while provisioning registration`,
            );
          }
          return { ...c, familyGroupId: fg.id, coaAccountId };
        }),
      });

      // EPIC-024 A6 (D5, US-REK-1) — "Akun Utama" auto-create at
      // registration REMOVED: a new user starts with zero accounts and
      // adds their own, so their ledger contains only accounts that exist
      // in real life. Existing "Akun Utama" rows from before this change
      // are left untouched (no migration).

      // EPIC-024 Task J (D14, US-MD-1) — seed the seven reference lists
      // (bank, e-wallet, transaction type, investment type, donation
      // institution, asset category, insurance type) so `/masterdata` shows
      // real, deletable-by-owner data from day one instead of the old
      // hardcoded-array illusion.
      await tx.referenceItem.createMany({
        data: buildReferenceItemSeed().map((item) => ({
          ...item,
          familyGroupId: fg.id,
          isSystem: true,
        })),
      });

      return created;
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
        // EPIC-024 A3 (Evidence #1) — same "oldest membership wins" fix as
        // PROFILE_DETAIL_SELECT above; getMe() keeps its own separate
        // select (minimal fields) but must resolve familyGroupId the same
        // deterministic way.
        memberships: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            familyGroupId: true,
            role: true,
          },
        },
      },
    });
    return {
      ...user,
      familyGroupId: user.memberships[0]?.familyGroupId ?? null,
    };
  }

  /** Full profile including the extra fields getMe() intentionally omits. */
  async getProfileDetail(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: PROFILE_DETAIL_SELECT,
    });
    return {
      ...user,
      birthDate: user.birthDate ? this.crypto.decrypt(user.birthDate) : null,
      monthlyIncome: user.monthlyIncome
        ? this.crypto.decrypt(user.monthlyIncome)
        : null,
      notificationPrefs: resolveNotifPrefs(user.notificationPrefs),
      familyGroupId: user.memberships[0]?.familyGroupId ?? null,
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserProfile> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.avatarInitials !== undefined && {
          avatarInitials: dto.avatarInitials,
        }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.birthDate !== undefined && {
          birthDate: this.crypto.encrypt(dto.birthDate),
        }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.jobTitle !== undefined && { jobTitle: dto.jobTitle }),
        ...(dto.monthlyIncome !== undefined && {
          monthlyIncome: this.crypto.encrypt(dto.monthlyIncome),
        }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.notificationPrefs !== undefined && {
          notificationPrefs: resolveNotifPrefs(dto.notificationPrefs) as object,
        }),
      },
      select: PROFILE_DETAIL_SELECT,
    });
    return {
      ...updated,
      birthDate: updated.birthDate
        ? this.crypto.decrypt(updated.birthDate)
        : null,
      monthlyIncome: updated.monthlyIncome
        ? this.crypto.decrypt(updated.monthlyIncome)
        : null,
      notificationPrefs: resolveNotifPrefs(updated.notificationPrefs),
      familyGroupId: updated.memberships[0]?.familyGroupId ?? null,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const valid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!valid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const newHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    await this.prisma.baAccount.updateMany({
      where: { userId, providerId: "credential" },
      data: { password: newHash },
    });
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
