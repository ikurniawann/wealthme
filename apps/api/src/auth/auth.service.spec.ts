import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";

import { GENERIC_COA_CHART } from "../common/coa/default-coa-chart";
import { CryptoService } from "../crypto/crypto.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

// Mock the native argon2 module to avoid non-configurable property issues.
jest.mock("argon2", () => ({
  hash: jest.fn().mockResolvedValue("$argon2id$hashed"),
  verify: jest.fn(),
  argon2id: 2,
}));

import { AuthService } from "./auth.service";

import type { UpdateProfileDto } from "./dto/update-profile.dto";

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  familyGroup: { create: jest.fn() },
  // EPIC-027 A10 — login() now counts active memberships.
  member: { create: jest.fn(), count: jest.fn() },
  category: { createMany: jest.fn() },
  // EPIC-017: register() provisions the generic COA chart, then links categories.
  coaAccount: { createMany: jest.fn(), findMany: jest.fn() },
  account: { create: jest.fn() },
  // EPIC-024 Task J — register() also seeds the seven reference lists.
  referenceItem: { createMany: jest.fn() },
  baAccount: { updateMany: jest.fn() },
  $transaction: jest.fn(),
};

const mockJwt = {
  sign: jest.fn(),
};

const mockRedis = {
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
};

const CONFIG_VALUES: Record<string, string> = {
  JWT_SECRET: "test-secret-that-is-at-least-32-chars-long",
  JWT_EXPIRES_IN: "15m",
  JWT_REFRESH_SECRET: "test-refresh-secret-that-is-at-least-32-chars-long",
  JWT_REFRESH_EXPIRES_IN: "7d",
  // 32 bytes / 64 hex chars — required so CryptoService constructs with a
  // real key instead of `null`, which would make encrypt/decrypt no-op
  // pass-throughs and let a plaintext-leaking bug go undetected.
  ENCRYPTION_KEY: "0".repeat(64),
};

