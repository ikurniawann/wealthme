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
    it("returns user profile without passwordHash", async () => {
      // Arrange
      const profile = {
        id: "user-1",
        email: "user@example.com",
        name: "Jane Doe",
        avatarInitials: "JD",
        createdAt: new Date("2024-01-01"),
      };
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(profile);

      // Act
      const result = await service.getMe("user-1");

      // Assert
      expect(result).toEqual(profile);
      expect(result).not.toHaveProperty("passwordHash");
      expect(mockPrisma.user.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: "user-1" },
        select: {
          id: true,
          email: true,
          name: true,
          avatarInitials: true,
          createdAt: true,
        },
      });
    });
  });
});
