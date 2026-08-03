import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { CATEGORIZATION_PORT } from "../categorization/categorization.port";
import { NOTIFICATION_SENDER_PORT } from "../notifications/notification-sender.port";
import { PrismaService } from "../prisma/prisma.service";

import { OCR_PORT } from "./ocr/ocr.port";
import { TransactionsService } from "./transactions.service";

const FAMILY_GROUP_ID = "fg-test-uuid";
const ACCOUNT_ID = "acc-test-uuid";
const TO_ACCOUNT_ID = "acc-dest-uuid";

const mockAccount = { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID };
const mockToAccount = { id: TO_ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID };

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
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

/** Resolves the account matching `where.id`, or null (cross-tenant / not found). */
function findUniqueAccountByWhereId(
  ...accounts: { id: string; familyGroupId: string }[]
) {
  return ({ where }: { where: { id: string } }) =>
    Promise.resolve(accounts.find((a) => a.id === where.id) ?? null);
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

  describe("real transfers (EPIC-021 Group B #23/#27/#28)", () => {
    const now = new Date("2026-06-15T10:00:00.000Z");

    function mockTransferCreate(overrides: Record<string, unknown> = {}) {
      const createdTx = {
        id: "tx-transfer-1",
        familyGroupId: FAMILY_GROUP_ID,
        accountId: ACCOUNT_ID,
        toAccountId: TO_ACCOUNT_ID,
        categoryId: null,
        amount: BigInt(200000),
        type: "transfer" as const,
        description: null,
        occurredAt: now,
        createdAt: now,
        ...overrides,
      };
      const createMock = jest.fn().mockResolvedValue(createdTx);
      prisma.$transaction.mockImplementation(
        async (fn: Parameters<typeof prisma.$transaction>[0]) => {
          const innerPrisma = {
            ...prisma,
            transaction: { ...prisma.transaction, create: createMock },
          };
          return (fn as (p: typeof innerPrisma) => Promise<unknown>)(
            innerPrisma,
          );
        },
      );
      return createMock;
    }

    it("moves both balances atomically and returns toAccountId/toAccountName", async () => {
      prisma.account.findUnique.mockImplementation(
        findUniqueAccountByWhereId(mockAccount, mockToAccount),
      );
      mockTransferCreate({
        toAccount: { name: "Dompet Digital" },
        account: { name: "BCA" },
      });

      const result = await service.create(FAMILY_GROUP_ID, {
        accountId: ACCOUNT_ID,
        toAccountId: TO_ACCOUNT_ID,
        amount: 200000,
        type: "transfer",
        occurredAt: now.toISOString(),
      });

      expect(result.toAccountId).toBe(TO_ACCOUNT_ID);
      expect(result.toAccountName).toBe("Dompet Digital");
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(-200000) } },
      });
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: TO_ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(200000) } },
      });
    });

    it("rejects a destination account from a different family group", async () => {
      prisma.account.findUnique.mockImplementation(
        findUniqueAccountByWhereId(mockAccount), // only the source resolves
      );

      await expect(
        service.create(FAMILY_GROUP_ID, {
          accountId: ACCOUNT_ID,
          toAccountId: "acc-other-tenant",
          amount: 50000,
          type: "transfer",
          occurredAt: now.toISOString(),
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.account.update).not.toHaveBeenCalled();
    });

    it("rejects when destination equals source account", async () => {
      prisma.account.findUnique.mockResolvedValue(mockAccount);

      await expect(
        service.create(FAMILY_GROUP_ID, {
          accountId: ACCOUNT_ID,
          toAccountId: ACCOUNT_ID,
          amount: 50000,
          type: "transfer",
          occurredAt: now.toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.account.update).not.toHaveBeenCalled();
    });

    it("creates the linked admin-fee expense on the destination account (#28)", async () => {
      prisma.account.findUnique.mockImplementation(
        findUniqueAccountByWhereId(mockAccount, mockToAccount),
      );
      const createMock = mockTransferCreate();

      await service.create(FAMILY_GROUP_ID, {
        accountId: ACCOUNT_ID,
        toAccountId: TO_ACCOUNT_ID,
        amount: 200000,
        adminFee: 2500,
        type: "transfer",
        occurredAt: now.toISOString(),
      });

      // 1st call creates the transfer row itself, 2nd creates the fee expense.
      expect(createMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          data: expect.objectContaining({
            familyGroupId: FAMILY_GROUP_ID,
            accountId: TO_ACCOUNT_ID,
            type: "expense",
            amount: BigInt(2500),
            description: "Biaya admin top-up",
          }),
        }),
      );
      // Destination is credited the full transfer amount, then separately
      // debited the fee — both calls must be present.
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: TO_ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(200000) } },
      });
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: TO_ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(-2500) } },
      });
    });

    it("rejects adminFee without a toAccountId", async () => {
      prisma.account.findUnique.mockResolvedValue(mockAccount);

      await expect(
        service.create(FAMILY_GROUP_ID, {
          accountId: ACCOUNT_ID,
          amount: 200000,
          adminFee: 2500,
          type: "expense",
          occurredAt: now.toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("leaves legacy one-sided transfers (no toAccountId) unaffected", async () => {
      prisma.account.findUnique.mockResolvedValue(mockAccount);
      mockTransferCreate({ toAccountId: null, amount: BigInt(75000) });

      const result = await service.create(FAMILY_GROUP_ID, {
        accountId: ACCOUNT_ID,
        amount: 75000,
        type: "transfer",
        occurredAt: now.toISOString(),
      });

      expect(result.toAccountId).toBeNull();
      expect(result.toAccountName).toBeNull();
      expect(prisma.account.update).toHaveBeenCalledTimes(1);
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(-75000) } },
      });
    });

    it("remove() reverses BOTH sides of a two-sided transfer", async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        id: "tx-transfer-1",
        familyGroupId: FAMILY_GROUP_ID,
        accountId: ACCOUNT_ID,
        toAccountId: TO_ACCOUNT_ID,
        categoryId: null,
        amount: BigInt(200000),
        type: "transfer",
        description: null,
        occurredAt: now,
        createdAt: now,
      });
      prisma.$transaction.mockImplementation(
        async (fn: Parameters<typeof prisma.$transaction>[0]) =>
          (fn as (p: typeof prisma) => Promise<unknown>)(prisma),
      );

      await service.remove(FAMILY_GROUP_ID, "tx-transfer-1");

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(200000) } },
      });
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: TO_ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(-200000) } },
      });
      expect(prisma.transaction.delete).toHaveBeenCalledWith({
        where: { id: "tx-transfer-1" },
      });
    });
  });

  describe("update() transfer permutations (EPIC-021 Group B)", () => {
    const now = new Date("2026-06-15T10:00:00.000Z");
    const NEW_SOURCE_ID = "acc-new-source-uuid";
    const NEW_DEST_ID = "acc-new-dest-uuid";

    function mockUpdateTransaction(overrides: Record<string, unknown> = {}) {
      prisma.transaction.update.mockResolvedValue({
        id: "tx-upd",
        familyGroupId: FAMILY_GROUP_ID,
        accountId: ACCOUNT_ID,
        toAccountId: null,
        categoryId: null,
        amount: BigInt(0),
        type: "expense",
        description: null,
        occurredAt: now,
        createdAt: now,
        ...overrides,
      });
      prisma.$transaction.mockImplementation(
        async (fn: Parameters<typeof prisma.$transaction>[0]) =>
          (fn as (p: typeof prisma) => Promise<unknown>)(prisma),
      );
    }

    it("transfer -> expense: reverts the destination leg and clears toAccountId", async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        id: "tx-upd",
        familyGroupId: FAMILY_GROUP_ID,
        accountId: ACCOUNT_ID,
        toAccountId: TO_ACCOUNT_ID,
        categoryId: null,
        amount: BigInt(200000),
        type: "transfer",
        description: null,
        occurredAt: now,
        createdAt: now,
      });
      mockUpdateTransaction({ type: "expense", toAccountId: null });

      const result = await service.update(FAMILY_GROUP_ID, "tx-upd", {
        type: "expense",
      });

      expect(result.toAccountId).toBeNull();
      // Revert: source debit reverted (+), destination credit reverted (-).
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(200000) } },
      });
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: TO_ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(-200000) } },
      });
      // Reapply as a plain expense: single debit on the source only.
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(-200000) } },
      });
      expect(prisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: "expense", toAccountId: null }),
        }),
      );
    });

    it("expense -> transfer: applies both legs", async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        id: "tx-upd",
        familyGroupId: FAMILY_GROUP_ID,
        accountId: ACCOUNT_ID,
        toAccountId: null,
        categoryId: null,
        amount: BigInt(50000),
        type: "expense",
        description: null,
        occurredAt: now,
        createdAt: now,
      });
      prisma.account.findUnique.mockImplementation(
        findUniqueAccountByWhereId(mockAccount, mockToAccount),
      );
      mockUpdateTransaction({ type: "transfer", toAccountId: TO_ACCOUNT_ID });

      await service.update(FAMILY_GROUP_ID, "tx-upd", {
        type: "transfer",
        toAccountId: TO_ACCOUNT_ID,
      });

      // Revert the old plain-expense debit.
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(50000) } },
      });
      // Apply the new transfer: debit source, credit destination.
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(-50000) } },
      });
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: TO_ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(50000) } },
      });
    });

    it("amount change on an existing transfer: both legs adjusted", async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        id: "tx-upd",
        familyGroupId: FAMILY_GROUP_ID,
        accountId: ACCOUNT_ID,
        toAccountId: TO_ACCOUNT_ID,
        categoryId: null,
        amount: BigInt(100000),
        type: "transfer",
        description: null,
        occurredAt: now,
        createdAt: now,
      });
      mockUpdateTransaction({ amount: BigInt(150000) });

      await service.update(FAMILY_GROUP_ID, "tx-upd", { amount: 150000 });

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(100000) } },
      });
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: TO_ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(-100000) } },
      });
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(-150000) } },
      });
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: TO_ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(150000) } },
      });
    });

    it("accountId change on an existing transfer: old source reverted, new source debited", async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        id: "tx-upd",
        familyGroupId: FAMILY_GROUP_ID,
        accountId: ACCOUNT_ID,
        toAccountId: TO_ACCOUNT_ID,
        categoryId: null,
        amount: BigInt(80000),
        type: "transfer",
        description: null,
        occurredAt: now,
        createdAt: now,
      });
      prisma.account.findUnique.mockImplementation(
        findUniqueAccountByWhereId(
          { id: NEW_SOURCE_ID, familyGroupId: FAMILY_GROUP_ID },
          mockToAccount,
        ),
      );
      mockUpdateTransaction({ accountId: NEW_SOURCE_ID });

      await service.update(FAMILY_GROUP_ID, "tx-upd", {
        accountId: NEW_SOURCE_ID,
      });

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(80000) } },
      });
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: TO_ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(-80000) } },
      });
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: NEW_SOURCE_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(-80000) } },
      });
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: TO_ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(80000) } },
      });
    });

    it("rejects patching accountId to equal the row's existing toAccountId (self-transfer bypass guard)", async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        id: "tx-upd",
        familyGroupId: FAMILY_GROUP_ID,
        accountId: ACCOUNT_ID,
        toAccountId: TO_ACCOUNT_ID,
        categoryId: null,
        amount: BigInt(80000),
        type: "transfer",
        description: null,
        occurredAt: now,
        createdAt: now,
      });
      // The new accountId itself resolves fine — only the cross-field
      // same-account invariant should reject this.
      prisma.account.findUnique.mockResolvedValue(mockToAccount);

      await expect(
        service.update(FAMILY_GROUP_ID, "tx-upd", {
          accountId: TO_ACCOUNT_ID,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("toAccountId change: old destination reverted, new destination credited", async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        id: "tx-upd",
        familyGroupId: FAMILY_GROUP_ID,
        accountId: ACCOUNT_ID,
        toAccountId: TO_ACCOUNT_ID,
        categoryId: null,
        amount: BigInt(60000),
        type: "transfer",
        description: null,
        occurredAt: now,
        createdAt: now,
      });
      prisma.account.findUnique.mockImplementation(
        findUniqueAccountByWhereId({
          id: NEW_DEST_ID,
          familyGroupId: FAMILY_GROUP_ID,
        }),
      );
      mockUpdateTransaction({ toAccountId: NEW_DEST_ID });

      await service.update(FAMILY_GROUP_ID, "tx-upd", {
        toAccountId: NEW_DEST_ID,
      });

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(60000) } },
      });
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: TO_ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(-60000) } },
      });
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(-60000) } },
      });
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: NEW_DEST_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(60000) } },
      });
    });

    it("explicit toAccountId: null clears the destination, keeping the row a legacy one-sided transfer", async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        id: "tx-upd",
        familyGroupId: FAMILY_GROUP_ID,
        accountId: ACCOUNT_ID,
        toAccountId: TO_ACCOUNT_ID,
        categoryId: null,
        amount: BigInt(40000),
        type: "transfer",
        description: null,
        occurredAt: now,
        createdAt: now,
      });
      mockUpdateTransaction({ toAccountId: null, type: "transfer" });

      const result = await service.update(FAMILY_GROUP_ID, "tx-upd", {
        toAccountId: null,
      });

      expect(result.toAccountId).toBeNull();
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(40000) } },
      });
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: TO_ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(-40000) } },
      });
      // Reapplied as a legacy one-sided transfer: single debit on the source.
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(-40000) } },
      });
      expect(prisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ toAccountId: null }),
        }),
      );
    });

    it("rejects toAccountId supplied together with an effective non-transfer type", async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        id: "tx-upd",
        familyGroupId: FAMILY_GROUP_ID,
        accountId: ACCOUNT_ID,
        toAccountId: null,
        categoryId: null,
        amount: BigInt(20000),
        type: "expense",
        description: null,
        occurredAt: now,
        createdAt: now,
      });

      await expect(
        service.update(FAMILY_GROUP_ID, "tx-upd", {
          toAccountId: TO_ACCOUNT_ID,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
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

interface FakeAccount {
  id: string;
  isPrivate: boolean;
}

interface FakeCategory {
  id: string;
  name: string;
  isPrivate: boolean;
}

interface FakeTx {
  id: string;
  familyGroupId: string;
  accountId: string;
  categoryId: string | null;
  amount: bigint;
  type: "income" | "expense" | "transfer";
  description: string | null;
  occurredAt: Date;
  createdAt: Date;
}

interface TxWhere {
  account?: { isPrivate: boolean };
  OR?: unknown;
  type?: string;
}

/**
 * A minimal in-memory Prisma stand-in that honors the transitive
 * account/category `isPrivate` filter TransactionsService builds via
 * `transactionPrivacyWhere`, so these tests exercise real filtering behavior
 * rather than just call shapes.
 */
function makeFakePrivacyPrisma(
  accounts: FakeAccount[],
  categories: FakeCategory[],
  transactions: FakeTx[],
) {
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  function filterTx(where: TxWhere): FakeTx[] {
    let rows = transactions;
    if (where.account?.isPrivate === false) {
      rows = rows.filter((t) => !accountById.get(t.accountId)?.isPrivate);
    }
    if (where.OR) {
      rows = rows.filter((t) => {
        if (t.categoryId === null) return true;
        return !categoryById.get(t.categoryId)?.isPrivate;
      });
    }
    if (where.type) {
      rows = rows.filter((t) => t.type === where.type);
    }
    return rows;
  }

  return {
    account: { findUnique: jest.fn(), update: jest.fn() },
    category: { findUnique: jest.fn(), findMany: jest.fn() },
    budget: { findFirst: jest.fn() },
    member: { findFirst: jest.fn() },
    notification: { findFirst: jest.fn(), create: jest.fn() },
    transaction: {
      findMany: jest.fn(({ where }: { where: TxWhere }) => {
        const rows = filterTx(where);
        return Promise.resolve(
          rows.map((t) => ({
            ...t,
            category: t.categoryId
              ? { name: categoryById.get(t.categoryId)?.name ?? "" }
              : null,
            account: { name: "" },
          })),
        );
      }),
      count: jest.fn(({ where }: { where: TxWhere }) =>
        Promise.resolve(filterTx(where).length),
      ),
      aggregate: jest.fn(({ where }: { where: TxWhere }) => {
        const sum = filterTx(where).reduce((acc, t) => acc + t.amount, 0n);
        return Promise.resolve({ _sum: { amount: sum } });
      }),
    },
    $transaction: jest.fn(),
  };
}

describe("TransactionsService.findAll privacy enforcement", () => {
  let service: TransactionsService;

  const accounts: FakeAccount[] = [
    { id: "acc-visible", isPrivate: false },
    { id: "acc-private", isPrivate: true },
  ];
  const categories: FakeCategory[] = [
    { id: "cat-visible", name: "Public Cat", isPrivate: false },
    { id: "cat-private", name: "Private Cat", isPrivate: true },
  ];
  const now = new Date();
  const transactions: FakeTx[] = [
    {
      id: "tx-visible",
      familyGroupId: FAMILY_GROUP_ID,
      accountId: "acc-visible",
      categoryId: null,
      amount: 50n,
      type: "income",
      description: null,
      occurredAt: now,
      createdAt: now,
    },
    {
      id: "tx-private-account",
      familyGroupId: FAMILY_GROUP_ID,
      accountId: "acc-private",
      categoryId: null,
      amount: 30n,
      type: "expense",
      description: null,
      occurredAt: now,
      createdAt: now,
    },
    {
      id: "tx-private-category",
      familyGroupId: FAMILY_GROUP_ID,
      accountId: "acc-visible",
      categoryId: "cat-private",
      amount: 20n,
      type: "expense",
      description: null,
      occurredAt: now,
      createdAt: now,
    },
  ];

  async function buildService() {
    const prisma = makeFakePrivacyPrisma(accounts, categories, transactions);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: OCR_PORT, useValue: { extractFromBase64: jest.fn() } },
        {
          provide: CATEGORIZATION_PORT,
          useValue: { suggest: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: NOTIFICATION_SENDER_PORT,
          useValue: { send: jest.fn(), sendEmail: jest.fn() },
        },
      ],
    }).compile();
    return module.get<TransactionsService>(TransactionsService);
  }

  beforeEach(async () => {
    service = await buildService();
  });

  it("excludes transactions tied to a private account or category for a member viewer", async () => {
    const result = await service.findAll(FAMILY_GROUP_ID, {}, false);
    expect(result.data.map((t) => t.id)).toEqual(["tx-visible"]);
    expect(result.meta.total).toBe(1);
    expect(result.summary.totalIncome).toBe("50");
    expect(result.summary.totalExpense).toBe("0");
  });

  it("includes all transactions for an owner/admin_staff viewer", async () => {
    const result = await service.findAll(FAMILY_GROUP_ID, {}, true);
    expect(result.data.map((t) => t.id).sort()).toEqual(
      ["tx-private-account", "tx-private-category", "tx-visible"].sort(),
    );
    expect(result.meta.total).toBe(3);
    expect(result.summary.totalIncome).toBe("50");
    expect(result.summary.totalExpense).toBe("50"); // 30 + 20
  });

  it("defaults to unfiltered when canSeePrivate is omitted (internal callers)", async () => {
    const result = await service.findAll(FAMILY_GROUP_ID, {});
    expect(result.data.map((t) => t.id).sort()).toEqual(
      ["tx-private-account", "tx-private-category", "tx-visible"].sort(),
    );
  });
});
