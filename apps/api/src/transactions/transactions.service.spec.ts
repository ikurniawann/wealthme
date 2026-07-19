import { NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { CATEGORIZATION_PORT } from "../categorization/categorization.port";
import { NOTIFICATION_SENDER_PORT } from "../notifications/notification-sender.port";
import { PrismaService } from "../prisma/prisma.service";

import { OCR_PORT } from "./ocr/ocr.port";
import { TransactionsService } from "./transactions.service";

const FAMILY_GROUP_ID = "fg-test-uuid";
const ACCOUNT_ID = "acc-test-uuid";

const mockAccount = { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID };

function makePrisma() {
  return {
    account: { findUnique: jest.fn(), update: jest.fn() },
    category: { findUnique: jest.fn(), findMany: jest.fn() },
    budget: { findFirst: jest.fn() },
    member: { findFirst: jest.fn() },
    notification: { findFirst: jest.fn(), create: jest.fn() },
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

describe("TransactionsService", () => {
  let service: TransactionsService;
  let prisma: ReturnType<typeof makePrisma>;
  let notificationSender: { send: jest.Mock; sendEmail: jest.Mock };

  beforeEach(async () => {
    prisma = makePrisma();
    notificationSender = { send: jest.fn(), sendEmail: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: OCR_PORT, useValue: { extractFromBase64: jest.fn() } },
        {
          provide: CATEGORIZATION_PORT,
          useValue: { suggest: jest.fn().mockResolvedValue(null) },
        },
        { provide: NOTIFICATION_SENDER_PORT, useValue: notificationSender },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  describe("create", () => {
    it("throws NotFoundException when accountId is not in the family group", async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(
        service.create(FAMILY_GROUP_ID, {
          accountId: ACCOUNT_ID,
          amount: 50000,
          type: "expense",
          occurredAt: new Date().toISOString(),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("creates an expense transaction and returns DTO with correct fields", async () => {
      const now = new Date("2026-06-15T10:00:00.000Z");
      const createdTx = {
        id: "tx-uuid-1",
        familyGroupId: FAMILY_GROUP_ID,
        accountId: ACCOUNT_ID,
        categoryId: null,
        amount: BigInt(50000),
        type: "expense" as const,
        description: "Makan siang",
        occurredAt: now,
        createdAt: now,
      };

      prisma.account.findUnique.mockResolvedValue(mockAccount);
      prisma.category.findMany.mockResolvedValue([]);
      prisma.$transaction.mockImplementation(
        async (fn: Parameters<typeof prisma.$transaction>[0]) => {
          const innerPrisma = {
            ...prisma,
            transaction: {
              ...prisma.transaction,
              create: jest.fn().mockResolvedValue(createdTx),
            },
          };
          return (fn as (p: typeof innerPrisma) => Promise<unknown>)(
            innerPrisma,
          );
        },
      );

      const result = await service.create(FAMILY_GROUP_ID, {
        accountId: ACCOUNT_ID,
        amount: 50000,
        type: "expense",
        description: "Makan siang",
        occurredAt: now.toISOString(),
      });

      expect(result).toMatchObject({
        id: "tx-uuid-1",
        familyGroupId: FAMILY_GROUP_ID,
        accountId: ACCOUNT_ID,
        amount: "50000",
        type: "expense",
        description: "Makan siang",
      });
    });

    it("creates an income transaction with correct type", async () => {
      const now = new Date("2026-06-15T10:00:00.000Z");
      const createdTx = {
        id: "tx-uuid-2",
        familyGroupId: FAMILY_GROUP_ID,
        accountId: ACCOUNT_ID,
        categoryId: null,
        amount: BigInt(5000000),
        type: "income" as const,
        description: "Gaji bulan Juni",
        occurredAt: now,
        createdAt: now,
      };

      prisma.account.findUnique.mockResolvedValue(mockAccount);
      prisma.$transaction.mockImplementation(
        async (fn: Parameters<typeof prisma.$transaction>[0]) => {
          const innerPrisma = {
            ...prisma,
            transaction: {
              ...prisma.transaction,
              create: jest.fn().mockResolvedValue(createdTx),
            },
          };
          return (fn as (p: typeof innerPrisma) => Promise<unknown>)(
            innerPrisma,
          );
        },
      );

      const result = await service.create(FAMILY_GROUP_ID, {
        accountId: ACCOUNT_ID,
        amount: 5000000,
        type: "income",
        description: "Gaji bulan Juni",
        occurredAt: now.toISOString(),
      });

      expect(result.type).toBe("income");
      expect(result.amount).toBe("5000000");
    });
  });

  describe("checkCashFlowAlert (via create)", () => {
    const now = new Date("2026-06-15T10:00:00.000Z");

    function setupExpenseCreate() {
      const createdTx = {
        id: "tx-cf-1",
        familyGroupId: FAMILY_GROUP_ID,
        accountId: ACCOUNT_ID,
        categoryId: null,
        amount: BigInt(4970000),
        type: "expense" as const,
        description: "Pengeluaran",
        occurredAt: now,
        createdAt: now,
      };
      prisma.account.findUnique.mockResolvedValue(mockAccount);
      prisma.category.findMany.mockResolvedValue([]);
      prisma.$transaction.mockImplementation(
        async (fn: Parameters<typeof prisma.$transaction>[0]) => {
          const innerPrisma = {
            ...prisma,
            transaction: {
              ...prisma.transaction,
              create: jest.fn().mockResolvedValue(createdTx),
            },
          };
          return (fn as (p: typeof innerPrisma) => Promise<unknown>)(
            innerPrisma,
          );
        },
      );
    }

    it("creates notification when monthly expenses >= 80% of income", async () => {
      setupExpenseCreate();
      prisma.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: BigInt(5000000) } })
        .mockResolvedValueOnce({ _sum: { amount: BigInt(4970000) } });
      prisma.notification.findFirst.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue({});

      await service.create(FAMILY_GROUP_ID, {
        accountId: ACCOUNT_ID,
        amount: 4970000,
        type: "expense",
        occurredAt: now.toISOString(),
      });
      await new Promise((r) => setTimeout(r, 0));

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            familyGroupId: FAMILY_GROUP_ID,
            icon: "⚠️",
          }),
        }),
      );
    });

    it("skips notification when expenses < 80% of income", async () => {
      setupExpenseCreate();
      prisma.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: BigInt(5000000) } })
        .mockResolvedValueOnce({ _sum: { amount: BigInt(1000000) } });
      prisma.notification.findFirst.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue({});

      await service.create(FAMILY_GROUP_ID, {
        accountId: ACCOUNT_ID,
        amount: 1000000,
        type: "expense",
        occurredAt: now.toISOString(),
      });
      await new Promise((r) => setTimeout(r, 0));

      // EPIC-016 Task B3 — every expense also fires an unrelated
      // txnOut notification (default-on preference), so assert the
      // cash-flow-specific alert (icon "⚠️") was skipped, not that
      // notification.create was never called at all.
      expect(prisma.notification.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ icon: "⚠️" }),
        }),
      );
    });

    it("skips notification when income is zero", async () => {
      setupExpenseCreate();
      prisma.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: BigInt(0) } })
        .mockResolvedValueOnce({ _sum: { amount: BigInt(4970000) } });
      prisma.notification.findFirst.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue({});

      await service.create(FAMILY_GROUP_ID, {
        accountId: ACCOUNT_ID,
        amount: 4970000,
        type: "expense",
        occurredAt: now.toISOString(),
      });
      await new Promise((r) => setTimeout(r, 0));

      // See note above — only the cash-flow-specific alert is asserted here.
      expect(prisma.notification.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ icon: "⚠️" }),
        }),
      );
    });

    it("skips notification when one was already sent today", async () => {
      setupExpenseCreate();
      prisma.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: BigInt(5000000) } })
        .mockResolvedValueOnce({ _sum: { amount: BigInt(4970000) } });
      prisma.notification.findFirst.mockResolvedValue({ id: "existing-notif" });
      prisma.notification.create.mockResolvedValue({});

      await service.create(FAMILY_GROUP_ID, {
        accountId: ACCOUNT_ID,
        amount: 4970000,
        type: "expense",
        occurredAt: now.toISOString(),
      });
      await new Promise((r) => setTimeout(r, 0));

      // See note above — only the cash-flow-specific alert is asserted here.
      expect(prisma.notification.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ icon: "⚠️" }),
        }),
      );
    });
  });

  describe("checkBudgetAlert notification preference (EPIC-016 Task B3)", () => {
    const now = new Date("2026-06-15T10:00:00.000Z");
    const CATEGORY_ID = "cat-test-uuid";

    function setupBudgetOverrunCreate() {
      const createdTx = {
        id: "tx-budget-1",
        familyGroupId: FAMILY_GROUP_ID,
        accountId: ACCOUNT_ID,
        categoryId: CATEGORY_ID,
        amount: BigInt(5000000),
        type: "expense" as const,
        description: "Belanja bulanan",
        occurredAt: now,
        createdAt: now,
      };
      prisma.account.findUnique.mockResolvedValue(mockAccount);
      prisma.category.findUnique.mockResolvedValue({
        id: CATEGORY_ID,
        name: "Belanja",
      });
      prisma.budget.findFirst.mockResolvedValue({
        id: "budget-1",
        limitAmount: BigInt(5000000),
      });
      // Both checkBudgetAlert's own aggregate and checkCashFlowAlert's
      // income/expense aggregates share this mock — 100% usage on every
      // call keeps the budget-alert branch reachable regardless of call
      // order between the two fire-and-forget checks.
      prisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: BigInt(5000000) },
      });
      prisma.notification.findFirst.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue({});
      prisma.$transaction.mockImplementation(
        async (fn: Parameters<typeof prisma.$transaction>[0]) => {
          const innerPrisma = {
            ...prisma,
            transaction: {
              ...prisma.transaction,
              create: jest.fn().mockResolvedValue(createdTx),
            },
          };
          return (fn as (p: typeof innerPrisma) => Promise<unknown>)(
            innerPrisma,
          );
        },
      );
    }

    it("does not send an email when the owner's budget80 preference is false, even at >=80% usage", async () => {
      // Arrange — owner has explicitly turned off budget alerts
      setupBudgetOverrunCreate();
      prisma.member.findFirst.mockResolvedValue({
        user: {
          email: "owner@example.com",
          name: "Owner",
          notificationPrefs: { budget80: false },
        },
      });

      // Act
      await service.create(FAMILY_GROUP_ID, {
        accountId: ACCOUNT_ID,
        categoryId: CATEGORY_ID,
        amount: 5000000,
        type: "expense",
        occurredAt: now.toISOString(),
      });
      await new Promise((r) => setTimeout(r, 0));

      // Assert
      expect(notificationSender.sendEmail).not.toHaveBeenCalled();
    });

    it("sends an email when the owner's budget80 preference is true (default) at >=80% usage", async () => {
      // Arrange — owner has no stored prefs, so budget80 defaults to true
      setupBudgetOverrunCreate();
      prisma.member.findFirst.mockResolvedValue({
        user: {
          email: "owner@example.com",
          name: "Owner",
          notificationPrefs: null,
        },
      });

      // Act
      await service.create(FAMILY_GROUP_ID, {
        accountId: ACCOUNT_ID,
        categoryId: CATEGORY_ID,
        amount: 5000000,
        type: "expense",
        occurredAt: now.toISOString(),
      });
      await new Promise((r) => setTimeout(r, 0));

      // Assert
      expect(notificationSender.sendEmail).toHaveBeenCalledWith(
        "owner@example.com",
        "Owner",
        expect.any(String),
        expect.any(String),
      );
    });
  });
});
