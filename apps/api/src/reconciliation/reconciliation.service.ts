import { extname } from "node:path";

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AiKeyService } from "../ai-advisor/ai-key.service";
// VALUE import, deliberately. A `type` import is erased at runtime, so
// `design:paramtypes[0]` degrades to `Function` and Nest cannot resolve it:
// "Nest can't resolve dependencies of the ReconciliationService (?, ...)".
// `eslint --fix` rewrote this line during a commit hook and took the whole API
// down — the same accident already documented in ai-advisor.service.ts. The
// three deps below carry the same guard for the same reason; do not let it.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TransactionsService } from "../transactions/transactions.service";

import { type PreviewStatementDraftDto } from "./dto/preview-statement-draft.dto";
import { type ReadStatementPdfPageDto } from "./dto/read-statement-pdf-page.dto";
import {
  MAX_STATEMENT_PDF_TEXT_CHARS,
  type ReadStatementPdfDto,
} from "./dto/read-statement-pdf.dto";
import {
  detectMapping,
  detectTableMapping,
  ExcelLimitExceededError,
  mapTableToRows,
  parseCsv,
  parseExcelBuffer,
} from "./reconciliation-parsers";
import { StatementReaderNotConfiguredError } from "./statement-reader/statement-reader-not-configured.error";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { StatementReaderFactory } from "./statement-reader/statement-reader.factory";
import { checkStatementTotals } from "./statement-totals.util";
import { ZipExpansionExceededError } from "./zip-bounds.util";

import type { CommitStatementDraftDto } from "./dto/commit-statement-draft.dto";
import type { SplitEntryDto } from "./dto/split-entry.dto";
import type { UpsertReconciliationTemplateDto } from "./dto/upsert-reconciliation-template.dto";
import type {
  DetectedTableMapping,
  MapTableResult,
  TemplateMapping,
} from "./reconciliation-parsers";
import type {
  StatementRawRow,
  StatementRawTotals,
} from "./statement-reader/statement-reader.port";
import type { TotalsVerdict } from "./statement-totals.util";
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

/**
 * EPIC-029 E2c — the header the AI's raw rows are laid out under before
 * they reach `mapTableToRows`. Every label is one the existing alias
 * detection already knows (`DATE_ALIASES` / `DESCRIPTION_ALIASES` /
 * `AMOUNT_ALIASES`), so this reuses the real mapping machinery rather than
 * hand-rolling a second one for PDFs.
 */
const STATEMENT_DRAFT_HEADER = ["Tanggal", "Keterangan", "Jumlah"] as const;

/** Mirrors `PDF_MIN_TEXT_CHARS` in the web app's `statement-pdf.ts`: below
 * this there is no text layer to read, only a scan. */
const MIN_STATEMENT_TEXT_CHARS = 200;
/** The same guard applied to a single page, which legitimately carries less
 *  text than a whole statement. A summary-only last page still clears this;
 *  a scanned page with no text layer does not. */
const MIN_STATEMENT_PAGE_TEXT_CHARS = 40;

function toTotalsVerdictDto(verdict: TotalsVerdict): StatementTotalsVerdictDto {
  return {
    status: verdict.status,
    tolerance: verdict.tolerance.toString(),
    checks: verdict.checks.map((check) => ({
      label: check.label,
      expected: check.expected.toString(),
      actual: check.actual.toString(),
      difference: check.difference.toString(),
      matched: check.matched,
    })),
  };
}

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

/* ─────────── EPIC-029 groups 2-3 — statement PDF read + preview ─────────── */

/**
 * One cross-check of the extracted rows against a figure the statement
 * printed itself. `bigint` fields are serialised as decimal strings on the
 * wire (`toStatementPreviewDto`) — `JSON.stringify` throws on a `bigint`,
 * and a `number` would reintroduce float rounding into a money field.
 */
export type StatementTotalsCheckDto = {
  label: "opening-to-closing" | "total-credit" | "total-debit";
  expected: string;
  actual: string;
  difference: string;
  matched: boolean;
};

export type StatementTotalsVerdictDto = {
  status: "matched" | "mismatch" | "unavailable";
  tolerance: string;
  checks: StatementTotalsCheckDto[];
};

