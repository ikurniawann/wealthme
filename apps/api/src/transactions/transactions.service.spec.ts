import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { Role } from "@prisma/client";

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
    // EPIC-019 Task C — resolveAllowedCategoryIds() reads this only when an
    // actingMember with role "member" is passed; defaults to an empty
    // allow-list (unrestricted) so every pre-existing test that never passes
    // actingMember keeps working unmodified.
    memberCategoryAllowance: { findMany: jest.fn().mockResolvedValue([]) },
    notification: { findFirst: jest.fn(), create: jest.fn() },
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      // EPIC-022 A6 follow-up — update()/remove() now look up the existing
      // row via findFirst (not findUnique) so the same relation-based
      // privacy filter findOne() already applies also gates a PATCH/DELETE.
      findFirst: jest.fn(),
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

  describe("category allow-list enforcement (EPIC-019 Task C)", () => {
    const now = new Date("2026-06-15T10:00:00.000Z");
    const ALLOWED_CATEGORY_ID = "cat-belanja";
    const DISALLOWED_CATEGORY_ID = "cat-hiburan";
    const MEMBER_ID = "member-pembantu";

    function mockCreateSucceeds(categoryId: string | null) {
      const createdTx = {
        id: "tx-uuid-allowlist",
        familyGroupId: FAMILY_GROUP_ID,
        accountId: ACCOUNT_ID,
        categoryId,
        amount: BigInt(20000),
        type: "expense" as const,
        description: "Belanja",
        occurredAt: now,
        createdAt: now,
      };
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

    beforeEach(() => {
      prisma.account.findUnique.mockResolvedValue(mockAccount);
      prisma.category.findUnique.mockResolvedValue({
        id: ALLOWED_CATEGORY_ID,
        familyGroupId: FAMILY_GROUP_ID,
      });
    });

    it("rejects an expense in a disallowed category for a constrained member", async () => {
      prisma.memberCategoryAllowance.findMany.mockResolvedValue([
        { categoryId: ALLOWED_CATEGORY_ID },
      ]);
      prisma.category.findUnique.mockResolvedValue({
        id: DISALLOWED_CATEGORY_ID,
        familyGroupId: FAMILY_GROUP_ID,
      });

      await expect(
        service.create(
          FAMILY_GROUP_ID,
          {
            accountId: ACCOUNT_ID,
            categoryId: DISALLOWED_CATEGORY_ID,
            amount: 20000,
            type: "expense",
            occurredAt: now.toISOString(),
          },
          { id: MEMBER_ID, role: "member" },
        ),
      ).rejects.toThrow(/tidak diizinkan/);
    });

    it("rejects an uncategorized expense for a constrained member (must pick an allowed category)", async () => {
      prisma.memberCategoryAllowance.findMany.mockResolvedValue([
        { categoryId: ALLOWED_CATEGORY_ID },
      ]);

      await expect(
        service.create(
          FAMILY_GROUP_ID,
          {
            accountId: ACCOUNT_ID,
            amount: 20000,
            type: "expense",
            occurredAt: now.toISOString(),
          },
          { id: MEMBER_ID, role: "member" },
        ),
      ).rejects.toThrow(/tidak diizinkan/);
    });

    it("allows an expense in an allowed category for a constrained member", async () => {
      prisma.memberCategoryAllowance.findMany.mockResolvedValue([
        { categoryId: ALLOWED_CATEGORY_ID },
      ]);
      mockCreateSucceeds(ALLOWED_CATEGORY_ID);

      const result = await service.create(
        FAMILY_GROUP_ID,
        {
          accountId: ACCOUNT_ID,
          categoryId: ALLOWED_CATEGORY_ID,
          amount: 20000,
          type: "expense",
          occurredAt: now.toISOString(),
        },
        { id: MEMBER_ID, role: "member" },
      );

      expect(result.categoryId).toBe(ALLOWED_CATEGORY_ID);
    });

    it("stays unrestricted for a member with an empty allow-list (backward compatible)", async () => {
      prisma.memberCategoryAllowance.findMany.mockResolvedValue([]);
      mockCreateSucceeds(ALLOWED_CATEGORY_ID);

      const result = await service.create(
        FAMILY_GROUP_ID,
        {
          accountId: ACCOUNT_ID,
          categoryId: ALLOWED_CATEGORY_ID,
          amount: 20000,
          type: "expense",
          occurredAt: now.toISOString(),
        },
        { id: MEMBER_ID, role: "member" },
      );

      expect(result.categoryId).toBe(ALLOWED_CATEGORY_ID);
    });

    it("exempts an owner even if a MemberCategoryAllowance row exists for them", async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: DISALLOWED_CATEGORY_ID,
        familyGroupId: FAMILY_GROUP_ID,
      });
      mockCreateSucceeds(DISALLOWED_CATEGORY_ID);

      const result = await service.create(
        FAMILY_GROUP_ID,
        {
          accountId: ACCOUNT_ID,
          categoryId: DISALLOWED_CATEGORY_ID,
          amount: 20000,
          type: "expense",
          occurredAt: now.toISOString(),
        },
        { id: "member-owner", role: "owner" },
      );

      // Owner is exempt — resolveAllowedCategoryIds() never even queries the
      // allow-list table for a non-"member" role.
      expect(prisma.memberCategoryAllowance.findMany).not.toHaveBeenCalled();
      expect(result.categoryId).toBe(DISALLOWED_CATEGORY_ID);
    });

    it("does not constrain income transactions even for a constrained member", async () => {
      prisma.memberCategoryAllowance.findMany.mockResolvedValue([
        { categoryId: ALLOWED_CATEGORY_ID },
      ]);
      const createdTx = {
        id: "tx-income-allowlist",
        familyGroupId: FAMILY_GROUP_ID,
        accountId: ACCOUNT_ID,
        categoryId: null,
        amount: BigInt(20000),
        type: "income" as const,
        description: null,
        occurredAt: now,
        createdAt: now,
      };
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

      const result = await service.create(
        FAMILY_GROUP_ID,
        {
          accountId: ACCOUNT_ID,
          amount: 20000,
          type: "income",
          occurredAt: now.toISOString(),
        },
        { id: MEMBER_ID, role: "member" },
      );

      expect(result.type).toBe("income");
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
      prisma.transaction.findFirst.mockResolvedValue({
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

  describe("bank overdraft guard (EPIC-021 #21/#22)", () => {
    const now = new Date("2026-06-15T10:00:00.000Z");

    /** account.findUnique that returns a full row (with type/balance) by id. */
    function mockAccountsById(
      accounts: Record<string, { type: string; balance: bigint }>,
    ) {
      prisma.account.findUnique.mockImplementation(
        ({ where }: { where: { id: string } }) => {
          const found = accounts[where.id];
          return Promise.resolve(
            found
              ? {
                  id: where.id,
                  familyGroupId: FAMILY_GROUP_ID,
                  name: where.id,
                  ...found,
                }
              : null,
          );
        },
      );
    }

    function mockCreate(overrides: Record<string, unknown> = {}) {
      const createdTx = {
        id: "tx-guard-1",
        familyGroupId: FAMILY_GROUP_ID,
        accountId: ACCOUNT_ID,
        toAccountId: null,
        categoryId: null,
        amount: BigInt(50000),
        type: "expense" as const,
        description: null,
        occurredAt: now,
        createdAt: now,
        ...overrides,
      };
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

    it("rejects an expense that would take a bank account below zero (#22)", async () => {
      mockAccountsById({
        [ACCOUNT_ID]: { type: "bank", balance: BigInt(30000) },
      });
      mockCreate();

      await expect(
        service.create(FAMILY_GROUP_ID, {
          accountId: ACCOUNT_ID,
          amount: 50000,
          type: "expense",
          occurredAt: now.toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.account.update).not.toHaveBeenCalled();
    });

    it("rejects a transfer FROM a bank account exceeding its balance (#22)", async () => {
      mockAccountsById({
        [ACCOUNT_ID]: { type: "bank", balance: BigInt(30000) },
        [TO_ACCOUNT_ID]: { type: "ewallet", balance: BigInt(0) },
      });
      mockCreate({ type: "transfer", toAccountId: TO_ACCOUNT_ID });

      await expect(
        service.create(FAMILY_GROUP_ID, {
          accountId: ACCOUNT_ID,
          toAccountId: TO_ACCOUNT_ID,
          amount: 50000,
          type: "transfer",
          occurredAt: now.toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.account.update).not.toHaveBeenCalled();
    });

    it("rejects an admin fee that would take a bank destination account below zero (#22/#28)", async () => {
      // Small top-up (2.000), oversized fee (5.000) — the fee exceeding the
      // transfer amount is a real case (see create()'s comment), and is
      // chosen here so the guard fires whether or not this stateless mock
      // reflects the just-applied transfer credit (1.000 + 2.000 = 3.000,
      // still < the 5.000 fee either way).
      mockAccountsById({
        [ACCOUNT_ID]: { type: "ewallet", balance: BigInt(1_000_000) },
        [TO_ACCOUNT_ID]: { type: "bank", balance: BigInt(1000) },
      });
      mockCreate({ type: "transfer", toAccountId: TO_ACCOUNT_ID });

      await expect(
        service.create(FAMILY_GROUP_ID, {
          accountId: ACCOUNT_ID,
          toAccountId: TO_ACCOUNT_ID,
          amount: 2000,
          adminFee: 5000,
          type: "transfer",
          occurredAt: now.toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("allows a cash account to go negative (#21)", async () => {
      mockAccountsById({
        [ACCOUNT_ID]: { type: "cash", balance: BigInt(30000) },
      });
      mockCreate();

      const result = await service.create(FAMILY_GROUP_ID, {
        accountId: ACCOUNT_ID,
        amount: 50000,
        type: "expense",
        occurredAt: now.toISOString(),
      });

      expect(result.id).toBe("tx-guard-1");
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(-50000) } },
      });
    });

    it("allows a credit (income) on an already-negative bank account (#22 grandfather)", async () => {
      mockAccountsById({
        [ACCOUNT_ID]: { type: "bank", balance: BigInt(-20000) },
      });
      mockCreate({ type: "income" });

      const result = await service.create(FAMILY_GROUP_ID, {
        accountId: ACCOUNT_ID,
        amount: 10000,
        type: "income",
        occurredAt: now.toISOString(),
      });

      expect(result.id).toBe("tx-guard-1");
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(10000) } },
      });
    });

    it("rejects a further debit on an already-negative bank account (#22 grandfather)", async () => {
      mockAccountsById({
        [ACCOUNT_ID]: { type: "bank", balance: BigInt(-20000) },
      });
      mockCreate();

      await expect(
        service.create(FAMILY_GROUP_ID, {
          accountId: ACCOUNT_ID,
          amount: 5000,
          type: "expense",
          occurredAt: now.toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.account.update).not.toHaveBeenCalled();
    });

    it("allows a bank expense that lands exactly at zero (boundary)", async () => {
      mockAccountsById({
        [ACCOUNT_ID]: { type: "bank", balance: BigInt(50000) },
      });
      mockCreate();

      const result = await service.create(FAMILY_GROUP_ID, {
        accountId: ACCOUNT_ID,
        amount: 50000,
        type: "expense",
        occurredAt: now.toISOString(),
      });

      expect(result.id).toBe("tx-guard-1");
    });

    it("delete-reversal is never blocked, even when it takes a bank account below zero", async () => {
      // The destination bank account has since been spent down to a low
      // balance; reversing the original 200.000 credit that funded it would
      // take it deeply negative. This must still succeed — reversal
      // integrity beats the overdraft invariant (see applyTransferBalanceDelta).
      mockAccountsById({
        [ACCOUNT_ID]: { type: "ewallet", balance: BigInt(1_000_000) },
        [TO_ACCOUNT_ID]: { type: "bank", balance: BigInt(100) },
      });
      prisma.transaction.findFirst.mockResolvedValue({
        id: "tx-transfer-guard",
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

      await expect(
        service.remove(FAMILY_GROUP_ID, "tx-transfer-guard"),
      ).resolves.toBeUndefined();

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: TO_ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        data: { balance: { increment: BigInt(-200000) } },
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
      prisma.transaction.findFirst.mockResolvedValue({
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
      prisma.transaction.findFirst.mockResolvedValue({
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
      prisma.transaction.findFirst.mockResolvedValue({
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
      prisma.transaction.findFirst.mockResolvedValue({
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
      prisma.transaction.findFirst.mockResolvedValue({
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
      prisma.transaction.findFirst.mockResolvedValue({
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
      prisma.transaction.findFirst.mockResolvedValue({
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
      prisma.transaction.findFirst.mockResolvedValue({
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

  describe("update() category allow-list enforcement (EPIC-019 Task C)", () => {
    const now = new Date("2026-06-15T10:00:00.000Z");
    const ALLOWED_CATEGORY_ID = "cat-belanja";
    const DISALLOWED_CATEGORY_ID = "cat-hiburan";
    const MEMBER_ID = "member-pembantu";

    it("rejects a PATCH that changes type to expense while the EFFECTIVE category is disallowed", async () => {
      // Existing row is a "transfer" (unconstrained); the patch only changes
      // `type`, so `categoryId` comes from the EXISTING row, not the payload —
      // the effective-state check must still catch this.
      prisma.transaction.findFirst.mockResolvedValue({
        id: "tx-upd",
        familyGroupId: FAMILY_GROUP_ID,
        accountId: ACCOUNT_ID,
        toAccountId: null,
        categoryId: DISALLOWED_CATEGORY_ID,
        amount: BigInt(20000),
        type: "transfer",
        description: null,
        occurredAt: now,
        createdAt: now,
      });
      prisma.memberCategoryAllowance.findMany.mockResolvedValue([
        { categoryId: ALLOWED_CATEGORY_ID },
      ]);

      await expect(
        service.update(
          FAMILY_GROUP_ID,
          "tx-upd",
          { type: "expense" },
          { id: MEMBER_ID, role: "member" },
        ),
      ).rejects.toThrow(/tidak diizinkan/);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("allows a PATCH to an allowed category for a constrained member", async () => {
      prisma.transaction.findFirst.mockResolvedValue({
        id: "tx-upd",
        familyGroupId: FAMILY_GROUP_ID,
        accountId: ACCOUNT_ID,
        toAccountId: null,
        categoryId: DISALLOWED_CATEGORY_ID,
        amount: BigInt(20000),
        type: "expense",
        description: null,
        occurredAt: now,
        createdAt: now,
      });
      prisma.category.findUnique.mockResolvedValue({
        id: ALLOWED_CATEGORY_ID,
        familyGroupId: FAMILY_GROUP_ID,
      });
      prisma.memberCategoryAllowance.findMany.mockResolvedValue([
        { categoryId: ALLOWED_CATEGORY_ID },
      ]);
      prisma.transaction.update.mockResolvedValue({
        id: "tx-upd",
        familyGroupId: FAMILY_GROUP_ID,
        accountId: ACCOUNT_ID,
        toAccountId: null,
        categoryId: ALLOWED_CATEGORY_ID,
        amount: BigInt(20000),
        type: "expense",
        description: null,
        occurredAt: now,
        createdAt: now,
      });
      prisma.$transaction.mockImplementation(
        async (fn: Parameters<typeof prisma.$transaction>[0]) =>
          (fn as (p: typeof prisma) => Promise<unknown>)(prisma),
      );

      const result = await service.update(
        FAMILY_GROUP_ID,
        "tx-upd",
        { categoryId: ALLOWED_CATEGORY_ID },
        { id: MEMBER_ID, role: "member" },
      );

      expect(result.categoryId).toBe(ALLOWED_CATEGORY_ID);
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
  // EPIC-023 Task C — per-member ownership, needed by the row-scoped
  // viewer tests. Optional so every pre-existing fixture stays valid.
  ownerUserId?: string | null;
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
  // EPIC-023 Task C — who recorded this row. Optional so every pre-existing
  // fixture stays valid.
  createdByUserId?: string | null;
  // EPIC-023 Task C retry — the destination leg of a transfer, needed by the
  // "allowance-approval scenario" below. Optional so every pre-existing
  // fixture stays valid.
  toAccountId?: string | null;
}

interface TxWhereFragment {
  account?: { isPrivate?: boolean; ownerUserId?: string };
  OR?: unknown[];
}

interface TxWhere extends TxWhereFragment {
  id?: string;
  type?: string;
  // EPIC-023 Task C — `findAll`/`getSummary`/`findOne` now combine their
  // privacy and row-scoping fragments via a shared `AND` array (see
  // transactions.service.ts#buildWhere) instead of flat top-level keys;
  // `update()`/`remove()`'s existing-row lookup still spreads flat (never
  // row-scoped — see the class-level note on why). This fake handles both.
  AND?: TxWhereFragment[];
}

/**
 * A minimal in-memory Prisma stand-in that honors the transitive
 * account/category `isPrivate` filter TransactionsService builds via
 * `transactionPrivacyWhere`, plus the row-scoping fragment
 * `restrictedTransactionWhere` may contribute, so these tests exercise real
 * filtering behavior rather than just call shapes.
 */
function makeFakePrivacyPrisma(
  accounts: FakeAccount[],
  categories: FakeCategory[],
  transactions: FakeTx[],
) {
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  function applyFragment(rows: FakeTx[], frag: TxWhereFragment): FakeTx[] {
    let out = rows;
    if (frag.account?.isPrivate === false) {
      out = out.filter((t) => !accountById.get(t.accountId)?.isPrivate);
    }
    if (frag.OR) {
      const or = frag.OR as Array<{
        categoryId?: null;
        category?: { isPrivate: boolean };
        account?: { ownerUserId?: string };
        createdByUserId?: string;
        // EPIC-023 Task C retry — the incoming-transfer leg of
        // `restrictedTransactionWhere`.
        toAccount?: { ownerUserId?: string };
      }>;
      const isCategoryPrivacyShape = or.some(
        (item) => "categoryId" in item || "category" in item,
      );
      out = isCategoryPrivacyShape
        ? out.filter((t) => {
            if (t.categoryId === null) return true;
            return !categoryById.get(t.categoryId)?.isPrivate;
          })
        : out.filter((t) =>
            or.some(
              (item) =>
                item.account?.ownerUserId ===
                  accountById.get(t.accountId)?.ownerUserId ||
                item.createdByUserId === t.createdByUserId ||
                (t.toAccountId != null &&
                  item.toAccount?.ownerUserId ===
                    accountById.get(t.toAccountId)?.ownerUserId),
            ),
          );
    }
    return out;
  }

  function filterTx(where: TxWhere): FakeTx[] {
    let rows = transactions;
    if (where.id) {
      rows = rows.filter((t) => t.id === where.id);
    }
    if (where.type) {
      rows = rows.filter((t) => t.type === where.type);
    }
    const fragments: TxWhereFragment[] = where.AND ?? [where];
    for (const frag of fragments) {
      rows = applyFragment(rows, frag);
    }
    return rows;
  }

  const prisma = {
    account: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
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
      // EPIC-023 Task C retry — the "allowance-approval scenario" test
      // exercises the REAL `create()` against this same fake so the row it
      // writes (accountId = source, toAccountId = destination,
      // createdByUserId = null — the exact shape an allowance approval
      // produces) is then readable back through the REAL `findAll()`'s
      // row-scoping. Pushes onto the same `transactions` array `filterTx`
      // reads, so a subsequent `findMany` in the same test sees it.
      create: jest.fn(({ data }: { data: Partial<FakeTx> }) => {
        const row: FakeTx = {
          id: data.id ?? `tx-fake-${transactions.length + 1}`,
          familyGroupId: data.familyGroupId ?? FAMILY_GROUP_ID,
          accountId: data.accountId ?? "",
          categoryId: data.categoryId ?? null,
          amount: data.amount ?? 0n,
          type: data.type ?? "expense",
          description: data.description ?? null,
          occurredAt: data.occurredAt ?? new Date(),
          createdAt: new Date(),
          createdByUserId: data.createdByUserId ?? null,
          toAccountId: data.toAccountId ?? null,
        };
        transactions.push(row);
        return Promise.resolve({
          ...row,
          category: row.categoryId
            ? { name: categoryById.get(row.categoryId)?.name ?? "" }
            : null,
          account: { name: "" },
          toAccount: row.toAccountId ? { name: "" } : null,
        });
      }),
      count: jest.fn(({ where }: { where: TxWhere }) =>
        Promise.resolve(filterTx(where).length),
      ),
      aggregate: jest.fn(({ where }: { where: TxWhere }) => {
        const sum = filterTx(where).reduce((acc, t) => acc + t.amount, 0n);
        return Promise.resolve({ _sum: { amount: sum } });
      }),
      // EPIC-022 A6 follow-up — update()/remove() now look up the existing
      // row this way; honors the same privacy `where` fragment as
      // findMany/count above, so a member's PATCH/DELETE on a
      // private-tied transaction 404s exactly like `findAll` excludes it.
      findFirst: jest.fn(({ where }: { where: TxWhere }) => {
        const [row] = filterTx(where);
        if (!row) return Promise.resolve(null);
        return Promise.resolve({
          ...row,
          toAccountId: null,
        });
      }),
      update: jest.fn(({ where }: { where: { id: string } }) => {
        const row = transactions.find((t) => t.id === where.id);
        return Promise.resolve({
          ...row,
          toAccountId: null,
          category: null,
          account: { name: "" },
          toAccount: null,
        });
      }),
      delete: jest.fn().mockResolvedValue({}),
    },
  };
  return {
    ...prisma,
    $transaction: jest.fn((cb: (tx: typeof prisma) => Promise<unknown>) =>
      cb(prisma),
    ),
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

// EPIC-022 A6 follow-up — the same privacy hole `findAll`/`findOne` were
// already fixed for existed, unfixed, on `update()`/`remove()`: a member
// holding a private-tied transaction's id could still PATCH or DELETE it.
describe("TransactionsService.update/remove privacy enforcement (EPIC-022 A6 follow-up)", () => {
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

  async function buildServiceAndPrisma() {
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
    return {
      service: module.get<TransactionsService>(TransactionsService),
      prisma,
    };
  }

  it("update() 404s a member on a transaction tied to a private account, and never opens a $transaction", async () => {
    const { service, prisma } = await buildServiceAndPrisma();
    await expect(
      service.update(
        FAMILY_GROUP_ID,
        "tx-private-account",
        { description: "renamed" },
        null,
        false,
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("update() 404s a member on a transaction tied to a private category, and never opens a $transaction", async () => {
    const { service, prisma } = await buildServiceAndPrisma();
    await expect(
      service.update(
        FAMILY_GROUP_ID,
        "tx-private-category",
        { description: "renamed" },
        null,
        false,
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("update() still lets a member edit a transaction tied to a public account/category", async () => {
    const { service } = await buildServiceAndPrisma();
    const result = await service.update(
      FAMILY_GROUP_ID,
      "tx-visible",
      { description: "renamed" },
      null,
      false,
    );
    expect(result).toBeDefined();
  });

  it("update() lets an owner/admin_staff viewer edit a transaction tied to a private account", async () => {
    const { service } = await buildServiceAndPrisma();
    const result = await service.update(
      FAMILY_GROUP_ID,
      "tx-private-account",
      { description: "renamed" },
      null,
      true,
    );
    expect(result).toBeDefined();
  });

  it("remove() 404s a member on a transaction tied to a private account, and never deletes", async () => {
    const { service, prisma } = await buildServiceAndPrisma();
    await expect(
      service.remove(FAMILY_GROUP_ID, "tx-private-account", false),
    ).rejects.toMatchObject({ status: 404 });
    expect(prisma.transaction.delete).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("remove() 404s a member on a transaction tied to a private category, and never deletes", async () => {
    const { service, prisma } = await buildServiceAndPrisma();
    await expect(
      service.remove(FAMILY_GROUP_ID, "tx-private-category", false),
    ).rejects.toMatchObject({ status: 404 });
    expect(prisma.transaction.delete).not.toHaveBeenCalled();
  });

  it("remove() still lets a member delete a transaction tied to a public account/category", async () => {
    const { service, prisma } = await buildServiceAndPrisma();
    await service.remove(FAMILY_GROUP_ID, "tx-visible", false);
    expect(prisma.transaction.delete).toHaveBeenCalledWith({
      where: { id: "tx-visible" },
    });
  });

  it("remove() lets an owner/admin_staff viewer delete a transaction tied to a private category", async () => {
    const { service, prisma } = await buildServiceAndPrisma();
    await service.remove(FAMILY_GROUP_ID, "tx-private-category", true);
    expect(prisma.transaction.delete).toHaveBeenCalledWith({
      where: { id: "tx-private-category" },
    });
  });
});

// EPIC-023 Task C (D3, US-FAM-11) — a dependant/operational viewer must see
// only transactions on an account they own or that they personally
// recorded, never the rest of the household ledger, on concrete data (not
// just a `where`-shape assertion).
describe("TransactionsService row-scoped viewer (dependant/operational)", () => {
  const CHILD_USER_ID = "user-child";
  const HEAD_USER_ID = "user-head";

  const accounts: FakeAccount[] = [
    { id: "acc-child", isPrivate: false, ownerUserId: CHILD_USER_ID },
    { id: "acc-shared", isPrivate: false, ownerUserId: null },
  ];
  const categories: FakeCategory[] = [];
  const now = new Date();
  const transactions: FakeTx[] = [
    {
      id: "tx-child-own-account",
      familyGroupId: FAMILY_GROUP_ID,
      accountId: "acc-child",
      categoryId: null,
      amount: 20_000n,
      type: "expense",
      description: "Jajan",
      occurredAt: now,
      createdAt: now,
      createdByUserId: CHILD_USER_ID,
    },
    {
      id: "tx-child-recorded-on-shared",
      familyGroupId: FAMILY_GROUP_ID,
      accountId: "acc-shared",
      categoryId: null,
      amount: 15_000n,
      type: "expense",
      description: "Dicatat anak di rekening keluarga",
      occurredAt: now,
      createdAt: now,
      createdByUserId: CHILD_USER_ID,
    },
    {
      id: "tx-head-household-ledger",
      familyGroupId: FAMILY_GROUP_ID,
      accountId: "acc-shared",
      categoryId: null,
      amount: 2_000_000n,
      type: "expense",
      description: "Belanja bulanan kepala keluarga",
      occurredAt: now,
      createdAt: now,
      createdByUserId: HEAD_USER_ID,
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

  it("a dependant's transaction list includes only accounts they own or transactions they recorded — DENIAL: the head's household-ledger row is absent", async () => {
    const service = await buildService();
    const result = await service.findAll(
      FAMILY_GROUP_ID,
      {},
      true,
      Role.dependant,
      CHILD_USER_ID,
    );

    expect(result.data.map((t) => t.id).sort()).toEqual(
      ["tx-child-own-account", "tx-child-recorded-on-shared"].sort(),
    );
    expect(result.data.map((t) => t.id)).not.toContain(
      "tx-head-household-ledger",
    );
  });

  it("findOne 404s a dependant on a transaction outside their scope — its existence must not leak", async () => {
    const service = await buildService();
    await expect(
      service.findOne(
        FAMILY_GROUP_ID,
        "tx-head-household-ledger",
        true,
        Role.dependant,
        CHILD_USER_ID,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it("an unrestricted role (owner/spouse/member/admin_staff) still sees the full ledger", async () => {
    const service = await buildService();
    const result = await service.findAll(FAMILY_GROUP_ID, {}, true);
    expect(result.data.map((t) => t.id).sort()).toEqual(
      [
        "tx-child-own-account",
        "tx-child-recorded-on-shared",
        "tx-head-household-ledger",
      ].sort(),
    );
  });
});

// EPIC-023 Task C (D3/D5) — create() must not let a row-scoped role move
// money on an account they do not own, and must stamp who recorded a row.
describe("TransactionsService.create — row-scoped roles and createdByUserId (EPIC-023 Task C)", () => {
  let service: TransactionsService;
  let prisma: ReturnType<typeof makePrisma>;

  const OTHER_ACCOUNT_ID = "acc-other-member";
  const CHILD_USER_ID = "user-child";

  beforeEach(async () => {
    prisma = makePrisma();
    // Invoke the $transaction callback directly against the SAME prisma
    // mock object (not a clone), so assertions below inspect the exact
    // `transaction.create` mock the service actually called.
    prisma.$transaction.mockImplementation(
      async (fn: Parameters<typeof prisma.$transaction>[0]) =>
        (fn as (p: typeof prisma) => Promise<unknown>)(prisma),
    );
    prisma.transaction.create.mockResolvedValue({
      id: "tx-new",
      familyGroupId: FAMILY_GROUP_ID,
      accountId: ACCOUNT_ID,
      categoryId: null,
      amount: 50_000n,
      type: "expense",
      description: null,
      occurredAt: new Date(),
      createdAt: new Date(),
    });
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
    service = module.get<TransactionsService>(TransactionsService);
  });

  it("DENIAL — a dependant cannot record a transaction on an account they do not own", async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: OTHER_ACCOUNT_ID,
      familyGroupId: FAMILY_GROUP_ID,
      ownerUserId: "user-someone-else",
    });

    await expect(
      service.create(
        FAMILY_GROUP_ID,
        {
          accountId: OTHER_ACCOUNT_ID,
          amount: 50_000,
          type: "expense",
          occurredAt: new Date().toISOString(),
        },
        { id: "member-child", userId: CHILD_USER_ID, role: Role.dependant },
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("an operational member CAN record a transaction on the account they own", async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: ACCOUNT_ID,
      familyGroupId: FAMILY_GROUP_ID,
      ownerUserId: CHILD_USER_ID,
    });

    await service.create(
      FAMILY_GROUP_ID,
      {
        accountId: ACCOUNT_ID,
        amount: 50_000,
        type: "expense",
        occurredAt: new Date().toISOString(),
      },
      { id: "member-driver", userId: CHILD_USER_ID, role: Role.operational },
    );

    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ createdByUserId: CHILD_USER_ID }),
      }),
    );
  });

  it("stamps createdByUserId for any acting member, and leaves it null with no acting member (internal caller)", async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: ACCOUNT_ID,
      familyGroupId: FAMILY_GROUP_ID,
      ownerUserId: null,
    });

    await service.create(FAMILY_GROUP_ID, {
      accountId: ACCOUNT_ID,
      amount: 50_000,
      type: "expense",
      occurredAt: new Date().toISOString(),
    });

    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ createdByUserId: null }),
      }),
    );
  });
});

// EPIC-023 Task C retry (MEDIUM finding) — end-to-end at service level:
// `AllowanceRequestsService.approve()` calls `TransactionsService.create()`
// with NO `actingMember` (see allowance-requests.service.ts), so the created
// transfer has `createdByUserId: null` and `accountId` = the owner-chosen
// source account (never the dependant's own). Only `toAccountId` ties it to
// the child. Before `restrictedTransactionWhere`'s `toAccount` leg, this row
// would be created successfully but never appear in the child's own
// `findAll()` — the balance changes but the transaction that moved it is
// invisible. This test drives the REAL `create()` exactly the way approve()
// does, then reads it back through the REAL `findAll()` as the dependant.
describe("TransactionsService — allowance-approval scenario (EPIC-023 Task C retry)", () => {
  const HEAD_USER_ID = "user-head-allowance";
  const CHILD_USER_ID = "user-child-allowance";
  const PARENT_ACCOUNT_ID = "acc-parent-allowance";
  const CHILD_ACCOUNT_ID = "acc-child-allowance";

  it("a dependant sees the incoming transfer an owner recorded on their behalf, even though they neither own the source account nor recorded it themselves", async () => {
    const accounts: FakeAccount[] = [
      { id: PARENT_ACCOUNT_ID, isPrivate: false, ownerUserId: HEAD_USER_ID },
      { id: CHILD_ACCOUNT_ID, isPrivate: false, ownerUserId: CHILD_USER_ID },
    ];
    const prisma = makeFakePrivacyPrisma(accounts, [], []);
    prisma.account.findUnique.mockImplementation(
      findUniqueAccountByWhereId(
        { id: PARENT_ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
        { id: CHILD_ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
      ),
    );

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
    const service = module.get<TransactionsService>(TransactionsService);

    // Mirrors AllowanceRequestsService.approve() exactly — no actingMember.
    const created = await service.create(FAMILY_GROUP_ID, {
      accountId: PARENT_ACCOUNT_ID,
      toAccountId: CHILD_ACCOUNT_ID,
      amount: 50_000,
      type: "transfer",
      description: "Alokasi dana keluarga",
      occurredAt: new Date().toISOString(),
    });

    // The shape that made the row invisible: no acting member, source
    // account not owned by the child.
    expect(created.toAccountId).toBe(CHILD_ACCOUNT_ID);

    const result = await service.findAll(
      FAMILY_GROUP_ID,
      {},
      true,
      Role.dependant,
      CHILD_USER_ID,
    );

    expect(result.data.map((t) => t.id)).toContain(created.id);
  });
});