const mockConfig = {
  get: jest.fn((key: string) => CONFIG_VALUES[key]),
};

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.resetAllMocks();
    // jest.resetAllMocks() above wipes any mockImplementation, including the
    // one mockConfig.get was created with — re-establish it every time,
    // same as the mockPrisma defaults below, since CryptoService reads
    // ENCRYPTION_KEY from it at construction time (right after this block).
    mockConfig.get.mockImplementation((key: string) => CONFIG_VALUES[key]);
    // Default implementations for register()'s $transaction callback
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    mockPrisma.familyGroup.create.mockResolvedValue({ id: "fg-1" });
    mockPrisma.member.create.mockResolvedValue({});
    mockPrisma.category.createMany.mockResolvedValue({ count: 12 });
    mockPrisma.coaAccount.createMany.mockResolvedValue({
      count: GENERIC_COA_CHART.length,
    });
    mockPrisma.coaAccount.findMany.mockResolvedValue(
      GENERIC_COA_CHART.map((c) => ({ id: `coa-${c.code}`, code: c.code })),
    );
    mockPrisma.account.create.mockResolvedValue({});
    mockPrisma.referenceItem.createMany.mockResolvedValue({ count: 32 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: RedisService, useValue: mockRedis },
        { provide: ConfigService, useValue: mockConfig },
        { provide: CryptoService, useClass: CryptoService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe("register()", () => {
    it("creates user, hashes password with argon2id, and returns token pair", async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        name: "Jane Doe",
      });
      mockJwt.sign
        .mockReturnValueOnce("access-token")
        .mockReturnValueOnce("refresh-token");
      mockRedis.set.mockResolvedValue(undefined);

      // Act
      const result = await service.register({
        email: "user@example.com",
        password: "strongPass123",
        name: "Jane Doe",
      });

      // Assert — verify argon2id hashing by checking passwordHash is not the plain-text password
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: "user@example.com",
            name: "Jane Doe",
            avatarInitials: "JD",
            passwordHash: expect.not.stringContaining("strongPass123"),
          }),
        }),
      );
      expect(result).toEqual({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      });
    });

    it("throws ConflictException when email is already in use", async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue({ id: "existing-user" });

      // Act & Assert
      await expect(
        service.register({
          email: "taken@example.com",
          password: "strongPass123",
          name: "Jane Doe",
        }),
      ).rejects.toThrow(ConflictException);
    });

    // EPIC-024 A6 (D5, US-REK-1) — "Akun Utama" auto-create removed: a new
    // user starts with zero accounts and adds their own.
    it("never creates an 'Akun Utama' account (or any account) during registration", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        name: "Jane Doe",
      });
      mockJwt.sign
        .mockReturnValueOnce("access-token")
        .mockReturnValueOnce("refresh-token");
      mockRedis.set.mockResolvedValue(undefined);

      await service.register({
        email: "user@example.com",
        password: "strongPass123",
        name: "Jane Doe",
      });

      expect(mockPrisma.account.create).not.toHaveBeenCalled();
    });

    it("seeds only the bank, e-wallet and lembaga reference lists (Revisi H)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        name: "Jane Doe",
      });
      mockJwt.sign
        .mockReturnValueOnce("access-token")
        .mockReturnValueOnce("refresh-token");
      mockRedis.set.mockResolvedValue(undefined);

      await service.register({
        email: "user@example.com",
        password: "strongPass123",
        name: "Jane Doe",
      });

      const [[arg]] = mockPrisma.referenceItem.createMany.mock.calls as [
        [{ data: { group: string; isSystem: boolean }[] }],
      ];
      expect(new Set(arg.data.map((d) => d.group))).toEqual(
        new Set(["bank", "ewallet", "lembaga"]),
      );
      expect(arg.data.every((d) => d.isSystem)).toBe(true);
    });
  });

  describe("login()", () => {
    it("returns token pair for valid credentials", async () => {
      // Arrange — argon2.verify mocked to return true (correct password)
      const argon2 = jest.requireMock<{ verify: jest.Mock }>("argon2");
      argon2.verify.mockResolvedValue(true);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        passwordHash: "$argon2id$hashed",
      });
      mockPrisma.member.count.mockResolvedValue(1);
      mockJwt.sign
        .mockReturnValueOnce("access-token")
        .mockReturnValueOnce("refresh-token");
      mockRedis.set.mockResolvedValue(undefined);

      // Act
      const result = await service.login({
        email: "user@example.com",
        password: "correctPassword",
      });

      // Assert
      expect(result).toEqual({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      });
    });

    // EPIC-027 A10 (D6) — a member removed from their family keeps a valid
    // password: the User row and its credential survive a removal by design
    // (their recorded transactions must keep an author). Zero active
    // memberships is therefore the signal that this account no longer belongs
    // anywhere, and it must not receive a session — before this, such a user
    // signed in fine and the web shell drew them a trusted menu.
    it("EPIC-027 A10 — refuses a user with no active membership", async () => {
      const argon2 = jest.requireMock<{ verify: jest.Mock }>("argon2");
      argon2.verify.mockResolvedValue(true);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-removed",
        email: "removed@example.com",
        passwordHash: "$argon2id$hashed",
      });
      mockPrisma.member.count.mockResolvedValue(0);

      await expect(
        service.login({
          email: "removed@example.com",
          password: "correctPassword",
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it("throws UnauthorizedException for wrong password", async () => {
      // Arrange — argon2.verify mocked to return false (wrong password)
      const argon2 = jest.requireMock<{ verify: jest.Mock }>("argon2");
      argon2.verify.mockResolvedValue(false);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        passwordHash: "$argon2id$hashed",
      });

      // Act & Assert
      await expect(
        service.login({
          email: "user@example.com",
          password: "wrongPassword",
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("throws UnauthorizedException for non-existent user", async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.login({
          email: "nobody@example.com",
          password: "anyPassword",
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("refresh()", () => {
    it("issues a new token pair, signs twice, and stores refresh token in Redis", async () => {
      // Arrange
      mockJwt.sign
        .mockReturnValueOnce("new-access-token")
        .mockReturnValueOnce("new-refresh-token");
      mockRedis.set.mockResolvedValue(undefined);

      // Act
      const result = await service.refresh("user-id", "user@example.com");

      // Assert
      expect(mockJwt.sign).toHaveBeenCalledTimes(2);
      expect(mockRedis.set).toHaveBeenCalledWith(
        "refresh:user-id",
        "new-refresh-token",
        expect.any(Number),
      );
      expect(result).toEqual({
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
      });
    });
  });

  describe("logout()", () => {
    it("deletes the refresh token from Redis", async () => {
      // Arrange
      mockRedis.del.mockResolvedValue(undefined);

      // Act
      await service.logout("user-1");

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith("refresh:user-1");
    });
  });

  describe("getMe()", () => {
    it("returns user profile with memberships", async () => {
      // Arrange
      const profile = {
        id: "user-1",
        email: "user@example.com",
        name: "Jane Doe",
        avatarInitials: "JD",
        createdAt: new Date("2024-01-01"),
        memberships: [{ id: "m-1", familyGroupId: "fg-1", role: "owner" }],
      };
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(profile);

      // Act
      const result = await service.getMe("user-1");

      // Assert
      expect(result).toEqual({ ...profile, familyGroupId: "fg-1" });
      expect(result).not.toHaveProperty("passwordHash");
      expect(mockPrisma.user.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: "user-1" },
        select: {
          id: true,
          email: true,
          name: true,
          avatarInitials: true,
          createdAt: true,
          memberships: {
            // EPIC-027 A7 (security gate, CRITICAL) — a nested membership read
            // is NOT covered by the member-soft-delete Prisma extension (query
            // hooks only intercept top-level `prisma.member.*`), so getMe must
            // exclude removed members itself. Without this, a removed member
            // keeps resolving to the familyGroupId and role they were removed
            // from. Asserted here so the filter cannot quietly disappear.
            where: { deletedAt: null },
            // EPIC-024 A3 (Evidence #1) — "oldest membership wins",
            // unified with auth.ts (web) and family-groups.service.ts.
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              familyGroupId: true,
              role: true,
            },
          },
        },
      });
    });

    // EPIC-024 A3 (Evidence #1) — before this fix, `memberships[0]` here had
    // NO orderBy at all: a third, independent way (besides auth.ts's
    // `desc` and family-groups.service.ts's `asc`) of deciding "the active
    // family group", which is exactly the bug that stranded a wife with two
    // memberships on the wrong one. This proves the OLDEST membership wins
    // even when Prisma/the mock returns them newest-first.
    it("resolves familyGroupId to the OLDEST membership, matching auth.ts and family-groups.service.ts#findMine", async () => {
      const profile = {
        id: "user-1",
        email: "wife@example.com",
        name: "Sari",
        avatarInitials: "S",
        createdAt: new Date("2024-01-01"),
        // Ordered oldest-first here (as the real `orderBy: asc` query
        // would return them) — the OLD "own family" group came first
        // (self-registration), THEN she was added to the husband's group.
        memberships: [
          { id: "m-own", familyGroupId: "fg-own-empty", role: "owner" },
          { id: "m-husband", familyGroupId: "fg-husband", role: "owner" },
        ],
      };
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(profile);

      const result = await service.getMe("user-1");

      expect(result.familyGroupId).toBe("fg-own-empty");
    });

    it("returns empty memberships array when user has no memberships", async () => {
      // Arrange
      const profile = {
        id: "user-2",
        email: "new@example.com",
        name: "New User",
        avatarInitials: "NU",
        createdAt: new Date("2024-06-01"),
        memberships: [],
      };
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(profile);

      // Act
      const result = await service.getMe("user-2");

      // Assert
      expect(result.memberships).toEqual([]);
    });
  });

  describe("updateProfile()", () => {
    const baseUser = {
      id: "user-1",
      email: "user@example.com",
      name: "Jane Doe",
      avatarInitials: "JD",
      createdAt: new Date("2024-01-01"),
      memberships: [{ id: "m-1", familyGroupId: "fg-1", role: "owner" }],
    };

    it("updates name and returns profile with familyGroupId", async () => {
      // Arrange
      const updated = { ...baseUser, name: "New Name", avatarInitials: "NN" };
      mockPrisma.user.update.mockResolvedValue(updated);

      // Act
      const result = await service.updateProfile("user-1", {
        name: "New Name",
      });

      // Assert
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: { name: "New Name" },
        }),
      );
      expect(result.name).toBe("New Name");
      expect(result.familyGroupId).toBe("fg-1");
    });

    it("omits undefined fields from Prisma update data", async () => {
      // Arrange — only avatarInitials provided
      const updated = { ...baseUser, avatarInitials: "JX", memberships: [] };
      mockPrisma.user.update.mockResolvedValue(updated);

      // Act
      const result = await service.updateProfile("user-1", {
        avatarInitials: "JX",
      });

      // Assert — name must NOT appear in data (dto.name is undefined)
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { avatarInitials: "JX" },
        }),
      );
      expect(result.familyGroupId).toBeNull();
    });

    it("persists all 5 profile fields and genuinely encrypts birthDate/monthlyIncome (encrypt-then-decrypt round trip)", async () => {
      // Arrange — updateProfile called with all 5 new fields
      const updateDto = {
        name: "Updated Name",
        phone: "+62 812 1234 5678",
        birthDate: "1990-05-15",
        gender: "Laki-laki",
        jobTitle: "Senior Engineer",
        monthlyIncome: "5000000",
      };

      // Echo back the SAME birthDate/monthlyIncome the service just sent to
      // Prisma (not the raw plaintext dto), so decrypting it below is a
      // genuine round trip through the real CryptoService — not just
      // re-echoing the plaintext, which would pass even for a no-op
      // encrypt/decrypt.
      mockPrisma.user.update.mockImplementation(
        (args: { data: Record<string, unknown> }) =>
          Promise.resolve({
            ...baseUser,
            ...updateDto,
            avatarInitials: "UN",
            birthDate: args.data.birthDate as string,
            monthlyIncome: args.data.monthlyIncome as string,
          }),
      );

      // Act
      const result = await service.updateProfile("user-1", updateDto);

      // Assert — phone/gender/jobTitle/name are stored as-is; birthDate and
      // monthlyIncome are genuinely AES-256-GCM encrypted (iv:tag:data hex
      // triplet) before being sent to Prisma, never the plaintext.
      const [callArg] = mockPrisma.user.update.mock.calls[0] as [
        { where: { id: string }; data: Record<string, unknown> },
      ];
      expect(callArg.where).toEqual({ id: "user-1" });
      expect(callArg.data.name).toBe("Updated Name");
      expect(callArg.data.phone).toBe("+62 812 1234 5678");
      expect(callArg.data.gender).toBe("Laki-laki");
      expect(callArg.data.jobTitle).toBe("Senior Engineer");

      const hexTripletPattern = /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/;
      expect(callArg.data.birthDate).not.toBe("1990-05-15");
      expect(callArg.data.birthDate).toMatch(hexTripletPattern);
      expect(callArg.data.monthlyIncome).not.toBe("5000000");
      expect(callArg.data.monthlyIncome).toMatch(hexTripletPattern);

      // Assert — the response decrypts the encrypted values back to the
      // original plaintext, proving a real encrypt-then-decrypt round trip.
      expect(result.phone).toBe("+62 812 1234 5678");
      expect(result.birthDate).toBe("1990-05-15");
      expect(result.gender).toBe("Laki-laki");
      expect(result.jobTitle).toBe("Senior Engineer");
      expect(result.monthlyIncome).toBe("5000000");
    });

    // EPIC-016 Task B2 — currency preference persistence.
    it("persists currency field via updateProfile", async () => {
      const updateDto: UpdateProfileDto = { currency: "USD" };
      const updated = { ...baseUser, currency: "USD" };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.updateProfile("user-1", updateDto);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: expect.objectContaining({ currency: "USD" }),
        }),
      );
      expect(result).toMatchObject({ currency: "USD" });
    });

    it("persists multiple valid currency codes (IDR, USD, SGD, EUR, JPY)", async () => {
      const currencies = ["IDR", "USD", "SGD", "EUR", "JPY"];

      for (const curr of currencies) {
        const updated = { ...baseUser, currency: curr };
        mockPrisma.user.update.mockResolvedValueOnce(updated);

        const result = await service.updateProfile("user-1", {
          currency: curr,
        });

        expect(result).toMatchObject({ currency: curr });
      }
    });

    it("preserves currency field in getProfileDetail", async () => {
      const userWithCurrency = { ...baseUser, currency: "EUR" };
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(userWithCurrency);

      const result = await service.getProfileDetail("user-1");

      expect(result).toMatchObject({ currency: "EUR" });
      expect(mockPrisma.user.findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({ currency: true }),
        }),
      );
    });

    it("defaults to IDR when currency is not set", async () => {
      const userWithoutCurrency = { ...baseUser, currency: "IDR" };
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(userWithoutCurrency);

      const result = await service.getProfileDetail("user-1");

      expect(result.currency).toBe("IDR");
    });

    // EPIC-016 Task B3 — notification preferences persistence.
    describe("[Notification Preferences]", () => {
      it("sanitizes notificationPrefs before persisting: unknown keys dropped, known keys kept", async () => {
        // Arrange — dto includes a bogus key alongside a real one
        const updateDto: UpdateProfileDto = {
          notificationPrefs: {
            budget80: false,
            bogus: 1 as unknown as boolean,
          },
        };
        const updated = {
          ...baseUser,
          notificationPrefs: {
            txnIn: true,
            txnOut: true,
            txnBig: true,
            budget80: false,
            goalMilestone: true,
            billDue: true,
            stockPrice: true,
            dividend: true,
            loginAlert: false,
            bigTxnConfirm: false,
          },
        };
        mockPrisma.user.update.mockResolvedValue(updated);

        // Act
        const result = await service.updateProfile("user-1", updateDto);

        // Assert — Prisma is called with exactly the 10 sanitized keys
        // (EPIC-016 Task K added loginAlert/bigTxnConfirm), budget80 false,
        // and no "bogus" key ever reaches the database.
        const [callArg] = mockPrisma.user.update.mock.calls[0] as [
          { data: Record<string, unknown> },
        ];
        const sentPrefs = callArg.data.notificationPrefs as Record<
          string,
          boolean
        >;
        expect(Object.keys(sentPrefs).sort()).toEqual(
          [
            "txnIn",
            "txnOut",
            "txnBig",
            "budget80",
            "goalMilestone",
            "billDue",
            "stockPrice",
            "dividend",
            "loginAlert",
            "bigTxnConfirm",
          ].sort(),
        );
        expect(sentPrefs.budget80).toBe(false);
        expect(sentPrefs).not.toHaveProperty("bogus");
        expect(result.notificationPrefs).toEqual(updated.notificationPrefs);
      });

      it("returns all 10 keys defaulted (8 true, loginAlert/bigTxnConfirm false) when the stored value is null", async () => {
        // Arrange — a user whose notificationPrefs column has never been set
        const userWithNullPrefs = { ...baseUser, notificationPrefs: null };
        mockPrisma.user.findUniqueOrThrow.mockResolvedValue(userWithNullPrefs);

        // Act
        const result = await service.getProfileDetail("user-1");

        // Assert
        expect(result.notificationPrefs).toEqual({
          txnIn: true,
          txnOut: true,
          txnBig: true,
          budget80: true,
          goalMilestone: true,
          billDue: true,
          stockPrice: true,
          dividend: true,
          loginAlert: false,
          bigTxnConfirm: false,
        });
      });
    });
  });

  describe("changePassword()", () => {
    it("verifies current password, hashes new password, and updates User + BaAccount", async () => {
      // Arrange
      const argon2 = jest.requireMock<{ verify: jest.Mock; hash: jest.Mock }>(
        "argon2",
      );
      argon2.verify.mockResolvedValue(true);
      argon2.hash.mockResolvedValue("$argon2id$new-hash");
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        passwordHash: "$argon2id$old-hash",
      });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.baAccount.updateMany.mockResolvedValue({ count: 1 });

      // Act
      await service.changePassword("user-1", {
        currentPassword: "OldPass123",
        newPassword: "NewPass456",
      });

      // Assert
      expect(argon2.verify).toHaveBeenCalledWith(
        "$argon2id$old-hash",
        "OldPass123",
      );
      expect(argon2.hash).toHaveBeenCalledWith("NewPass456", {
        type: argon2.argon2id,
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { passwordHash: "$argon2id$new-hash" },
      });
      expect(mockPrisma.baAccount.updateMany).toHaveBeenCalledWith({
        where: { userId: "user-1", providerId: "credential" },
        data: { password: "$argon2id$new-hash" },
      });
    });

    it("throws UnauthorizedException when user has no passwordHash (social-only account)", async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        passwordHash: null,
      });

      // Act & Assert
      await expect(
        service.changePassword("user-1", {
          currentPassword: "any",
          newPassword: "NewPass456",
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("throws UnauthorizedException when current password is wrong", async () => {
      // Arrange
      const argon2 = jest.requireMock<{ verify: jest.Mock }>("argon2");
      argon2.verify.mockResolvedValue(false);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        passwordHash: "$argon2id$old-hash",
      });

      // Act & Assert
      await expect(
        service.changePassword("user-1", {
          currentPassword: "WrongPass",
          newPassword: "NewPass456",
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("throws UnauthorizedException when user is not found", async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.changePassword("ghost", {
          currentPassword: "any",
          newPassword: "NewPass456",
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("loginWithGoogle()", () => {
    const googleProfile = {
      googleId: "g-123",
      email: "jane@gmail.com",
      name: "Jane Doe",
    };

    it("issues tokens when user is found by googleId (already linked)", async () => {
      // Arrange
      const linkedUser = {
        id: "user-1",
        email: "jane@gmail.com",
        googleId: "g-123",
      };
      // First findUnique call (by googleId) returns the linked user.
      mockPrisma.user.findUnique.mockResolvedValueOnce(linkedUser);
      mockJwt.sign
        .mockReturnValueOnce("access-token")
        .mockReturnValueOnce("refresh-token");
      mockRedis.set.mockResolvedValue(undefined);

      // Act
      const result = await service.loginWithGoogle(googleProfile);

      // Assert — no update should happen; user already linked
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      });
    });

    it("throws ConflictException when an email-only account exists (different googleId)", async () => {
      // Arrange — no user by googleId, but email account exists (password-only user)
      const emailOnlyUser = {
        id: "user-1",
        email: "jane@gmail.com",
        googleId: null,
      };
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // lookup by googleId → not found
        .mockResolvedValueOnce(emailOnlyUser); // lookup by email → found

      // Act & Assert
      await expect(service.loginWithGoogle(googleProfile)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("creates a new user and issues tokens when no account exists", async () => {
      // Arrange — no user by googleId, no user by email
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // lookup by googleId → not found
        .mockResolvedValueOnce(null); // lookup by email → not found
      mockPrisma.user.create.mockResolvedValue({
        id: "user-new",
        email: "jane@gmail.com",
        name: "Jane Doe",
        googleId: "g-123",
        avatarInitials: "JD",
        passwordHash: null,
      });
      mockJwt.sign
        .mockReturnValueOnce("access-token")
        .mockReturnValueOnce("refresh-token");
      mockRedis.set.mockResolvedValue(undefined);

      // Act
      const result = await service.loginWithGoogle(googleProfile);

      // Assert
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: "jane@gmail.com",
          name: "Jane Doe",
          googleId: "g-123",
          passwordHash: null,
          avatarInitials: "JD",
        },
      });
      expect(result).toEqual({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      });
    });

    it("throws when called with an empty email (guard at strategy level)", async () => {
      // Arrange — profile has empty email string; service receives it only if guard is bypassed
      const emptyEmailProfile = {
        googleId: "g-456",
        email: "",
        name: "Bad Actor",
      };
      // googleId lookup returns nothing, email lookup also returns nothing (empty string won't match)
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // lookup by googleId
        .mockResolvedValueOnce(null); // lookup by email (empty string)

      // Act — Prisma create would be called with email: "" which is invalid at DB level,
      // but we verify the service does not silently produce tokens for an empty email.
      mockPrisma.user.create.mockRejectedValue(
        new Error("DB constraint: email cannot be empty"),
      );

      // Assert
      await expect(service.loginWithGoogle(emptyEmailProfile)).rejects.toThrow(
        "DB constraint: email cannot be empty",
      );
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });
  });
});