/**
 * The raw, unparsed reading the AI produced — echoed back to the client so
 * the confirm step can post it unchanged. It carries STRINGS only; the
 * server re-parses them on commit, so nothing here can become a stored
 * amount without passing `parseStatementAmount` (E1).
 */
export type StatementDraftDto = {
  fileName: string;
  rows: StatementRawRow[];
  totals: StatementRawTotals;
};

/**
 * EPIC-029 E3a — what a statement read returns. NOTHING IS PERSISTED at
 * this point: there is no `BankSync`, no `BankSyncEntry`, and no id. The
 * user reviews this and explicitly confirms, which is what actually writes.
 */
/** EPIC-029 follow-up — one page's RAW reading, merged client-side and sent
 *  back to `previewStatementDraft`. Strings only, like every other statement
 *  payload: nothing here has been through `parseStatementAmount` yet. */
export type StatementPageReadDto = {
  pageIndex: number;
  rows: StatementRawRow[];
  totals: StatementRawTotals;
};

export type StatementPreviewDto = {
  fileName: string;
  pageCount: number;
  rowCount: number;
  /** Parsed and normalised, for display: ISO date + whole-rupiah string. */
  rows: { date: string; description: string; amount: string }[];
  skippedRows: SkippedRowDto[];
  skippedRowsTotal: number;
  totals: StatementTotalsVerdictDto;
  draft: StatementDraftDto;
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
  // EPIC-023 E3 (D12) — null for a credit-card purchase, which a bank
  // statement match should never realistically point to (it touches no
  // account), but the type must still allow it since Transaction.accountId
  // is now nullable.
  accountId: string | null;
  // EPIC-023 Task E retry (MEDIUM 5) — null (not "") when accountId is
  // null, symmetric with TransactionDto.accountName.
  accountName: string | null;
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
  accountId: string | null;
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
    accountName: tx.account?.name ?? null,
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
  /** Statement reads were entirely unobservable when one hung in production
   *  — no provider, no duration, no outcome. See `readStatementPdfPage`. */
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionsService: TransactionsService,
    // EPIC-029 E5 — the family's OWN AI key, resolved per request, exactly
    // as receipt OCR does it. There is no server key to fall back to and no
    // mock to answer with, by design.
    private readonly aiKeyService: AiKeyService,
    private readonly statementReaderFactory: StatementReaderFactory,
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
      // EPIC-029 — a PDF is now supported, but NOT here and not as a file.
      // `pdfjs-dist` decrypts for reading only and cannot emit a decrypted
      // PDF, so the text layer is extracted in the BROWSER and posted to
      // `POST statement-pdf` instead — which is what keeps the statement's
      // password inside the tab (E8/E9/E10).
      //
      // The refusal stays, rather than becoming a server-side PDF parser,
      // because uploading the file is genuinely still unsupported: this
      // route has no way to read one, and answering it with zero rows or a
      // guess is the failure this whole epic is written against.
      throw new UnprocessableEntityException(
        withCode(
          "Statement PDF tidak diunggah lewat jalur ini. Pilih file PDF dari halaman Rekonsiliasi — teksnya dibaca langsung di browser (password tidak pernah dikirim ke server), lalu ditinjau sebelum diimpor.",
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

    // EPIC-029 — auto-detection no longer assumes the header is row 1. A real
    // e-statement carries an account block above the table, and Mandiri
    // repeats the header in English on the row below it; `detectTableMapping`
    // finds the header and reports where the DATA starts. The saved-template
    // path is unchanged and still reads row 1.
    const detected = bankCode ? null : this.autoDetectMapping(table);
    const mapping = detected
      ? detected.mapping
      : await this.resolveTemplateMapping(familyGroupId, bankCode as string);

    let rows: ParsedRow[];
    let skipped: SkippedRowDto[];
    try {
      ({ rows, skipped } = mapTableToRows(
        table,
        mapping,
        detected
          ? {
              headerIndex: detected.headerIndex,
              dataStartIndex: detected.dataStartIndex,
            }
          : undefined,
      ));
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

  /* ───────── EPIC-029 groups 2-3 — statement PDF, read on the family key ───────── */

  /**
   * Reads a statement PDF's already-extracted text with the family's own AI
   * key and returns a PREVIEW. Nothing is stored (E3a).
   *
   * What arrives here is TEXT, not a file and not a password: `pdfjs-dist`
   * decrypts for reading only, so the extraction happens in the browser and
   * the password never leaves the tab (E8/E9/E10). See
   * `ReadStatementPdfDto`.
   *
   * The model's answer is a table of RAW STRINGS. It is turned into money by
   * `mapTableToRows` → `parseStatementAmount`/`parseStatementDate` — the
   * same, already-hardened code path the CSV and XLSX imports use — and then
   * cross-checked against the statement's own printed totals (E7).
   */
  async readStatementPdf(
    familyGroupId: string,
    dto: ReadStatementPdfDto,
  ): Promise<StatementPreviewDto> {
    const statementText = dto.pages.join("\n\n");
    if (statementText.length > MAX_STATEMENT_PDF_TEXT_CHARS) {
      throw new UnprocessableEntityException(
        withCode(
          "Statement ini terlalu panjang untuk dibaca sekaligus. Unggah per periode yang lebih pendek, atau ekspor mutasi sebagai CSV/Excel.",
          "STATEMENT_TEXT_TOO_LARGE",
        ),
      );
    }
    // E1c, re-checked server-side. The browser already refuses a scan, but a
    // near-empty prompt is exactly what makes a model invent a confident
    // table of money rows — so the paid call is not made on one.
    if (statementText.replace(/\s+/g, "").length < MIN_STATEMENT_TEXT_CHARS) {
      throw new UnprocessableEntityException(
        withCode(
          "PDF ini tidak punya lapisan teks yang bisa dibaca (kemungkinan hasil scan/foto). Unduh ulang e-statement asli dari aplikasi bank, atau ekspor mutasi sebagai CSV/Excel.",
          "STATEMENT_NO_TEXT_LAYER",
        ),
      );
    }

    // E5 — the family's own key, per request. No env key, no fallback, no
    // mock: "no key configured" is a real, actionable state.
    const resolvedKey =
      await this.aiKeyService.resolveDecryptedKey(familyGroupId);
    if (!resolvedKey) throw new StatementReaderNotConfiguredError();

    const reader = this.statementReaderFactory.create(
      resolvedKey.provider,
      resolvedKey.apiKey,
    );
    const reading = await reader.readStatement(statementText);

    if (reading.rows.length === 0) {
      throw new UnprocessableEntityException(
        withCode(
          "Tidak ada baris transaksi yang bisa dibaca dari PDF ini. Pastikan file adalah mutasi rekening, bukan ringkasan atau surat pemberitahuan.",
          "STATEMENT_NO_ROWS",
        ),
      );
    }

    return this.toStatementPreview(
      { fileName: dto.fileName, rows: reading.rows, totals: reading.totals },
      dto.pageCount,
    );
  }

  /**
   * EPIC-029 follow-up — reads ONE page with the family's key.
   *
   * Why not the whole statement in one call: in production a 5-page
   * statement ran past 120s, while nginx cuts an idle upstream at 60s and
   * Cloudflare caps a request at ~100s. The browser never saw the timeout
   * the API raised — it saw a dead connection. A page at a time is roughly
   * ten rows, which finishes well inside every ceiling.
   *
   * Returns the model's RAW strings. No parsing, no totals gate, nothing
   * stored: the merged result goes to `previewStatementDraft`, and the
   * numbers only become money there and again on commit.
   */
  async readStatementPdfPage(
    familyGroupId: string,
    dto: ReadStatementPdfPageDto,
  ): Promise<StatementPageReadDto> {
    // E1c, per page. A near-empty prompt is exactly what makes a model
    // invent a confident table of money rows, so the paid call is not made
    // on one. The floor is lower than the whole-document floor because a
    // single page legitimately carries less text; the browser skips blank
    // pages entirely and never sends them.
    if (dto.text.replace(/\s+/g, "").length < MIN_STATEMENT_PAGE_TEXT_CHARS) {
      throw new UnprocessableEntityException(
        withCode(
          "Halaman ini tidak punya lapisan teks yang bisa dibaca (kemungkinan hasil scan/foto). Unduh ulang e-statement asli dari aplikasi bank, atau ekspor mutasi sebagai CSV/Excel.",
          "STATEMENT_NO_TEXT_LAYER",
        ),
      );
    }

    const resolvedKey =
      await this.aiKeyService.resolveDecryptedKey(familyGroupId);
    if (!resolvedKey) throw new StatementReaderNotConfiguredError();

    const reader = this.statementReaderFactory.create(
      resolvedKey.provider,
      resolvedKey.apiKey,
    );

    // The read used to be entirely unobservable: when it hung in production
    // there was no provider, no duration and no outcome in the log, so the
    // cause had to be inferred from nginx's abort timing. One line per call
    // fixes that. It carries no statement text and no key — only what is
    // needed to tell "slow model" from "wrong key" from "no rows".
    const startedAt = Date.now();
    try {
      const reading = await reader.readStatement(dto.text);
      this.logger.log(
        `statement page read: provider=${resolvedKey.provider} page=${
          dto.pageIndex + 1
        }/${dto.pageCount} rows=${reading.rows.length} ms=${
          Date.now() - startedAt
        }`,
      );
      return {
        pageIndex: dto.pageIndex,
        rows: reading.rows,
        totals: reading.totals,
      };
    } catch (err: unknown) {
      this.logger.warn(
        `statement page read FAILED: provider=${resolvedKey.provider} page=${
          dto.pageIndex + 1
        }/${dto.pageCount} ms=${Date.now() - startedAt} err=${
          err instanceof Error ? err.name : typeof err
        }`,
      );
      throw err;
    }
  }

  /**
   * EPIC-029 follow-up — turns the merged per-page reading into a preview.
   *
   * No AI call, so this costs the family nothing and can be retried freely.
   * It runs the same deterministic pipeline the commit runs, which is what
   * makes a client-merged draft safe to accept: the totals gate that
   * actually protects the import is enforced on the request that WRITES.
   */
  previewStatementDraft(dto: PreviewStatementDraftDto): StatementPreviewDto {
    const draft: StatementDraftDto = {
      fileName: dto.fileName,
      rows: dto.rows.map((row) => ({
        date: row.date,
        description: row.description,
        amount: row.amount,
      })),
      totals: {
        openingBalance: dto.totals.openingBalance ?? null,
        closingBalance: dto.totals.closingBalance ?? null,
        totalCredit: dto.totals.totalCredit ?? null,
        totalDebit: dto.totals.totalDebit ?? null,
      },
    };
    return this.toStatementPreview(draft, dto.pageCount);
  }

  /** The preview body shared by the one-shot read and the merged read. */
  private toStatementPreview(
    draft: StatementDraftDto,
    pageCount: number,
  ): StatementPreviewDto {
    const { mapped, verdict } = this.parseStatementDraft(draft);
    return {
      fileName: draft.fileName,
      pageCount,
      rowCount: mapped.rows.length,
      rows: mapped.rows.map((row) => ({
        date: row.date.toISOString(),
        description: row.description,
        amount: row.amount.toString(),
      })),
      skippedRows: mapped.skipped.slice(0, MAX_SKIPPED_ROWS_RETURNED),
      skippedRowsTotal: mapped.skipped.length,
      totals: toTotalsVerdictDto(verdict),
      draft,
    };
  }

  /**
   * EPIC-029 E3a/E7 — the confirm step: re-parses the SAME raw draft the
   * preview returned and stores it.
   *
   * Deliberately re-runs everything rather than trusting the preview:
   *
   *  - the AI is not called again, so confirming is free;
   *  - every amount passes `parseStatementAmount` again, on this request;
   *  - the totals gate is enforced on the request that WRITES, so a client
   *    that never rendered the preview (or edited it) is refused identically.
   */
  async commitStatementDraft(
    familyGroupId: string,
    dto: CommitStatementDraftDto,
  ): Promise<BankSyncDto> {
    const draft: StatementDraftDto = {
      fileName: dto.fileName,
      rows: dto.rows.map((row) => ({
        date: row.date,
        description: row.description,
        amount: row.amount,
      })),
      totals: {
        openingBalance: dto.totals.openingBalance ?? null,
        closingBalance: dto.totals.closingBalance ?? null,
        totalCredit: dto.totals.totalCredit ?? null,
        totalDebit: dto.totals.totalDebit ?? null,
      },
    };

    const { mapped, verdict } = this.parseStatementDraft(draft);

    // E7 — a mismatch REFUSES. It is never imported "mostly right" behind a
    // warning: a row that silently went missing is invisible on a review
    // screen, because there is nothing there to look at.
    if (verdict.status === "mismatch") {
      throw new UnprocessableEntityException({
        message:
          "Total transaksi hasil pembacaan tidak cocok dengan total yang tertulis di statement — impor dibatalkan supaya tidak ada baris yang diam-diam hilang atau salah.",
        code: "STATEMENT_TOTALS_MISMATCH",
        totals: toTotalsVerdictDto(verdict),
      });
    }

    const rows: ParsedRow[] = mapped.rows.map((row) => ({
      date: row.date,
      description: row.description,
      amount: row.amount,
    }));
    const sync = await this.upload(familyGroupId, draft.fileName, rows);

    return mapped.skipped.length > 0
      ? {
          ...sync,
          skippedRows: mapped.skipped.slice(0, MAX_SKIPPED_ROWS_RETURNED),
          skippedRowsTotal: mapped.skipped.length,
        }
      : sync;
  }

  /**
   * The deterministic half of the PDF path, shared by preview and commit so
   * the two can never disagree about what the same draft means.
   *
   * E2c/E4 — the model's raw strings are laid out as an ordinary three-column
   * table and handed to the SAME `detectMapping` + `mapTableToRows` the CSV
   * and XLSX uploads use. There is no PDF-specific amount or date parsing
   * anywhere, and no per-bank branch: a BCA "3,000,000.00 DB" and a Mandiri
   * "-37.000,00" are already understood by `parseStatementAmount`.
   */
  private parseStatementDraft(draft: StatementDraftDto): {
    mapped: MapTableResult;
    verdict: TotalsVerdict;
  } {
    const table = [
      [...STATEMENT_DRAFT_HEADER],
      ...draft.rows.map((row) => [row.date, row.description, row.amount]),
    ];
    const mapping = detectMapping([...STATEMENT_DRAFT_HEADER]);
    /* istanbul ignore next -- the header is a constant in this file; if
       alias detection ever stops recognising it that is a bug here, not a
       user-facing state. */
    if (!mapping) {
      throw new Error("Statement draft header is no longer auto-detectable");
    }

    let mapped: MapTableResult;
    try {
      mapped = mapTableToRows(table, mapping);
    } catch (err) {
      throw new UnprocessableEntityException(
        withCode(
          err instanceof Error ? err.message : "Gagal memetakan hasil bacaan.",
          "STATEMENT_COLUMN_MAPPING_MISMATCH",
        ),
      );
    }

    if (mapped.rows.length === 0) {
      const reasons = new Set(mapped.skipped.map((skip) => skip.reason));
      const sharedReason = reasons.size === 1 ? [...reasons][0] : undefined;
      throw new UnprocessableEntityException(
        withCode(
          sharedReason
            ? `Tidak ada baris valid dari hasil pembacaan PDF ini. ${sharedReason}`
            : "Tidak ada baris valid dari hasil pembacaan PDF ini — coba lagi, atau ekspor mutasi sebagai CSV/Excel.",
          "STATEMENT_ZERO_VALID_ROWS",
        ),
      );
    }

    return { mapped, verdict: checkStatementTotals(mapped.rows, draft.totals) };
  }

  private autoDetectMapping(table: string[][]): DetectedTableMapping {
    const detected = detectTableMapping(table);
    if (!detected) {
      throw new BadRequestException(
        withCode(
          "Tidak bisa mendeteksi kolom tanggal/keterangan/jumlah secara otomatis. Simpan template pemetaan kolom untuk bank ini terlebih dahulu, atau pilih bank saat mengunggah.",
          "NO_AUTO_DETECT_MAPPING",
        ),
      );
    }
    return detected;
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
