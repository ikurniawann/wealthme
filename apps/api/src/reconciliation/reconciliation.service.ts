import { extname } from "node:path";

import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TransactionsService } from "../transactions/transactions.service";

import {
  detectMapping,
  ExcelLimitExceededError,
  mapTableToRows,
  parseCsv,
  parseExcelBuffer,
} from "./reconciliation-parsers";
import { ZipExpansionExceededError } from "./zip-bounds.util";

import type { SplitEntryDto } from "./dto/split-entry.dto";
import type { UpsertReconciliationTemplateDto } from "./dto/upsert-reconciliation-template.dto";
import type { TemplateMapping } from "./reconciliation-parsers";
import type { TransactionResponseDto } from "../transactions/dto/transaction-response.dto";

/** Structural subset of Express.Multer.File — kept narrow so this service
 * has no direct dependency on multer's types (easier to unit-test). */
export type UploadedStatementFile = {
  originalname: string;
  buffer: Buffer;
};

/**
 * EPIC-023 Task G retry (MEDIUM five-reviewer finding) — the refusal
 * messages below are Indonesian-only text surfaced VERBATIM to
 * English-locale users. Passed as a NestJS exception body object (not a
 * plain string), a stable `code` rides alongside the existing message so
 * the web app can render its own localized copy for every known refusal —
 * falling back to the raw (Indonesian) message only for a code it doesn't
 * recognise, never the other way around.
 */
function withCode(
  message: string,
  code: string,
): { message: string; code: string } {
  return { message, code };
}

/** EPIC-023 Task G retry (MEDIUM five-reviewer finding, round 2) — caps the
 * `skippedRows` list returned by `uploadFile` (see its `SkippedRowDto`
 * comment and `BankSyncDto.skippedRowsTotal`). A file with thousands of
 * skipped rows produced an unbounded, multi-hundred-KB response otherwise. */
export const MAX_SKIPPED_ROWS_RETURNED = 200;

export type ParsedRow = {
  date: Date;
  description: string;
  amount: bigint;
  currency?: string;
};

type BankSyncRow = {
  id: string;
  familyGroupId: string;
  fileName: string;
  uploadedAt: Date;
  rowCount: number;
};

type BankSyncEntryRow = {
  id: string;
  bankSyncId: string;
  date: Date;
  description: string;
  amount: bigint;
  currency: string;
  reconStatus: string;
  matchedTxId: string | null;
  suggestedTxId: string | null;
  createdAt: Date;
};

/**
 * EPIC-023 Task G retry (HIGH five-reviewer finding) — one row that failed
 * to map/parse, reported with its 1-indexed line number (header = line 1)
 * and a human-readable reason. Only ever populated by `uploadFile`'s
 * response — a partial import (some rows skipped) must never look
 * identical to a complete one.
 */
export type SkippedRowDto = {
  line: number;
  reason: string;
};

export type BankSyncDto = {
  id: string;
  familyGroupId: string;
  fileName: string;
  uploadedAt: string;
  rowCount: number;
  skippedRows?: SkippedRowDto[];
  // EPIC-023 Task G retry (MEDIUM five-reviewer finding, round 2) — the true
  // count of skipped rows, even when `skippedRows` itself is capped (see
  // `MAX_SKIPPED_ROWS_RETURNED`). Lets the UI say "and N more" instead of
  // rendering (or the wire carrying) every one of a 9,999-row skip list.
  skippedRowsTotal?: number;
};

/**
 * EPIC-021 Group C (#9) — read-only summary of the matched Transaction shown
 * inline on a reconciliation entry. `matchedTxId`/`suggestedTxId` on
 * `BankSyncEntry` are plain string columns (no Prisma relation — same
 * loose-FK convention as `Donation.transactionId`), so this is always
 * assembled via a manual second query, never a Prisma `include`.
 */
export type MatchedTransactionSummaryDto = {
  id: string;
  accountId: string;
  accountName: string;
  toAccountId: string | null;
  toAccountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  amount: string;
  type: string;
  description: string | null;
  occurredAt: string;
  createdAt: string;
};

export type BankSyncEntryDto = {
  id: string;
  bankSyncId: string;
  date: string;
  description: string;
  amount: string;
  currency: string;
  reconStatus: string;
  matchedTxId: string | null;
  suggestedTxId: string | null;
  createdAt: string;
  // EPIC-021 Group C (#9) — null when unmatched/suggested-only, or when the
  // matched transaction id no longer resolves to a row in this tenant.
  matchedTransaction: MatchedTransactionSummaryDto | null;
};

