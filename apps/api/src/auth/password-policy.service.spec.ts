import { UnauthorizedException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import * as argon2 from "argon2";

import { PrismaService } from "../prisma/prisma.service";

import { PasswordPolicyService } from "./password-policy.service";

const USER_ID = "user-dependant-1";
const ACCOUNT_ID = "ba-1";

describe("PasswordPolicyService (EPIC-023 D1)", () => {
  let service: PasswordPolicyService;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    baAccount: { findFirst: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      baAccount: { findFirst: jest.fn(), update: jest.fn() },
      $transaction: jest.fn(async (ops: Array<Promise<unknown>>) =>
        Promise.all(ops),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordPolicyService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(PasswordPolicyService);
  });

  describe("getStatus", () => {
    it("returns mustChangePassword: true when set", async () => {
      prisma.user.findUnique.mockResolvedValue({ mustChangePassword: true });
      await expect(service.getStatus(USER_ID)).resolves.toEqual({
        mustChangePassword: true,
      });
    });

    it("returns mustChangePassword: false for a normal (pre-existing) account", async () => {
      prisma.user.findUnique.mockResolvedValue({ mustChangePassword: false });
      await expect(service.getStatus(USER_ID)).resolves.toEqual({
        mustChangePassword: false,
      });
    });

    it("defaults to false when the user row is missing", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getStatus(USER_ID)).resolves.toEqual({
        mustChangePassword: false,
      });
    });
  });

  describe("setPassword", () => {
    it("rejects when the account has no credential row at all", async () => {
      prisma.baAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.setPassword(USER_ID, {
          currentPassword: "whatever",
          newPassword: "newPassword1",
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    // Real (unmocked) argon2 round trip — adversarial-tier: proves the
    // rejection is a genuine crypto mismatch, not a mock that always agrees.
    it("rejects the wrong current password against a REAL argon2 hash", async () => {
      const realHash = await argon2.hash("theRealInitialPassword1", {
        type: argon2.argon2id,
      });
      prisma.baAccount.findFirst.mockResolvedValue({
        id: ACCOUNT_ID,
        password: realHash,
      });

      await expect(
        service.setPassword(USER_ID, {
          currentPassword: "totallyWrongGuess",
          newPassword: "newPassword1",
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    }, 15000);

    it("accepts the correct current password (REAL argon2 verify) and writes a NEW hash that itself verifies", async () => {
      const realHash = await argon2.hash("theRealInitialPassword1", {
        type: argon2.argon2id,
      });
      prisma.baAccount.findFirst.mockResolvedValue({
        id: ACCOUNT_ID,
        password: realHash,
      });

      await service.setPassword(USER_ID, {
        currentPassword: "theRealInitialPassword1",
        newPassword: "myBrandNewPassword1",
      });

      expect(prisma.baAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ACCOUNT_ID } }),
      );
      const updateArgs = prisma.baAccount.update.mock.calls[0][0] as {
        data: { password: string };
      };
      const newHash = updateArgs.data.password;
      expect(newHash).not.toBe(realHash);

      // The NEW hash genuinely verifies the NEW password (real argon2, not
      // mocked) — proves this isn't a placeholder/no-op write.
      await expect(argon2.verify(newHash, "myBrandNewPassword1")).resolves.toBe(
        true,
      );
      await expect(
        argon2.verify(newHash, "theRealInitialPassword1"),
      ).resolves.toBe(false);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { mustChangePassword: false },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    }, 15000);
  });
});
