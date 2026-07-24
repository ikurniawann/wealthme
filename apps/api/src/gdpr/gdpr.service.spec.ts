import { Test, type TestingModule } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";

import { GdprService } from "./gdpr.service";

// EPIC-016 Task D — this service pre-existed but had never been wired to any
// frontend control (no test coverage either). It's now the endpoint behind
// `/akun`'s real "Ekspor Data Saya" button, so it's covered here for the
// first time.
const mockPrisma = {
  user: {
    findUniqueOrThrow: jest.fn(),
    delete: jest.fn(),
  },
  member: {
    findMany: jest.fn(),
  },
  account: {
    findMany: jest.fn(),
  },
  transaction: {
    findMany: jest.fn(),
  },
  goal: {
    findMany: jest.fn(),
  },
  notification: {
    findMany: jest.fn(),
  },
};

describe("GdprService", () => {
  let service: GdprService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GdprService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<GdprService>(GdprService);
  });

  describe("exportUserData()", () => {
    it("returns the user's real profile, accounts, transactions, goals & notifications — scoped to their own family groups", async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        name: "Test User",
        avatarInitials: "TU",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      mockPrisma.member.findMany.mockResolvedValue([
        {
          familyGroupId: "fg-1",
          role: "owner",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);
      mockPrisma.account.findMany.mockResolvedValue([
        {
          id: "acc-1",
          name: "BCA Tahapan",
          type: "bank",
          balance: { toString: () => "1000000" },
          currency: "IDR",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
        },
      ]);
      mockPrisma.transaction.findMany.mockResolvedValue([
        {
          id: "txn-1",
          description: "Gaji",
          amount: { toString: () => "5000000" },
          type: "income",
          occurredAt: new Date("2026-01-03T00:00:00.000Z"),
        },
      ]);
      mockPrisma.goal.findMany.mockResolvedValue([
        {
          id: "goal-1",
          name: "Dana Darurat",
          targetAmount: { toString: () => "10000000" },
          currentAmount: { toString: () => "2000000" },
          status: "active",
        },
      ]);
      mockPrisma.notification.findMany.mockResolvedValue([]);

      const result = await service.exportUserData("user-1");

      expect(mockPrisma.user.findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "user-1" } }),
      );
      expect(mockPrisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { familyGroupId: { in: ["fg-1"] } },
        }),
      );
      expect(result.user).toEqual(
        expect.objectContaining({ id: "user-1", email: "user@example.com" }),
      );
      expect(result.accounts).toEqual([
        expect.objectContaining({ id: "acc-1", balance: "1000000" }),
      ]);
      expect(result.transactions).toEqual([
        expect.objectContaining({ id: "txn-1", amount: "5000000" }),
      ]);
      expect(result.goals).toEqual([
        expect.objectContaining({
          id: "goal-1",
          targetAmount: "10000000",
          currentAmount: "2000000",
        }),
      ]);
      expect(result.exportedAt).toEqual(expect.any(String));
    });

    it("returns empty collections (not an error) for a user with no family group memberships", async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        id: "user-2",
        email: "solo@example.com",
        name: "Solo User",
        avatarInitials: "SU",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      mockPrisma.member.findMany.mockResolvedValue([]);
      mockPrisma.account.findMany.mockResolvedValue([]);
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.goal.findMany.mockResolvedValue([]);
      mockPrisma.notification.findMany.mockResolvedValue([]);

      const result = await service.exportUserData("user-2");

      expect(mockPrisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { familyGroupId: { in: [] } } }),
      );
      expect(result.accounts).toEqual([]);
      expect(result.transactions).toEqual([]);
      expect(result.goals).toEqual([]);
      expect(result.memberships).toEqual([]);
    });

    // Regression: EPIC-016 Task D attempt 3 — a plain `member` could
    // previously export every account/transaction in their family group,
    // including ones an owner marked `isPrivate` specifically to hide from
    // them. The export must now apply the same privacy filter every other
    // read path applies (accounts.service.ts, transactions.service.ts, ...).
    it("excludes private accounts/transactions from a `member`-role caller's export", async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        id: "user-member",
        email: "member@example.com",
        name: "Plain Member",
        avatarInitials: "PM",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      mockPrisma.member.findMany.mockResolvedValue([
        {
          familyGroupId: "fg-1",
          role: "member",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);
      // The mock returns whatever is given regardless of the `where` clause
      // — the assertions below verify the service asked Prisma to exclude
      // private rows, which is the actual enforcement point.
      mockPrisma.account.findMany.mockResolvedValue([]);
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.goal.findMany.mockResolvedValue([]);
      mockPrisma.notification.findMany.mockResolvedValue([]);

      await service.exportUserData("user-member");

      expect(mockPrisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            familyGroupId: { in: ["fg-1"] },
            isPrivate: false,
          },
        }),
      );
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            familyGroupId: { in: ["fg-1"] },
            account: { isPrivate: false },
            OR: [{ categoryId: null }, { category: { isPrivate: false } }],
          },
        }),
      );
    });

    it("still returns every account/transaction for an `owner`-role caller (backward compatible)", async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        id: "user-owner",
        email: "owner@example.com",
        name: "Owner",
        avatarInitials: "OW",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      mockPrisma.member.findMany.mockResolvedValue([
        {
          familyGroupId: "fg-1",
          role: "owner",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);
      mockPrisma.account.findMany.mockResolvedValue([]);
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.goal.findMany.mockResolvedValue([]);
      mockPrisma.notification.findMany.mockResolvedValue([]);

      await service.exportUserData("user-owner");

      expect(mockPrisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { familyGroupId: { in: ["fg-1"] } },
        }),
      );
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { familyGroupId: { in: ["fg-1"] } },
        }),
      );
    });

    it("applies per-group privacy visibility when the caller is `owner` in one family group and `member` in another", async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        id: "user-dual",
        email: "dual@example.com",
        name: "Dual Role User",
        avatarInitials: "DR",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      mockPrisma.member.findMany.mockResolvedValue([
        {
          familyGroupId: "fg-owner",
          role: "owner",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        {
          familyGroupId: "fg-member",
          role: "member",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);
      mockPrisma.account.findMany.mockResolvedValue([]);
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.goal.findMany.mockResolvedValue([]);
      mockPrisma.notification.findMany.mockResolvedValue([]);

      await service.exportUserData("user-dual");

      expect(mockPrisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { familyGroupId: { in: ["fg-owner"] } },
              {
                familyGroupId: { in: ["fg-member"] },
                isPrivate: false,
              },
            ],
          },
        }),
      );
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { familyGroupId: { in: ["fg-owner"] } },
              {
                familyGroupId: { in: ["fg-member"] },
                account: { isPrivate: false },
                OR: [{ categoryId: null }, { category: { isPrivate: false } }],
              },
            ],
          },
        }),
      );
    });
  });
});