export type AutoMatchResultDto = {
  totalEntries: number;
  suggested: number;
};

/** Raw shape of a batch-fetched matched Transaction row (see getEntries). */
type RawMatchedTxRow = {
  id: string;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  amount: bigint;
  type: string;
  description: string | null;
  occurredAt: Date;
  createdAt: Date;
  account: { name: string } | null;
  toAccount: { name: string } | null;
  category: { name: string } | null;
};

function toMatchedTransactionDto(
  tx: RawMatchedTxRow,
): MatchedTransactionSummaryDto {
  return {
    id: tx.id,
    accountId: tx.accountId,
    accountName: tx.account?.name ?? "",
    toAccountId: tx.toAccountId,
    toAccountName: tx.toAccount?.name ?? null,
    categoryId: tx.categoryId,
    categoryName: tx.category?.name ?? null,
    amount: tx.amount.toString(),
    type: tx.type,
    description: tx.description,
    occurredAt: tx.occurredAt.toISOString(),
    createdAt: tx.createdAt.toISOString(),
  };
}

/** Maps the already-stringified TransactionsService response (used right
 * after `splitEntry` creates the transfer) into the same summary shape. */
function transactionResponseToMatchedSummary(
  tx: TransactionResponseDto,
): MatchedTransactionSummaryDto {
  return {
    id: tx.id,
    accountId: tx.accountId,
    accountName: tx.accountName,
    toAccountId: tx.toAccountId,
    toAccountName: tx.toAccountName,
    categoryId: tx.categoryId,
    categoryName: tx.categoryName,
    amount: tx.amount,
    type: tx.type,
    description: tx.description,
    occurredAt: tx.occurredAt,
    createdAt: tx.createdAt,
  };
}

export type ReconciliationTemplateDto = {
  id: string;
  familyGroupId: string;
  bankCode: string;
  name: string;
  dateColumn: string;
  descriptionColumn: string;
  amountColumn: string;
  dateFormat: string | null;
  createdAt: string;
  updatedAt: string;
};

