import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import ExcelJS from "exceljs";

import {
  MAX_SKIPPED_ROWS_RETURNED,
  ReconciliationService,
} from "./reconciliation.service";

import type { UploadedStatementFile } from "./reconciliation.service";
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
    reconciliationTemplate: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    transaction: { findMany: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
}

function makeTransactionsService() {
  return { create: jest.fn() };
}

/** EPIC-029 E5 — the family AI key + the statement reader it builds. Both are
 *  mocked here; the PDF path has its own suite in
 *  `reconciliation.service.statement-pdf.spec.ts`. */
function makeAiKeyService() {
  return { resolveDecryptedKey: jest.fn().mockResolvedValue(null) };
}

function makeStatementReaderFactory() {
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
    service = new ReconciliationService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transactionsService as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeAiKeyService() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeStatementReaderFactory() as any,
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

  // EPIC-023 G2 (D17) — real server-side parsing. These tests fail against
  // the pre-fix flow (web-side `split(",")` + ×100, non-CSV silently
  // sending `rows: []`): a quoted-comma CSV description would have been
  // truncated at the comma, and the stored amount would have been 100×
  // the file's value.
  describe("uploadFile", () => {
    function file(
      originalname: string,
      content: string,
    ): UploadedStatementFile {
      return { originalname, buffer: Buffer.from(content, "utf8") };
    }

    beforeEach(() => {
      prisma.$transaction.mockImplementation(
        async (cb: (tx: unknown) => unknown) => cb(prisma),
      );
    });

    it("refuses a PDF with a clear reason instead of importing zero rows", async () => {
      await expect(
        service.uploadFile(FAMILY_GROUP_ID, file("mutasi.pdf", "%PDF-1.4 ...")),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.bankSync.create).not.toHaveBeenCalled();
    });

    // EPIC-023 Task G retry (MEDIUM five-reviewer finding) — every refusal
    // carries a stable `code` alongside its Indonesian message, so the web
    // app can render a localized message for an English-locale user instead
    // of surfacing the Indonesian text verbatim.
    it("carries a stable error code on the PDF refusal for locale-aware rendering", async () => {
      try {
        await service.uploadFile(
          FAMILY_GROUP_ID,
          file("mutasi.pdf", "%PDF-1.4 ..."),
        );
        throw new Error("expected uploadFile to reject");
      } catch (err) {
        expect(err).toBeInstanceOf(UnprocessableEntityException);
        expect((err as UnprocessableEntityException).getResponse()).toEqual(
          expect.objectContaining({ code: "PDF_UNSUPPORTED" }),
        );
      }
    });

    it("refuses an unrecognised extension rather than guessing", async () => {
      await expect(
        service.uploadFile(FAMILY_GROUP_ID, file("mutasi.txt", "irrelevant")),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.bankSync.create).not.toHaveBeenCalled();
    });

    it("refuses legacy .xls (Excel 97-2003) with a clear reason — exceljs cannot read it", async () => {
      await expect(
        service.uploadFile(FAMILY_GROUP_ID, file("mutasi.xls", "irrelevant")),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.bankSync.create).not.toHaveBeenCalled();
    });

    it("imports a real .xlsx workbook", async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Mutasi");
      sheet.addRow(["Tanggal", "Keterangan", "Jumlah"]);
      sheet.addRow(["2026-08-01", "Setoran", 250000]);
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      prisma.bankSync.create.mockResolvedValue({
        id: SYNC_ID,
        familyGroupId: FAMILY_GROUP_ID,
        fileName: "mutasi.xlsx",
        uploadedAt: new Date(),
        rowCount: 1,
      });

      const result = await service.uploadFile(FAMILY_GROUP_ID, {
        originalname: "mutasi.xlsx",
        buffer,
      });

      expect(result.rowCount).toBe(1);
      expect(prisma.bankSyncEntry.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ amount: 250_000n })],
      });
    });

    it("throws instead of succeeding when the file has no rows", async () => {
      await expect(
        service.uploadFile(FAMILY_GROUP_ID, file("mutasi.csv", "")),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.bankSync.create).not.toHaveBeenCalled();
    });

    it("throws instead of succeeding when every row is unusable", async () => {
      const csv = "tanggal,keterangan,jumlah\n2026-08-01,Baris rusak,\n";
      await expect(
        service.uploadFile(FAMILY_GROUP_ID, file("mutasi.csv", csv)),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.bankSync.create).not.toHaveBeenCalled();
    });

    it("imports a CSV with a quoted comma description and the exact whole-rupiah amount (no ×100)", async () => {
      const csv =
        "tanggal,keterangan,jumlah\n" +
        '2026-08-01,"Belanja, Toko A",150000\n' +
        "2026-08-02,Transfer Masuk,500000\n";

      prisma.bankSync.create.mockResolvedValue({
        id: SYNC_ID,
        familyGroupId: FAMILY_GROUP_ID,
        fileName: "mutasi.csv",
        uploadedAt: new Date("2026-08-05T00:00:00.000Z"),
        rowCount: 2,
      });

      const result = await service.uploadFile(
        FAMILY_GROUP_ID,
        file("mutasi.csv", csv),
      );

      expect(result.rowCount).toBe(2);
      expect(prisma.bankSyncEntry.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            description: "Belanja, Toko A",
            amount: 150_000n,
          }),
          expect.objectContaining({
            description: "Transfer Masuk",
            amount: 500_000n,
          }),
        ],
      });
    });

    // EPIC-023 Task G retry (HIGH five-reviewer finding) — a partial import
    // must surface exactly which rows were skipped and why, not report an
    // unqualified success identical to a fully-clean import.
    it("surfaces skipped rows (with line + reason) alongside a successful partial import", async () => {
      const csv =
        "tanggal,keterangan,jumlah\n" +
        "2026-08-01,Baris valid,150000\n" +
        "2026-08-02,Baris rusak,\n";

      prisma.bankSync.create.mockResolvedValue({
        id: SYNC_ID,
        familyGroupId: FAMILY_GROUP_ID,
        fileName: "mutasi.csv",
        uploadedAt: new Date("2026-08-05T00:00:00.000Z"),
        rowCount: 1,
      });

      const result = await service.uploadFile(
        FAMILY_GROUP_ID,
        file("mutasi.csv", csv),
      );

      expect(result.rowCount).toBe(1);
      expect(result.skippedRows).toEqual([
        expect.objectContaining({ line: 3, reason: expect.any(String) }),
      ]);
    });

    // EPIC-023 Task G retry (MEDIUM five-reviewer finding, round 2) — an
    // unbounded skippedRows list produced a ~628 KB response for a
    // 9,999-skip file; the list is now capped, with the real count still
    // reported separately so the UI can say "and N more".
    it("caps the returned skippedRows list and reports the real total separately", async () => {
      const skipRowCount = MAX_SKIPPED_ROWS_RETURNED + 5;
      const lines = ["tanggal,keterangan,jumlah"];
      for (let i = 0; i < skipRowCount; i++) {
        lines.push(`2026-08-01,Baris rusak ${i},`); // missing amount -> skipped
      }
      lines.push("2026-08-02,Baris valid,100000");
      const csv = lines.join("\n") + "\n";

      prisma.bankSync.create.mockResolvedValue({
        id: SYNC_ID,
        familyGroupId: FAMILY_GROUP_ID,
        fileName: "mutasi.csv",
        uploadedAt: new Date("2026-08-05T00:00:00.000Z"),
        rowCount: 1,
      });

      const result = await service.uploadFile(
        FAMILY_GROUP_ID,
        file("mutasi.csv", csv),
      );

      expect(result.skippedRows).toHaveLength(MAX_SKIPPED_ROWS_RETURNED);
      expect(result.skippedRowsTotal).toBe(skipRowCount);
    });

    it("omits skippedRows entirely when every row imports cleanly", async () => {
      prisma.bankSync.create.mockResolvedValue({
        id: SYNC_ID,
        familyGroupId: FAMILY_GROUP_ID,
        fileName: "mutasi.csv",
        uploadedAt: new Date(),
        rowCount: 1,
      });

      const result = await service.uploadFile(
        FAMILY_GROUP_ID,
        file(
          "mutasi.csv",
          "tanggal,keterangan,jumlah\n2026-08-01,Setoran,100000\n",
        ),
      );

      expect(result.skippedRows).toBeUndefined();
    });

    it("applies a saved bank template's column mapping when bankCode is given", async () => {
      prisma.reconciliationTemplate.findUnique.mockResolvedValue({
        id: "tpl-1",
        familyGroupId: FAMILY_GROUP_ID,
        bankCode: "BCA",
        name: "BCA Giro",
        dateColumn: "Tgl Transaksi",
        descriptionColumn: "Uraian Transaksi",
        amountColumn: "Nominal",
        dateFormat: "DD/MM/YYYY",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.bankSync.create.mockResolvedValue({
        id: SYNC_ID,
        familyGroupId: FAMILY_GROUP_ID,
        fileName: "bca.csv",
        uploadedAt: new Date(),
        rowCount: 1,
      });

      const csv =
        "Tgl Transaksi,Uraian Transaksi,Nominal\n05/08/2026,Setoran,250000\n";

      await service.uploadFile(FAMILY_GROUP_ID, file("bca.csv", csv), "BCA");

      expect(prisma.reconciliationTemplate.findUnique).toHaveBeenCalledWith({
        where: {
          familyGroupId_bankCode: {
            familyGroupId: FAMILY_GROUP_ID,
            bankCode: "BCA",
          },
        },
      });
      expect(prisma.bankSyncEntry.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ amount: 250_000n })],
      });
    });

    it("throws NotFoundException when bankCode has no saved template", async () => {
      prisma.reconciliationTemplate.findUnique.mockResolvedValue(null);

      await expect(
        service.uploadFile(
          FAMILY_GROUP_ID,
          file("mutasi.csv", "tanggal,keterangan,jumlah\n2026-08-01,x,100\n"),
          "BCA",
        ),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.bankSync.create).not.toHaveBeenCalled();
    });
  });

  describe("reconciliation templates", () => {
    it("lists templates mapped to the DTO shape", async () => {
      prisma.reconciliationTemplate.findMany.mockResolvedValue([
        {
          id: "tpl-1",
          familyGroupId: FAMILY_GROUP_ID,
          bankCode: "BCA",
          name: "BCA Giro",
          dateColumn: "Tanggal",
          descriptionColumn: "Keterangan",
          amountColumn: "Jumlah",
          dateFormat: null,
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
          updatedAt: new Date("2026-08-01T00:00:00.000Z"),
        },
      ]);

      const result = await service.listTemplates(FAMILY_GROUP_ID);

      expect(result).toEqual([
        expect.objectContaining({ id: "tpl-1", bankCode: "BCA" }),
      ]);
    });

    it("upserts a template keyed by (familyGroupId, bankCode)", async () => {
      prisma.reconciliationTemplate.upsert.mockResolvedValue({
        id: "tpl-1",
        familyGroupId: FAMILY_GROUP_ID,
        bankCode: "BCA",
        name: "BCA Giro",
        dateColumn: "Tanggal",
        descriptionColumn: "Keterangan",
        amountColumn: "Jumlah",
        dateFormat: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.upsertTemplate(FAMILY_GROUP_ID, {
        bankCode: "BCA",
        name: "BCA Giro",
        dateColumn: "Tanggal",
        descriptionColumn: "Keterangan",
        amountColumn: "Jumlah",
      });

      expect(prisma.reconciliationTemplate.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            familyGroupId_bankCode: {
              familyGroupId: FAMILY_GROUP_ID,
              bankCode: "BCA",
            },
          },
        }),
      );
    });

    it("throws NotFoundException deleting a template that does not exist", async () => {
      prisma.reconciliationTemplate.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteTemplate(FAMILY_GROUP_ID, "BCA"),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.reconciliationTemplate.delete).not.toHaveBeenCalled();
    });
  });
});
