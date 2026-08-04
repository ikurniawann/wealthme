import { BadRequestException, NotFoundException } from "@nestjs/common";

import { ReconciliationService } from "./reconciliation.service";

import type { TransactionResponseDto } from "../transactions/dto/transaction-response.dto";

const FAMILY_GROUP_ID = "fg-test-uuid";
const SYNC_ID = "sync-uuid";
const ENTRY_ID = "entry-uuid";
const ACCOUNT_ID = "acc-bank-uuid";
const TO_ACCOUNT_ID = "acc-ewallet-uuid";
const TX_ID = "tx-transfer-uuid";

function makePrisma() {
  return {
    bankSync: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    bankSyncEntry: {
      createMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    transaction: { findMany: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
}

function makeTransactionsService() {
  return { create: jest.fn() };
}

function buildTransferResponse(
  overrides: Partial<TransactionResponseDto> = {},
): TransactionResponseDto {
  return {
    id: TX_ID,
    familyGroupId: FAMILY_GROUP_ID,
    accountId: ACCOUNT_ID,
    toAccountId: TO_ACCOUNT_ID,
    categoryId: null,
    amount: "100000",
    type: "transfer",
    description: "Top up GoPay",
    categoryName: null,
    accountName: "BCA Tabungan",
    toAccountName: "GoPay",
    occurredAt: "2026-06-15T00:00:00.000Z",
    createdAt: "2026-06-15T10:00:00.000Z",
    ...overrides,
  };
}

function buildEntryRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: ENTRY_ID,
    bankSyncId: SYNC_ID,
    date: new Date("2026-06-15T00:00:00.000Z"),
    description: "TOPUP GOPAY 101000",
    amount: BigInt(-101000),
    currency: "IDR",
    reconStatus: "unmatched",
    matchedTxId: null,
    suggestedTxId: null,
    createdAt: new Date("2026-06-15T00:00:00.000Z"),
    ...overrides,
  };
}

describe("ReconciliationService", () => {
  let service: ReconciliationService;
  let prisma: ReturnType<typeof makePrisma>;
  let transactionsService: ReturnType<typeof makeTransactionsService>;

  beforeEach(() => {
    prisma = makePrisma();
    transactionsService = makeTransactionsService();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new ReconciliationService(
      prisma as any,
      transactionsService as any,
    );
  });

  describe("getEntries", () => {
    it("throws NotFoundException when the sync does not belong to the family group", async () => {
      prisma.bankSync.findUnique.mockResolvedValue(null);

      await expect(
        service.getEntries(FAMILY_GROUP_ID, SYNC_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it("returns entries with matchedTransaction: null when unmatched", async () => {
      prisma.bankSync.findUnique.mockResolvedValue({ id: SYNC_ID });
      prisma.bankSyncEntry.findMany.mockResolvedValue([buildEntryRow()]);
      prisma.transaction.findMany.mockResolvedValue([]);

      const result = await service.getEntries(FAMILY_GROUP_ID, SYNC_ID);

      expect(result).toHaveLength(1);
      expect(result[0]?.matchedTransaction).toBeNull();
      expect(prisma.transaction.findMany).not.toHaveBeenCalled();
    });

    it("embeds the matched transaction summary (EPIC-021 #9) for a matched entry", async () => {
      prisma.bankSync.findUnique.mockResolvedValue({ id: SYNC_ID });
      prisma.bankSyncEntry.findMany.mockResolvedValue([
        buildEntryRow({ reconStatus: "matched", matchedTxId: TX_ID }),
      ]);
      prisma.transaction.findMany.mockResolvedValue([
        {
          id: TX_ID,
          accountId: ACCOUNT_ID,
          toAccountId: TO_ACCOUNT_ID,
          categoryId: null,
          amount: BigInt(100000),
          type: "transfer",
          description: "Top up GoPay",
          occurredAt: new Date("2026-06-15T00:00:00.000Z"),
          createdAt: new Date("2026-06-15T10:00:00.000Z"),
          account: { name: "BCA Tabungan" },
          toAccount: { name: "GoPay" },
          category: null,
        },
      ]);

      const result = await service.getEntries(FAMILY_GROUP_ID, SYNC_ID);

      expect(result[0]?.matchedTransaction).toEqual(
        expect.objectContaining({
          id: TX_ID,
          accountName: "BCA Tabungan",
          toAccountName: "GoPay",
          amount: "100000",
        }),
      );
      // Batch fetch — a single transaction.findMany call regardless of entry count.
      expect(prisma.transaction.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe("splitEntry", () => {
    it("throws NotFoundException when the sync does not belong to the family group", async () => {
      prisma.bankSync.findUnique.mockResolvedValue(null);

      await expect(
        service.splitEntry(FAMILY_GROUP_ID, SYNC_ID, ENTRY_ID, {
          accountId: ACCOUNT_ID,
          toAccountId: TO_ACCOUNT_ID,
          principalAmount: 100000,
          adminFee: 1000,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException when the entry does not belong to the sync", async () => {
      prisma.bankSync.findUnique.mockResolvedValue({ id: SYNC_ID });
      prisma.bankSyncEntry.findUnique.mockResolvedValue(null);

      await expect(
        service.splitEntry(FAMILY_GROUP_ID, SYNC_ID, ENTRY_ID, {
          accountId: ACCOUNT_ID,
          toAccountId: TO_ACCOUNT_ID,
          principalAmount: 100000,
          adminFee: 1000,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("rejects an already-matched entry", async () => {
      prisma.bankSync.findUnique.mockResolvedValue({ id: SYNC_ID });
      prisma.bankSyncEntry.findUnique.mockResolvedValue(
        buildEntryRow({ reconStatus: "matched", matchedTxId: "some-tx" }),
      );

      await expect(
        service.splitEntry(FAMILY_GROUP_ID, SYNC_ID, ENTRY_ID, {
          accountId: ACCOUNT_ID,
          toAccountId: TO_ACCOUNT_ID,
          principalAmount: 100000,
          adminFee: 1000,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(transactionsService.create).not.toHaveBeenCalled();
    });

    it("rejects a principal + fee sum that does not match the entry's absolute amount", async () => {
      prisma.bankSync.findUnique.mockResolvedValue({ id: SYNC_ID });
      // amount is -101000 → magnitude 101000
      prisma.bankSyncEntry.findUnique.mockResolvedValue(buildEntryRow());

      await expect(
        service.splitEntry(FAMILY_GROUP_ID, SYNC_ID, ENTRY_ID, {
          accountId: ACCOUNT_ID,
          toAccountId: TO_ACCOUNT_ID,
          principalAmount: 100000,
          adminFee: 2000, // sums to 102000, not 101000
        }),
      ).rejects.toThrow(BadRequestException);
      expect(transactionsService.create).not.toHaveBeenCalled();
    });

    it("creates the transfer via TransactionsService.create and marks the entry matched", async () => {
      prisma.bankSync.findUnique.mockResolvedValue({ id: SYNC_ID });
      prisma.bankSyncEntry.findUnique.mockResolvedValue(buildEntryRow());
      const transfer = buildTransferResponse();
      transactionsService.create.mockResolvedValue(transfer);
      prisma.bankSyncEntry.update.mockResolvedValue(
        buildEntryRow({ reconStatus: "matched", matchedTxId: TX_ID }),
      );

      const result = await service.splitEntry(
        FAMILY_GROUP_ID,
        SYNC_ID,
        ENTRY_ID,
        {
          accountId: ACCOUNT_ID,
          toAccountId: TO_ACCOUNT_ID,
          principalAmount: 100000,
          adminFee: 1000,
          description: "Top up GoPay",
        },
      );

      // Delegates entirely to TransactionsService.create — a real transfer +
      // adminFee, reusing its existing tenant validation / balance mechanics.
      expect(transactionsService.create).toHaveBeenCalledWith(
        FAMILY_GROUP_ID,
        expect.objectContaining({
          accountId: ACCOUNT_ID,
          toAccountId: TO_ACCOUNT_ID,
          amount: 100000,
          adminFee: 1000,
          type: "transfer",
          description: "Top up GoPay",
        }),
      );
      expect(prisma.bankSyncEntry.update).toHaveBeenCalledWith({
        where: { id: ENTRY_ID },
        data: { reconStatus: "matched", matchedTxId: TX_ID },
      });
      expect(result.matchedTxId).toBe(TX_ID);
      expect(result.matchedTransaction).toEqual(
        expect.objectContaining({ id: TX_ID, accountName: "BCA Tabungan" }),
      );
    });

    it("accepts a positive-amount entry too (abs() handles either sign)", async () => {
      prisma.bankSync.findUnique.mockResolvedValue({ id: SYNC_ID });
      prisma.bankSyncEntry.findUnique.mockResolvedValue(
        buildEntryRow({ amount: BigInt(101000) }),
      );
      transactionsService.create.mockResolvedValue(buildTransferResponse());
      prisma.bankSyncEntry.update.mockResolvedValue(
        buildEntryRow({ reconStatus: "matched", matchedTxId: TX_ID }),
      );

      await expect(
        service.splitEntry(FAMILY_GROUP_ID, SYNC_ID, ENTRY_ID, {
          accountId: ACCOUNT_ID,
          toAccountId: TO_ACCOUNT_ID,
          principalAmount: 100000,
          adminFee: 1000,
        }),
      ).resolves.toBeDefined();
    });

    it("propagates a NotFoundException from TransactionsService.create for a cross-tenant/invalid account", async () => {
      prisma.bankSync.findUnique.mockResolvedValue({ id: SYNC_ID });
      prisma.bankSyncEntry.findUnique.mockResolvedValue(buildEntryRow());
      transactionsService.create.mockRejectedValue(
        new NotFoundException("Account not found"),
      );

      await expect(
        service.splitEntry(FAMILY_GROUP_ID, SYNC_ID, ENTRY_ID, {
          accountId: ACCOUNT_ID,
          toAccountId: TO_ACCOUNT_ID,
          principalAmount: 100000,
          adminFee: 1000,
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.bankSyncEntry.update).not.toHaveBeenCalled();
    });
  });
});