type ReconciliationTemplateRow = {
  id: string;
  familyGroupId: string;
  bankCode: string;
  name: string;
  dateColumn: string;
  descriptionColumn: string;
  amountColumn: string;
  dateFormat: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toTemplateDto(
  row: ReconciliationTemplateRow,
): ReconciliationTemplateDto {
  return {
    id: row.id,
    familyGroupId: row.familyGroupId,
    bankCode: row.bankCode,
    name: row.name,
    dateColumn: row.dateColumn,
    descriptionColumn: row.descriptionColumn,
    amountColumn: row.amountColumn,
    dateFormat: row.dateFormat,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toBankSyncDto(row: BankSyncRow): BankSyncDto {
  return {
    id: row.id,
    familyGroupId: row.familyGroupId,
    fileName: row.fileName,
    uploadedAt: row.uploadedAt.toISOString(),
    rowCount: row.rowCount,
  };
}

function toBankSyncEntryDto(
  row: BankSyncEntryRow,
  matchedTransaction: MatchedTransactionSummaryDto | null = null,
): BankSyncEntryDto {
  return {
    id: row.id,
    bankSyncId: row.bankSyncId,
    date: row.date.toISOString(),
    description: row.description,
    amount: row.amount.toString(),
    currency: row.currency,
    reconStatus: row.reconStatus,
    matchedTxId: row.matchedTxId,
    suggestedTxId: row.suggestedTxId,
    createdAt: row.createdAt.toISOString(),
    matchedTransaction,
  };
}

@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async upload(
    familyGroupId: string,
    fileName: string,
    rows: ParsedRow[],
  ): Promise<BankSyncDto> {
    const sync = await this.prisma.$transaction(async (tx) => {
      const created = await tx.bankSync.create({
        data: {
          familyGroupId,
          fileName,
          rowCount: rows.length,
        },
      });

      if (rows.length > 0) {
        await tx.bankSyncEntry.createMany({
          data: rows.map((r) => ({
            bankSyncId: created.id,
            date: r.date,
            description: r.description,
            amount: r.amount,
            currency: r.currency ?? "IDR",
          })),
        });
      }

      return created;
    });

    return toBankSyncDto(sync);
  }

  /**
   * EPIC-023 G2 (D17) — real server-side parsing for the actual upload
   * flow. `upload()` above stays as the low-level pre-parsed-rows writer
   * (kept for programmatic callers and its existing test coverage); the web
   * app always calls this method now instead of parsing CSV client-side.
   *
   * Honesty bar: PDF is refused with a clear reason (never silently
   * "succeeds" with zero rows); any other unrecognised extension is
   * likewise refused rather than guessed at; and a table that yields zero
   * usable rows after mapping is a BadRequestException, never a stored
   * BankSync with rowCount 0.
   */
  async uploadFile(
    familyGroupId: string,
    file: UploadedStatementFile,
    bankCode?: string,
  ): Promise<BankSyncDto> {
    const ext = extname(file.originalname).toLowerCase();

    if (ext === ".pdf") {
      throw new UnprocessableEntityException(
        withCode(
          "Statement PDF tidak bisa diproses secara otomatis. Silakan ekspor mutasi rekening sebagai CSV dari aplikasi/situs bank Anda, lalu unggah file CSV tersebut.",
          "PDF_UNSUPPORTED",
        ),
      );
    }

    if (ext === ".xls") {
      // Legacy binary Excel (97-2003). `exceljs` reads only the modern
      // OOXML `.xlsx` format — refuse honestly rather than mis-parsing or
      // silently returning zero rows (see reconciliation-parsers.ts's
      // header comment for why this isn't the SheetJS/`xlsx` package).
      throw new BadRequestException(
        withCode(
          "Format .xls (Excel 97-2003) lama tidak didukung. Simpan ulang sebagai .xlsx, atau ekspor sebagai CSV dari aplikasi/situs bank Anda.",
          "XLS_UNSUPPORTED",
        ),
      );
    }

    let table: string[][];
    if (ext === ".csv") {
      table = parseCsv(file.buffer.toString("utf8"));
    } else if (ext === ".xlsx") {
      try {
        table = await parseExcelBuffer(file.buffer);
      } catch (err) {
        // EPIC-023 Task G retry (HIGH finding) — a zip-bomb-bound refusal
        // gets its own clear message; every other unreadable-workbook error
        // (corrupt file, wrong format renamed to .xlsx, ...) keeps the
        // existing generic message.
        // Both bounds report under the same code: to the user they are one
        // fact — "this workbook is too big to process" — and the distinction
        // between "declared expansion too large" and "too many rows/cells" is
        // ours, not theirs. Each carries its own specific message.
        if (
          err instanceof ExcelLimitExceededError ||
          err instanceof ZipExpansionExceededError
        ) {
          throw new BadRequestException(
            withCode(err.message, "XLSX_LIMIT_EXCEEDED"),
          );
        }
        throw new BadRequestException(
          withCode(
            "File Excel tidak bisa dibaca — pastikan file benar-benar .xlsx (bukan .xls yang diganti nama) dan tidak rusak.",
            "XLSX_UNREADABLE",
          ),
        );
      }
    } else {
      throw new BadRequestException(
        withCode(
          `Format file "${ext || file.originalname}" tidak didukung. Gunakan CSV atau Excel (.xlsx).`,
          "UNSUPPORTED_FORMAT",
        ),
      );
    }

    if (table.length === 0) {
      throw new BadRequestException(
        withCode(
          "File kosong — tidak ada baris yang bisa diimpor.",
          "EMPTY_FILE",
        ),
      );
    }

    const mapping = bankCode
      ? await this.resolveTemplateMapping(familyGroupId, bankCode)
      : this.autoDetectMapping(table[0] ?? []);

    let rows: ParsedRow[];
    let skipped: SkippedRowDto[];
    try {
      ({ rows, skipped } = mapTableToRows(table, mapping));
    } catch (err) {
      throw new BadRequestException(
        withCode(
          err instanceof Error ? err.message : "Gagal memetakan kolom file.",
          "COLUMN_MAPPING_MISMATCH",
        ),
      );
    }

    if (rows.length === 0) {
      // Every row was skipped individually, and `skipped` already holds the
      // specific, actionable reason for each. When they all failed the same
      // way — the common case, e.g. an ambiguous date column with no template
      // format set — say so, instead of making the user guess from a generic
      // "check your column mapping".
      const reasons = new Set(skipped.map((s) => s.reason));
      const sharedReason = reasons.size === 1 ? [...reasons][0] : undefined;
      throw new BadRequestException(
        withCode(
          sharedReason
            ? `Tidak ada baris valid yang bisa diimpor dari file ini. ${sharedReason}`
            : "Tidak ada baris valid yang bisa diimpor dari file ini — periksa pemetaan kolom, atau format tanggal/jumlah.",
          "ZERO_VALID_ROWS",
        ),
      );
    }

    const sync = await this.upload(familyGroupId, file.originalname, rows);

    // EPIC-023 Task G retry (HIGH finding) — a partial import (some rows
    // skipped) must never render as an unqualified success: surface exactly
    // which lines were dropped and why, alongside the successful rowCount.
    //
    // EPIC-023 Task G retry (MEDIUM five-reviewer finding, round 2) — the
    // list itself is bounded to `MAX_SKIPPED_ROWS_RETURNED`: a file with
    // thousands of skipped rows was measured producing a ~628 KB response
    // with no cap, one full line per row. `skippedRowsTotal` still carries
    // the real count so the UI can say "and N more" rather than silently
    // truncating with no indication more exist.
    return skipped.length > 0
      ? {
          ...sync,
          skippedRows: skipped.slice(0, MAX_SKIPPED_ROWS_RETURNED),
          skippedRowsTotal: skipped.length,
        }
      : sync;
  }

  private autoDetectMapping(header: string[]): TemplateMapping {
    const mapping = detectMapping(header);
    if (!mapping) {
      throw new BadRequestException(
        withCode(
          "Tidak bisa mendeteksi kolom tanggal/keterangan/jumlah secara otomatis. Simpan template pemetaan kolom untuk bank ini terlebih dahulu, atau pilih bank saat mengunggah.",
          "NO_AUTO_DETECT_MAPPING",
        ),
      );
    }
    return mapping;
  }

  private async resolveTemplateMapping(
    familyGroupId: string,
    bankCode: string,
  ): Promise<TemplateMapping> {
    const template = await this.prisma.reconciliationTemplate.findUnique({
      where: { familyGroupId_bankCode: { familyGroupId, bankCode } },
    });
    if (!template) {
      throw new NotFoundException(
        withCode(
          `Belum ada template pemetaan kolom untuk bank "${bankCode}" — buat template terlebih dahulu.`,
          "NO_SAVED_TEMPLATE",
        ),
      );
    }
    return {
      dateColumn: template.dateColumn,
      descriptionColumn: template.descriptionColumn,
      amountColumn: template.amountColumn,
      dateFormat: template.dateFormat,
    };
  }

  /** EPIC-023 G2 (D17) — list this family's saved bank column-mapping
   * templates. */
  async listTemplates(
    familyGroupId: string,
  ): Promise<ReconciliationTemplateDto[]> {
    const templates = await this.prisma.reconciliationTemplate.findMany({
      where: { familyGroupId },
      orderBy: { bankCode: "asc" },
    });
    return templates.map(toTemplateDto);
  }

  /** Create-or-replace by (familyGroupId, bankCode) — a family keeps at
   * most one template per bank. */
  async upsertTemplate(
    familyGroupId: string,
    dto: UpsertReconciliationTemplateDto,
  ): Promise<ReconciliationTemplateDto> {
    const template = await this.prisma.reconciliationTemplate.upsert({
      where: {
        familyGroupId_bankCode: { familyGroupId, bankCode: dto.bankCode },
      },
      create: {
        familyGroupId,
        bankCode: dto.bankCode,
        name: dto.name,
        dateColumn: dto.dateColumn,
        descriptionColumn: dto.descriptionColumn,
        amountColumn: dto.amountColumn,
        dateFormat: dto.dateFormat ?? null,
      },
      update: {
        name: dto.name,
        dateColumn: dto.dateColumn,
        descriptionColumn: dto.descriptionColumn,
        amountColumn: dto.amountColumn,
        dateFormat: dto.dateFormat ?? null,
      },
    });
    return toTemplateDto(template);
  }

  async deleteTemplate(familyGroupId: string, bankCode: string): Promise<void> {
    const template = await this.prisma.reconciliationTemplate.findUnique({
      where: { familyGroupId_bankCode: { familyGroupId, bankCode } },
    });
    if (!template) {
      throw new NotFoundException(`No saved template for bank "${bankCode}"`);
    }
    await this.prisma.reconciliationTemplate.delete({
      where: { id: template.id },
    });
  }

  async findAll(familyGroupId: string): Promise<BankSyncDto[]> {
    const syncs = await this.prisma.bankSync.findMany({
      where: { familyGroupId },
      orderBy: { uploadedAt: "desc" },
    });
    return syncs.map(toBankSyncDto);
  }

  async getEntries(
    familyGroupId: string,
    syncId: string,
  ): Promise<BankSyncEntryDto[]> {
    const sync = await this.prisma.bankSync.findUnique({
      where: { id: syncId, familyGroupId },
    });
    if (!sync) {
      throw new NotFoundException("BankSync not found");
    }

    const entries = await this.prisma.bankSyncEntry.findMany({
      where: { bankSyncId: syncId },
      orderBy: { date: "asc" },
    });

    const txById = await this.fetchMatchedTxMap(familyGroupId, entries);
    return entries.map((e) =>
      toBankSyncEntryDto(
        e,
        e.matchedTxId ? (txById.get(e.matchedTxId) ?? null) : null,
      ),
    );
  }

  /**
   * EPIC-021 Group C (#9) — batch-fetches the matched Transaction (+ account/
   * category names) for every entry that has a `matchedTxId`, in a single
   * query, instead of N+1 lookups per row. `matchedTxId` is a plain string
   * column with no Prisma relation (see `MatchedTransactionSummaryDto`
   * comment), so this manual join is the only option.
   */
  private async fetchMatchedTxMap(
    familyGroupId: string,
    entries: { matchedTxId: string | null }[],
  ): Promise<Map<string, MatchedTransactionSummaryDto>> {
    const ids = [
      ...new Set(
        entries
          .map((e) => e.matchedTxId)
          .filter((id): id is string => id !== null),
      ),
    ];
    if (ids.length === 0) return new Map();

    const txs = await this.prisma.transaction.findMany({
      where: { id: { in: ids }, familyGroupId },
      include: {
        account: { select: { name: true } },
        toAccount: { select: { name: true } },
        category: { select: { name: true } },
      },
    });

    return new Map(txs.map((t) => [t.id, toMatchedTransactionDto(t)]));
  }

  async matchEntry(
    familyGroupId: string,
    syncId: string,
    entryId: string,
    transactionId: string,
  ): Promise<BankSyncEntryDto> {
    const sync = await this.prisma.bankSync.findUnique({
      where: { id: syncId, familyGroupId },
    });
    if (!sync) {
      throw new NotFoundException("BankSync not found");
    }

    const entry = await this.prisma.bankSyncEntry.findUnique({
      where: { id: entryId, bankSyncId: syncId },
    });
    if (!entry) {
      throw new NotFoundException("BankSyncEntry not found");
    }

    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId, familyGroupId },
      include: {
        account: { select: { name: true } },
        toAccount: { select: { name: true } },
        category: { select: { name: true } },
      },
    });
    if (!tx) throw new NotFoundException("Transaction not found");

    const updated = await this.prisma.bankSyncEntry.update({
      where: { id: entryId },
      data: { reconStatus: "matched", matchedTxId: transactionId },
    });
    return toBankSyncEntryDto(updated, toMatchedTransactionDto(tx));
  }

  /**
   * EPIC-021 Group C (#29) — split a reconciliation line (bank shows one
   * combined amount, e.g. an e-wallet top-up + admin fee) into a real
   * principal transfer + linked fee expense, then mark the entry matched
   * against the transfer. Delegates the actual Transaction creation to
   * `TransactionsService.create`, which already tenant-validates both
   * accounts, rejects same-account transfers, and — per EPIC-021 Decision
   * #10/#28 — creates the admin-fee expense on the DESTINATION account
   * atomically with the transfer inside its own `$transaction`.
   *
   * NOT fully atomic end-to-end: `transactionsService.create` commits its
   * own `$transaction` first, then this method issues a SEPARATE
   * `bankSyncEntry.update` to record the match. If that second write fails,
   * the transfer/fee Transactions already exist but the entry stays
   * unmatched — a retry would then create a duplicate transfer. Accepted for
   * this iteration (matches the task's own "atomically-enough" framing); a
   * future hardening pass could expose a transaction-scoped create on
   * TransactionsService so both writes share one Prisma `$transaction`.
   */
  async splitEntry(
    familyGroupId: string,
    syncId: string,
    entryId: string,
    dto: SplitEntryDto,
  ): Promise<BankSyncEntryDto> {
    const sync = await this.prisma.bankSync.findUnique({
      where: { id: syncId, familyGroupId },
    });
    if (!sync) {
      throw new NotFoundException("BankSync not found");
    }

    const entry = await this.prisma.bankSyncEntry.findUnique({
      where: { id: entryId, bankSyncId: syncId },
    });
    if (!entry) {
      throw new NotFoundException("BankSyncEntry not found");
    }

    if (entry.reconStatus === "matched") {
      throw new BadRequestException(
        "Entry is already matched — unmatch it first before splitting",
      );
    }

    // Bank-statement amount follows signed convention (negative = money
    // leaving the account, the normal case for an e-wallet top-up debit);
    // principal/adminFee are always entered as positive magnitudes by the
    // user, so the sum is compared against the entry's absolute value.
    const entryMagnitude = entry.amount < 0n ? -entry.amount : entry.amount;
    const splitTotal = BigInt(dto.principalAmount) + BigInt(dto.adminFee);
    if (splitTotal !== entryMagnitude) {
      throw new BadRequestException(
        `Principal + admin fee (${splitTotal.toString()}) must equal the entry amount (${entryMagnitude.toString()})`,
      );
    }

    const transferResult = await this.transactionsService.create(
      familyGroupId,
      {
        accountId: dto.accountId,
        toAccountId: dto.toAccountId,
        amount: dto.principalAmount,
        adminFee: dto.adminFee,
        type: "transfer",
        description: dto.description,
        occurredAt: entry.date.toISOString(),
      },
    );
    // EPIC-023 Task D (D3/D9) — this internal call never passes an
    // actingMember, so TransactionsService.create's hold gate (row-scoped
    // roles only) can never trigger here; narrow defensively instead of
    // casting so a future signature change fails loudly, not silently.
    if ("held" in transferResult) {
      throw new Error(
        "Unexpected held expense from an internal reconciliation transfer",
      );
    }
    const transfer: TransactionResponseDto = transferResult;

    const updated = await this.prisma.bankSyncEntry.update({
      where: { id: entryId },
      data: { reconStatus: "matched", matchedTxId: transfer.id },
    });

    return toBankSyncEntryDto(
      updated,
      transactionResponseToMatchedSummary(transfer),
    );
  }

  async autoMatch(
    familyGroupId: string,
    syncId: string,
  ): Promise<AutoMatchResultDto> {
    const sync = await this.prisma.bankSync.findUnique({
      where: { id: syncId, familyGroupId },
    });
    if (!sync) {
      throw new NotFoundException("BankSync not found");
    }

    const entries = await this.prisma.bankSyncEntry.findMany({
      where: { bankSyncId: syncId, reconStatus: "unmatched" },
    });

    let suggested = 0;

    for (const entry of entries) {
      const dayBefore = new Date(entry.date);
      dayBefore.setDate(dayBefore.getDate() - 1);
      const dayAfter = new Date(entry.date);
      dayAfter.setDate(dayAfter.getDate() + 1);

      // Nominal tolerance: ±1% of the entry amount, floor ±1.000 IDR — catches
      // bank fees/rounding the old exact-match logic missed.
      const abs = entry.amount < 0n ? -entry.amount : entry.amount;
      const tolerance = abs / 100n > 1000n ? abs / 100n : 1000n;

      const candidates = await this.prisma.transaction.findMany({
        where: {
          familyGroupId,
          amount: {
            gte: entry.amount - tolerance,
            lte: entry.amount + tolerance,
          },
          occurredAt: { gte: dayBefore, lte: dayAfter },
        },
        select: { id: true, amount: true, description: true },
      });

      let best: { id: string; confidence: number } | null = null;
      for (const tx of candidates) {
        const diff =
          tx.amount > entry.amount
            ? tx.amount - entry.amount
            : entry.amount - tx.amount;
        const amountScore = 1 - Number(diff) / Number(tolerance);
        const descScore = tokenSimilarity(
          entry.description,
          tx.description ?? "",
        );
        // Amount dominates; description breaks ties and rescues near-misses.
        const confidence = amountScore * 0.7 + descScore * 0.3;
        if (!best || confidence > best.confidence) {
          best = { id: tx.id, confidence };
        }
      }

      // Suggest only (never auto-confirm); skip weak matches.
      if (best && best.confidence >= 0.5) {
        await this.prisma.bankSyncEntry.update({
          where: { id: entry.id },
          data: { reconStatus: "suggested", suggestedTxId: best.id },
        });
        suggested += 1;
      }
    }

    return { totalEntries: entries.length, suggested };
  }
}

/** Jaccard overlap of lowercased word tokens — cheap description similarity. */
export function tokenSimilarity(a: string, b: string): number {
  const tokens = (s: string): Set<string> =>
    new Set(
      s
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 1),
    );
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return shared / (ta.size + tb.size - shared);
}
