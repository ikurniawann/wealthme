import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

// Mock the native argon2 module to avoid non-configurable property issues.
jest.mock("argon2", () => ({
  hash: jest.fn().mockResolvedValue("$argon2id$hashed"),
  verify: jest.fn(),
  argon2id: 2,
}));

import { AuthService } from "./auth.service";

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockJwt = {
  sign: jest.fn(),
};

const mockRedis = {
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string) => {
    const values: Record<string, string> = {
      JWT_SECRET: "test-secret-that-is-at-least-32-chars-long",
      JWT_EXPIRES_IN: "15m",
      JWT_REFRESH_SECRET: "test-refresh-secret-that-is-at-least-32-chars-long",
      JWT_REFRESH_EXPIRES_IN: "7d",
    };
    return values[key];
  }),
};

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: RedisService, useValue: mockRedis },
        { provide: ConfigService, useValue: mockConfig },
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
    it("returns user profile with familyGroupId from first membership", async () => {
      // Arrange
      const profile = {
        id: "user-1",
        email: "user@example.com",
        name: "Jane Doe",
        avatarInitials: "JD",
        createdAt: new Date("2024-01-01"),
        memberships: [{ familyGroupId: "fg-1" }],
      };
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(profile);

      // Act
      const result = await service.getMe("user-1");

      // Assert
      expect(result).toEqual({
        id: "user-1",
        email: "user@example.com",
        name: "Jane Doe",
        avatarInitials: "JD",
        createdAt: new Date("2024-01-01"),
        familyGroupId: "fg-1",
      });
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
            select: { familyGroupId: true },
            take: 1,
            orderBy: { createdAt: "asc" },
          },
        },
      });
    });

    it("returns familyGroupId as null when user has no memberships", async () => {
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
      expect(result.familyGroupId).toBeNull();
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
