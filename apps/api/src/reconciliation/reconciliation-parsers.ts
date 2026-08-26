import { Readable } from "node:stream";

import ExcelJS from "exceljs";

import { assertZipExpansionWithinBounds } from "./zip-bounds.util";

import type { CellValue } from "exceljs";

/**
 * EPIC-023 G2 (D17) — pure parsing helpers for bank statement imports.
 * Kept separate from ReconciliationService so every rule (quoted CSV
 * fields, no ×100, column-mapping resolution) is independently
 * unit-testable without a Prisma mock.
 *
 * Where parsing happens: entirely SERVER-SIDE. `UploadSyncDto`'s
 * pre-parsed-rows shape stays as a lower-level primitive
 * (ReconciliationService.upload) for programmatic callers, but the web app
 * now always sends the raw file to `POST .../reconciliation/upload-file`,
 * which parses here. This replaces the old client-side CSV parser (naive
 * `split(",")`, ×100 multiplication) with one consistent, tested path.
 *
 * Excel parsing uses `exceljs` rather than the more commonly reached-for
 * `xlsx` (SheetJS) package: SheetJS stopped publishing patched releases to
 * the npm registry after 0.18.5, which carries two open HIGH-severity
 * advisories (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9) with no npm-published
 * fix — `pnpm audit` blocks on it. `exceljs` is actively maintained on npm
 * with no open high/critical advisories at the pinned version.
 */

export type TemplateMapping = {
  dateColumn: string;
  descriptionColumn: string;
  /** A single, signed amount column. Empty string when the file instead
   * carries a `creditColumn`/`debitColumn` pair (see `CREDIT_ALIASES`). */
  amountColumn: string;
  dateFormat?: string | null;
  /**
   * EPIC-029 — the money-in / money-out column pair used by the Mandiri and
   * BCA e-statement exports, which have no signed amount column at all.
   *
   * Optional and additive: a saved per-bank template (which persists only
   * date/description/amount) never sets them, so the template path is
   * untouched. Both must be present together, or neither.
   */
  creditColumn?: string | null;
  debitColumn?: string | null;
};

/** Where the header is, and where the data underneath it begins — the two
 * facts `mapTableToRows` cannot assume for a real bank export. */
export type DetectedTableMapping = {
  mapping: TemplateMapping;
  /** 0-based row index of the header row the mapping was read from. */
  headerIndex: number;
  /** 0-based row index of the first DATA row (past any bilingual twin). */
  dataStartIndex: number;
};

export type ParsedStatementRow = {
  date: Date;
  description: string;
  amount: bigint;
};

/** A data row that failed to map/parse, with its 1-indexed line number
 * (counting the header as line 1) and a human-readable reason — surfaced to
 * the caller instead of being silently dropped (see `mapTableToRows`). */
export type SkippedRow = {
  line: number;
  reason: string;
};

export type MapTableResult = {
  rows: ParsedStatementRow[];
  skipped: SkippedRow[];
};

/** Thrown when a workbook exceeds the row/cell processing bound — a defense
 * against a small `.xlsx` that decompresses into an enormous in-memory
 * table ("zip bomb"). Distinguished from a generic unreadable-file error so
 * the caller can give the user an actionable message. */
export class ExcelLimitExceededError extends Error {}

/** Header aliases used when no saved template applies — matches common
 * Indonesian and English bank-statement export headers.
 *
 * Matching is EXACT against the normalised label (see `normaliseLabel`), not
 * a substring test: a preamble line such as "Periode Tanggal: 01 Agu - 23
 * Agu" must never read as a date header, and a substring test would make it
 * one. */
const DATE_ALIASES = ["tanggal", "date", "tgl"];
const DESCRIPTION_ALIASES = [
  "keterangan",
  "deskripsi",
  "description",
  "uraian",
  "narasi",
  "remarks",
];
/** A single, SIGNED amount column. Kept deliberately separate from the
 * money-in/money-out pair below: a file that has both an "in" and an "out"
 * column has no single signed column, and picking either one of them as
 * "the amount" would import half the statement with the right sign and drop
 * the other half silently. */
const AMOUNT_ALIASES = ["jumlah", "nominal", "amount", "mutasi"];

/**
 * EPIC-029 — money-in / money-out column pairs.
 *
 * The Mandiri and BCA e-statement exports do not carry a signed amount at
 * all; they carry two columns ("Dana Masuk (IDR)" / "Dana Keluar (IDR)",
 * and their English twins), with the unused one left blank or zero. Both
 * halves are required before either is used — a lone "Dana Masuk" with no
 * matching outgoing column tells us nothing about how outgoing money is
 * represented, so it is refused rather than assumed to be all-positive.
 */
const CREDIT_ALIASES = [
  "dana masuk",
  "incoming transactions",
  "kredit",
  "credit",
  "pemasukan",
];
const DEBIT_ALIASES = [
  "dana keluar",
  "outgoing transactions",
  "debet",
  "debit",
  "pengeluaran",
];
/** Never mapped to anything — a running balance is not a transaction amount.
 * Used only as evidence when scoring which row is the header. */
const BALANCE_ALIASES = ["saldo", "balance"];

/**
 * Normalises a header cell for alias matching: case-folded, whitespace runs
 * (including the newlines and non-breaking spaces these exports are full of)
 * collapsed to one space, and a single trailing parenthesised qualifier
 * dropped so "Dana Masuk (IDR)" and "Saldo (IDR)" match the same aliases as
 * their unqualified forms.
 */
function normaliseLabel(cell: string): string {
  return cell
    .replace(/[\s\u00a0]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s*\([^)]*\)$/, "")
    .trim();
}

/**
 * Every column whose label matches one of `aliases`.
 *
 * Returns ALL matches, not the first: two columns matching the same category
 * is an ambiguity the caller must refuse (see `buildRowMapping`). Picking the
 * first would silently decide, for example, which of two date-ish columns the
 * whole import is keyed on.
 */
function matchingColumns(
  header: readonly string[],
  aliases: string[],
): number[] {
  const found: number[] = [];
  header.forEach((cell, index) => {
    if (aliases.includes(normaliseLabel(cell))) found.push(index);
  });
  return found;
}

/** The one matching column, or -1 when there is none or more than one. */
function singleColumn(header: readonly string[], aliases: string[]): number {
  const found = matchingColumns(header, aliases);
  return found.length === 1 ? (found[0] ?? -1) : -1;
}

/** Parses one CSV line into fields, honouring RFC4180-style quoting: a
 * quoted field may contain commas, and `""` inside a quoted field is an
 * escaped literal quote. */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

export function parseCsv(text: string): string[][] {
  return text
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim() !== "")
    .map(parseCsvLine);
}

/** Renders a single exceljs `CellValue` as text. Real Date cells are
 * rendered as "yyyy-mm-dd" so the ISO fallback in `parseStatementDate`
 * handles them without needing `dateFormat` — text-only date columns still
 * rely on it. Formula cells use their computed `result`; rich text and
 * hyperlink cells use their display `text`. */
function cellValueToString(value: CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "object") {
    if ("richText" in value) {
      return value.richText.map((part) => part.text).join("");
    }
    if ("text" in value) {
      // CellHyperlinkValue
      return value.text;
    }
    if ("result" in value) {
      // CellFormulaValue / CellSharedFormulaValue
      const result = value.result;
      if (result == null) return "";
      if (result instanceof Date) return result.toISOString().slice(0, 10);
      if (typeof result === "object") return "";
      return String(result);
    }
    if ("error" in value) return "";
    return "";
  }
  return String(value).trim();
}

// Bounds the in-memory table this module builds from a parsed workbook. A
// 20 MiB compressed upload legitimately decompressing beyond these bounds is
// already far past any real bank statement's size.
export const MAX_XLSX_ROWS = 20_000;
export const MAX_XLSX_CELLS = 500_000;

/**
 * Reads the first sheet of an Excel workbook into a 2D string table.
 *
 * EPIC-023 Task G retry (HIGH five-reviewer finding) — uses ExcelJS's
 * STREAMING `stream.xlsx.WorkbookReader` rather than `workbook.xlsx.load()`.
 * `.load()` is non-streaming: it fully materialises the ENTIRE worksheet in
 * memory before this function ever sees a row, so the MAX_XLSX_ROWS/CELLS
 * caps below ran too late to bound a crafted file that decompresses far
 * beyond them — a reviewer measured a 3.6 MiB file (300k rows) driving RSS
 * to 774 MiB via `.load()` before the cap fired even once. The streaming
 * reader parses the zip/XML incrementally, so the caps below trip DURING
 * parsing and abort the read early, before the rest of the file is ever
 * decompressed — the actual fix, not just a check that runs too late.
 */
export async function parseExcelBuffer(buffer: Buffer): Promise<string[][]> {
  // Bound what the archive really expands to, before exceljs is handed a byte.
  // Every cap inside the parser was defeated by moving to whichever part was
  // still being read (styles, then sharedStrings) — those are read in full
  // before the first row is yielded, so the row/cell caps below never see them.
  // This inflates each entry for real and counts the output, so an
  // under-declared size or a forged trailer changes nothing. See
  // zip-bounds.util.ts for the two measured bypasses this closes.
  assertZipExpansionWithinBounds(buffer);

  const reader = new ExcelJS.stream.xlsx.WorkbookReader(
    // `Readable.from(buffer)` special-cases a Buffer/string input into ONE
    // chunk (verified) rather than iterating it byte-by-byte the way a
    // generic iterable would.
    Readable.from(buffer),
    {
      worksheets: "emit",
      sharedStrings: "cache",
      hyperlinks: "ignore",
      // "ignore", NOT "cache". An earlier revision cached styles so a
      // Date-formatted cell would resolve to a JS `Date`, on the assumption
      // that "styles.xml is small and independent of row count". That
      // assumption is false and was disproven by measurement: an 18.6 MiB
      // file whose worksheet holds THREE cells, but whose styles.xml carries
      // ~2.5M distinct numFmt/cellXfs entries, drove peak RSS to 696 MiB over
      // 11.2s. MAX_XLSX_ROWS/MAX_XLSX_CELLS cannot catch it — they count data
      // rows and cells, and the style table is loaded independently of both.
      // That reopened, through a second door, the same decompression-
      // amplification hole the streaming switch was made to close.
      //
      // Ignoring styles costs nothing here: a Date cell then arrives as its
      // bare Excel serial, and `parseStatementDate` already routes a bare
      // integer through `parseExcelSerialDate` (EXCEL_SERIAL_EPOCH_OFFSET_DAYS),
      // which yields the identical instant. Verified: serial 46037 and the
      // cached-styles `Date` both resolve to 2026-01-15T00:00:00.000Z.
      styles: "ignore",
      entries: "ignore",
    },
  );

  const rows: string[][] = [];
  let totalCells = 0;

  for await (const worksheet of reader) {
    for await (const row of worksheet) {
      if (rows.length >= MAX_XLSX_ROWS) {
        throw new ExcelLimitExceededError(
          `File Excel melebihi batas ${MAX_XLSX_ROWS} baris yang bisa diproses — pisahkan menjadi beberapa file yang lebih kecil.`,
        );
      }
      const values = row.values;
      const cells: string[] = [];
      if (Array.isArray(values)) {
        // exceljs rows are 1-indexed (index 0 is unused/undefined).
        for (let i = 1; i < values.length; i++) {
          cells.push(cellValueToString(values[i] as CellValue).trim());
        }
      }
      totalCells += cells.length;
      if (totalCells > MAX_XLSX_CELLS) {
        throw new ExcelLimitExceededError(
          `File Excel melebihi batas ${MAX_XLSX_CELLS} sel yang bisa diproses — pisahkan menjadi beberapa file yang lebih kecil.`,
        );
      }
      rows.push(cells);
    }
    break; // Only the first sheet — matches the old `workbook.worksheets[0]`.
  }

  return rows.filter((row) => row.some((cell) => cell !== ""));
}

export function findColumnIndex(header: string[], column: string): number {
  const needle = column.trim().toLowerCase();
  const byName = header.findIndex((h) => h.trim().toLowerCase() === needle);
  if (byName !== -1) return byName;

  const asIndex = Number(column);
  return Number.isInteger(asIndex) && asIndex >= 0 && asIndex < header.length
    ? asIndex
    : -1;
}

// ─────────────────────────── Amount parsing ───────────────────────────

const DEBIT_MARKERS = ["dr", "db", "d"] as const;
const CREDIT_MARKERS = ["cr", "kr", "c"] as const;

type SignMarker = "debit" | "credit" | null;

/** Finds a leading/trailing marker from `markers` (case-insensitive, with or
 * without a separating space) anchored against a digit, and returns the
 * remaining string with the marker removed — or `null` when none of the
 * markers are present. */
function stripMarker(
  trimmed: string,
  markers: readonly string[],
): string | null {
  for (const marker of markers) {
    const suffixRe = new RegExp(`\\d\\s*${marker}$`, "i");
    if (suffixRe.test(trimmed)) {
      return trimmed.slice(0, trimmed.length - marker.length).trimEnd();
    }
    const prefixRe = new RegExp(`^${marker}\\s*\\d`, "i");
    if (prefixRe.test(trimmed)) {
      return trimmed.slice(marker.length).trimStart();
    }
  }
  return null;
}

/** Extracts a CR/DR-style sign marker (debit = money out = negative, credit
 * = money in = positive) — a common bank-export convention alongside or
 * instead of a signed number. Returns `marker: null` when no marker is
 * present so the caller falls back to parentheses/leading-minus detection
 * instead of applying both signals (which would double-apply the sign). */
function extractSignMarker(trimmed: string): {
  rest: string;
  marker: SignMarker;
} {
  const debitRest = stripMarker(trimmed, DEBIT_MARKERS);
  if (debitRest !== null) return { rest: debitRest, marker: "debit" };
  const creditRest = stripMarker(trimmed, CREDIT_MARKERS);
  if (creditRest !== null) return { rest: creditRest, marker: "credit" };
  return { rest: trimmed, marker: null };
}

/**
 * Disambiguates "." / "," as a decimal point vs. a thousands separator by
 * POSITION rather than assuming: a properly-grouped thousands separator's
 * final (rightmost) group is always exactly 3 digits, so a last separator
 * followed by exactly 1 or 2 digits at the end of the string can only be a
 * decimal point. Every other separator — including a last one followed by 3
 * digits — is a thousands separator. Storage is whole-rupiah `BigInt`, so
 * any decimal fraction is rounded half-up to the nearest whole rupiah.
 */
function parseUnsignedMagnitude(numericPart: string, raw: string): bigint {
  const lastSepIndex = Math.max(
    numericPart.lastIndexOf("."),
    numericPart.lastIndexOf(","),
  );

  if (lastSepIndex === -1) {
    return BigInt(numericPart);
  }

  const fractionCandidate = numericPart.slice(lastSepIndex + 1);
  const isDecimalPoint = /^\d{1,2}$/.test(fractionCandidate);

  if (!isDecimalPoint) {
    const digitsOnly = numericPart.replace(/[.,]/g, "");
    if (!digitsOnly) throw new Error(`Cannot parse amount: "${raw}"`);
    return BigInt(digitsOnly);
  }

  const integerDigits = numericPart.slice(0, lastSepIndex).replace(/[.,]/g, "");
  const wholePart = integerDigits ? BigInt(integerDigits) : 0n;
  const fractionValue =
    Number(fractionCandidate) / Math.pow(10, fractionCandidate.length);
  return fractionValue >= 0.5 ? wholePart + 1n : wholePart;
}

// EPIC-023 Task G retry (MEDIUM five-reviewer finding) — Indonesian bank
// exports commonly prefix the amount with the currency symbol
// ("Rp 150.000,00"); stripped before any other validation so it isn't
// misread as an unparseable value (a regression a prior retry introduced).
// "Rp", "Rp.", and "IDR" all appear as an in-cell currency label on real
// Indonesian bank exports. Stripped before the numeric shape is validated so
// a labelled amount imports rather than being skipped as unparseable.
const CURRENCY_SYMBOL_RE = /^(?:rp\.?|idr)\s*/i;

// EPIC-023 Task G retry (MEDIUM five-reviewer finding) — a separator run
// that starts/ends the numeric part, or repeats back-to-back ("1,,000",
// "1.000,"), can only be a corrupted cell — a genuine thousands/decimal
// separator always has a digit on both sides. Rejecting this prevents the
// digits-only fallback in `parseUnsignedMagnitude` from silently treating
// garbage punctuation as if it were harmless grouping.
const MALFORMED_SEPARATOR_RE = /^[.,]|[.,]$|[.,]{2,}/;

/**
 * Parses a bank-statement amount cell into whole-rupiah `bigint`, matching
 * the BigInt whole-rupiah convention used across Transaction/BankSyncEntry.
 * This is the fix for the ×100 corruption bug: the parsed amount equals the
 * file's amount exactly, with no scaling applied anywhere.
 *
 * Handles, in order:
 *  - a leading currency symbol ("Rp"), stripped before anything else;
 *  - a leading/trailing CR/DR-style marker (debit → negative, credit →
 *    positive) — the authoritative sign when present, so an explicit
 *    leading "-"/parentheses alongside a marker is never ALSO applied
 *    (that would double the sign, not cancel or compound correctly);
 *  - a leading "-" or wrapping parentheses as negative, when no marker;
 *  - "." / "," disambiguated as decimal point vs. thousands separator by
 *    position (see `parseUnsignedMagnitude`), after rejecting a malformed
 *    separator run (see `MALFORMED_SEPARATOR_RE`).
 */
export function parseStatementAmount(raw: string): bigint {
  const trimmedRaw = raw.trim();
  if (!trimmedRaw) throw new Error("Empty amount");

  const withoutCurrency = trimmedRaw.replace(CURRENCY_SYMBOL_RE, "");

  const { rest, marker } = extractSignMarker(withoutCurrency);
  const withoutMarker = rest.trim();
  if (!withoutMarker) throw new Error(`Cannot parse amount: "${raw}"`);

  const wrappedInParens = /^\(.*\)$/.test(withoutMarker);
  const unwrapped = wrappedInParens
    ? withoutMarker.slice(1, -1).trim()
    : withoutMarker;
  const explicitlyNegative = wrappedInParens || unwrapped.startsWith("-");
  // EPIC-029 — an EXPLICIT "+" is accepted alongside "-", and the space some
  // banks put between the sign and the digits is dropped.
  //
  // This is not tidying: Mandiri's e-statement prints its own summary as
  // "Dana Masuk : + 15.630.000,00" and its incoming rows as "+4.350.000,00".
  // Without this, `/^[\d.,]+$/` below rejected both — so every incoming row
  // on a real statement was skipped as unparseable, and the totals gate had
  // nothing to check against. A leading "+" cannot mean anything other than
  // "positive", so accepting it narrows nothing.
  const signed = /^[+-]/.test(unwrapped);
  const numericPart = signed ? unwrapped.slice(1).trim() : unwrapped;

  if (
    !numericPart ||
    !/^[\d.,]+$/.test(numericPart) ||
    MALFORMED_SEPARATOR_RE.test(numericPart)
  ) {
    throw new Error(`Cannot parse amount: "${raw}"`);
  }

  const magnitude = parseUnsignedMagnitude(numericPart, raw);
  const negative = marker ? marker === "debit" : explicitlyNegative;

  return negative ? -magnitude : magnitude;
}

// ─────────────────────────── Date parsing ───────────────────────────

const MIN_PLAUSIBLE_YEAR = 1970;
const MAX_PLAUSIBLE_YEAR = 2100;
const SLASH_DATE_RE = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/;
// Days between the Excel serial-date epoch (1899-12-30) and the Unix epoch
// (1970-01-01) — the standard offset for converting an Excel day-serial to
// a JS Date.
const EXCEL_SERIAL_EPOCH_OFFSET_DAYS = 25569;
const MS_PER_DAY = 86_400_000;

function assertPlausibleYear(date: Date, raw: string): void {
  const year = date.getUTCFullYear();
  if (
    Number.isNaN(date.getTime()) ||
    year < MIN_PLAUSIBLE_YEAR ||
    year > MAX_PLAUSIBLE_YEAR
  ) {
    throw new Error(
      `Date "${raw}" is out of the plausible range (${MIN_PLAUSIBLE_YEAR}-${MAX_PLAUSIBLE_YEAR}) — check the column mapping or the source file.`,
    );
  }
}

function parseExplicitSlashDate(
  trimmed: string,
  format: "DD/MM/YYYY" | "MM/DD/YYYY",
  raw: string,
): Date {
  const parts = trimmed.split(/[/\-.]/).map((p) => Number(p));
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) {
    throw new Error(`Cannot parse date "${raw}" as ${format}`);
  }
  const [a, b, year] = parts as [number, number, number];
  const [month, day] = format === "DD/MM/YYYY" ? [b, a] : [a, b];
  const date = new Date(Date.UTC(year, month - 1, day));
  assertPlausibleYear(date, raw);
  return date;
}

/**
 * A bare integer in a date column is an Excel serial day-count (`exceljs`
 * already renders a real Date cell as ISO text in `parseExcelBuffer` — see
 * `cellValueToString` — so a plain number reaching here always means the
 * source cell was numeric, never a coincidental digits-only description).
 * Converted via the standard 1899-12-30 epoch offset; anything that lands
 * outside the plausible year range (a tiny/huge serial, or plain garbage
 * like a row index) is refused rather than silently imported as a bizarre
 * year.
 */
function parseExcelSerialDate(trimmed: string, raw: string): Date {
  const serial = Number(trimmed);
  const date = new Date((serial - EXCEL_SERIAL_EPOCH_OFFSET_DAYS) * MS_PER_DAY);
  assertPlausibleYear(date, raw);
  return date;
}

/**
 * `format` disambiguates day/month order for non-ISO date columns; ISO
 * ("YYYY-MM-DD") and any format `Date` can parse natively are the default
 * fallback (also what parseExcelBuffer's real Date cells normalise to).
 *
 * Ambiguous slash dates (both parts ≤ 12, e.g. "03/04/2026") are REFUSED
 * rather than guessed when no explicit/inferred `format` is given — this is
 * the fix for the transposition bug where `new Date("03/04/2026")` silently
 * read as March 4th instead of April 3rd for every DD/MM/YYYY file whose day
 * happened to be ≤ 12. A slash date with exactly one part > 12 is
 * unambiguous on its own (the >12 part can only be the day) and is resolved
 * without needing an explicit format.
 */
export function parseStatementDate(raw: string, format?: string | null): Date {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Empty date");

  if (format === "DD/MM/YYYY" || format === "MM/DD/YYYY") {
    return parseExplicitSlashDate(trimmed, format, raw);
  }

  // EPIC-023 Task G retry (MEDIUM five-reviewer finding) — the sign must be
  // INCLUDED in the bare-integer test, not just excluded from it: without
  // it, a negative value like "-1" falls through to the native `new
  // Date(trimmed)` fallback below, which parses it as a plausible-looking
  // date (JS's legacy date-string parsing, not a rejection) instead of
  // reaching `parseExcelSerialDate`'s year-range check, which correctly
  // refuses any negative serial (always pre-1899, so always implausible).
  if (/^-?\d+$/.test(trimmed)) {
    return parseExcelSerialDate(trimmed, raw);
  }

  const slashMatch = trimmed.match(SLASH_DATE_RE);
  if (slashMatch) {
    const first = Number(slashMatch[1]);
    const second = Number(slashMatch[2]);

    if (first > 12 && second > 12) {
      throw new Error(
        `Cannot parse date "${raw}" — neither part can be a valid month.`,
      );
    }
    if (first <= 12 && second <= 12) {
      throw new Error(
        `Cannot tell whether "${raw}" is DD/MM/YYYY or MM/DD/YYYY — set an explicit date format on this bank's column-mapping template.`,
      );
    }
    // Exactly one part is >12, so it can only be the day — unambiguous.
    const inferredFormat = first > 12 ? "DD/MM/YYYY" : "MM/DD/YYYY";
    return parseExplicitSlashDate(trimmed, inferredFormat, raw);
  }

  return parseFallbackDate(trimmed, raw);
}

/** Matches an ISO date with no time part — `2026-08-01`. JS already parses
 *  this as UTC midnight per spec, unlike every other date-only shape. */
const ISO_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True when the string carries a clock time and/or an explicit zone, e.g.
 *  `2026-08-01T09:30:00Z` or `01 Aug 2026 14:46`. Such a value names a real
 *  instant, so it must be preserved rather than flattened to midnight. */
const HAS_TIME_OR_ZONE_RE = /\d:\d|[zZ]$|[+-]\d{2}:?\d{2}$/;

/**
 * Last-resort date parsing, for the shapes the explicit-format and Excel-serial
 * paths above do not claim — most importantly `01 Aug 2026`, which is what
 * Indonesian bank exports use.
 *
 * EPIC-029 — this used to be a bare `new Date(trimmed)`, which builds a
 * **local**-midnight Date while `parseExplicitSlashDate` and
 * `parseExcelSerialDate` both build UTC midnight. Two of the three paths
 * agreed and this one did not, so a statement in this format imported every
 * transaction one day early once read as a UTC date (`01 Aug 2026` under
 * `TZ=Asia/Jakarta` is `2026-07-31T17:00:00.000Z`). Reconciliation matches
 * bank rows to transactions by date, so that is wrong and missed matches on
 * real money, not a display quirk.
 *
 * The bug was unreachable until the ZIP-normalisation work in this same
 * change made these files parseable at all.
 */
function parseFallbackDate(trimmed: string, raw: string): Date {
  // Already UTC midnight by specification — do not re-derive it, because
  // reading local Y/M/D off it shifts the day for any zone behind UTC.
  if (ISO_DATE_ONLY_RE.test(trimmed)) {
    const isoParsed = new Date(trimmed);
    assertPlausibleYear(isoParsed, raw);
    return isoParsed;
  }

  const parsed = new Date(trimmed);
  assertPlausibleYear(parsed, raw);

  // Carries a real instant (time and/or zone) — keep it verbatim.
  if (HAS_TIME_OR_ZONE_RE.test(trimmed)) return parsed;

  // A date-only value in any other shape parsed as LOCAL midnight, so its
  // local calendar fields are exactly the date a human read off the
  // statement. Rebuild that same calendar date at UTC midnight so this path
  // agrees with the other two regardless of the server's timezone.
  return new Date(
    Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()),
  );
}

/**
 * Scans every value in a date column for an UNAMBIGUOUS slash date (one part
 * clearly >12, so it can only be the day) and reports the day/month order
 * that value implies.
 *
 * EPIC-023 Task G retry (CRITICAL five-reviewer finding) — this used to be
 * wired into `mapTableToRows` to infer the WHOLE column's format from a
 * single unambiguous row, silently applying that guess to every OTHER
 * ambiguous row in the column. A reviewer proved that's unsafe by execution:
 * one outlier or mistyped row (e.g. a single "25/04/2026" among mostly
 * "03/04/2026" rows) is not proof of the file's actual convention, yet it
 * silently decided every ambiguous row's month/day transposition with no
 * warning. `mapTableToRows` no longer calls this function at all — an
 * ambiguous row is refused (see `parseStatementDate`) unless the saved
 * template supplies an explicit `dateFormat` (decision D17). This function
 * is kept, unwired, as a candidate building block for a future
 * template-manager UI suggestion ("this file looks like DD/MM/YYYY —
 * confirm the format") — a SUGGESTION a human confirms, never something
 * that drives parsing on its own.
 */
export function inferDateFormatFromValues(
  values: readonly string[],
): "DD/MM/YYYY" | "MM/DD/YYYY" | null {
  let inferred: "DD/MM/YYYY" | "MM/DD/YYYY" | null = null;

  for (const value of values) {
    const match = value.trim().match(SLASH_DATE_RE);
    if (!match) continue;
    const first = Number(match[1]);
    const second = Number(match[2]);
    if (first > 12 && second > 12) continue; // not a valid date either way

    if (first > 12) {
      if (inferred === "MM/DD/YYYY") return null; // conflicting evidence
      inferred = "DD/MM/YYYY";
    } else if (second > 12) {
      if (inferred === "DD/MM/YYYY") return null; // conflicting evidence
      inferred = "MM/DD/YYYY";
    }
    // Both ≤12 on this row is ambiguous on its own — no evidence either way.
  }

  return inferred;
}

type RowMapping = {
  mapping: TemplateMapping;
  /** The resolved column indices, kept so two candidate header rows can be
   * compared by what they POINT AT rather than by their label text. */
  columns: number[];
};

/**
 * Builds a mapping out of one candidate header row, or returns null.
 *
 * Every refusal here is deliberate. A wrong column mapping on a financial
 * import does not fail loudly — it books the balance as the amount, or the
 * outgoing column as income, and the user has no way to see it. So anything
 * short of an unambiguous read returns null, and the caller falls back to the
 * explicit per-bank template.
 */
function buildRowMapping(header: readonly string[]): RowMapping | null {
  const dateIdx = singleColumn(header, DATE_ALIASES);
  const descIdx = singleColumn(header, DESCRIPTION_ALIASES);
  if (dateIdx === -1 || descIdx === -1) return null;

  const amountIdx = singleColumn(header, AMOUNT_ALIASES);
  const creditIdx = singleColumn(header, CREDIT_ALIASES);
  const debitIdx = singleColumn(header, DEBIT_ALIASES);

  // A signed amount column wins when one exists — the pre-EPIC-029 behaviour,
  // unchanged. Only a file with NO signed column falls through to the pair.
  const columns =
    amountIdx !== -1
      ? [dateIdx, descIdx, amountIdx]
      : creditIdx !== -1 && debitIdx !== -1
        ? [dateIdx, descIdx, creditIdx, debitIdx]
        : null;
  if (!columns) return null;
  // Two logical fields resolving to one physical column can only be a
  // mis-read, never a real statement.
  if (new Set(columns).size !== columns.length) return null;

  const mapping: TemplateMapping =
    amountIdx !== -1
      ? {
          dateColumn: header[dateIdx] ?? "",
          descriptionColumn: header[descIdx] ?? "",
          amountColumn: header[amountIdx] ?? "",
          dateFormat: null,
        }
      : {
          dateColumn: header[dateIdx] ?? "",
          descriptionColumn: header[descIdx] ?? "",
          amountColumn: "",
          dateFormat: null,
          creditColumn: header[creditIdx] ?? "",
          debitColumn: header[debitIdx] ?? "",
        };

  return { mapping, columns };
}

/** How strongly a row reads as a header: how many of its cells are labels we
 * recognise at all (including the balance column, which is never mapped but
 * is strong evidence that this row — not the one above it — is the header). */
function headerScore(row: readonly string[]): number {
  return (
    matchingColumns(row, DATE_ALIASES).length +
    matchingColumns(row, DESCRIPTION_ALIASES).length +
    matchingColumns(row, AMOUNT_ALIASES).length +
    matchingColumns(row, CREDIT_ALIASES).length +
    matchingColumns(row, DEBIT_ALIASES).length +
    matchingColumns(row, BALANCE_ALIASES).length
  );
}

/**
 * How many leading rows are searched for the header.
 *
 * A real e-statement puts an account block above the table — bank name,
 * account holder, account number, period, currency, address — before the
 * column labels. The Mandiri export this bound was sized against carries its
 * header on the 10th and 11th rows; 25 leaves headroom for a longer preamble
 * (or a bank that adds a logo/disclaimer row) while staying small enough that
 * a row deep inside the DATA cannot be mistaken for the header — which is the
 * real risk of an unbounded scan, since it would silently discard every row
 * above the impostor.
 */
export const MAX_HEADER_SCAN_ROWS = 25;

/**
 * Finds the header row in a parsed table and reads a mapping from it.
 *
 * Three properties of real exports this handles, none of which the original
 * "row 0 is the header" assumption did:
 *
 *  1. **The header is not row 0.** Rows are scored by how many known column
 *     labels they carry, within `MAX_HEADER_SCAN_ROWS`; the best-scoring row
 *     wins.
 *  2. **Labels are not adjacent.** Merged cells leave empty placeholders
 *     between the labels, so only a label's column INDEX matters — never its
 *     neighbour.
 *  3. **The header is bilingual and occupies two rows.** Mandiri writes the
 *     Indonesian labels on one row and the English labels for the SAME
 *     columns on the next. Those two rows tie on score, so the tie is broken
 *     deterministically: the topmost row supplies the mapping, and a tied row
 *     is treated as part of the header (not as data) only when it is
 *     CONSECUTIVE with it and resolves to the IDENTICAL column indices. A tie
 *     between rows that disagree about which columns to use is a genuine
 *     ambiguity and returns null.
 */
export function detectTableMapping(
  table: readonly string[][],
): DetectedTableMapping | null {
  const candidates: Array<RowMapping & { index: number; score: number }> = [];

  const limit = Math.min(table.length, MAX_HEADER_SCAN_ROWS);
  for (let index = 0; index < limit; index++) {
    const row = table[index] ?? [];
    const built = buildRowMapping(row);
    if (!built) continue;
    candidates.push({ ...built, index, score: headerScore(row) });
  }
  if (candidates.length === 0) return null;

  const best = Math.max(...candidates.map((c) => c.score));
  const tied = candidates.filter((c) => c.score === best);
  const first = tied[0];
  const last = tied[tied.length - 1];
  if (!first || !last) return null;

  const sameColumns = (other: RowMapping): boolean =>
    other.columns.length === first.columns.length &&
    other.columns.every((col, i) => col === first.columns[i]);

  for (let i = 1; i < tied.length; i++) {
    // Consecutive AND pointing at the same columns ⇒ a bilingual twin of the
    // first row. Anything else is two different candidate headers, which we
    // refuse rather than pick between.
    const twin = tied[i];
    if (!twin || twin.index !== first.index + i || !sameColumns(twin)) {
      return null;
    }
  }

  return {
    mapping: first.mapping,
    headerIndex: first.index,
    dataStartIndex: last.index + 1,
  };
}

/** Case-insensitive header-alias auto-detection for a single, known header
 * row. Returns null (never throws) so the caller can surface a clear "create
 * a template" error instead of a stack trace. Prefer `detectTableMapping`,
 * which does not assume the header is the first row. */
export function detectMapping(header: string[]): TemplateMapping | null {
  return buildRowMapping(header)?.mapping ?? null;
}

/**
 * Reads one side of a money-in/money-out column pair.
 *
 * Returns null when the cell is genuinely EMPTY of value — blank, "-", or a
 * plain zero. The unused half of a debit/credit pair is written as "0.00" at
 * least as often as it is left blank, and treating that as a real zero-rupiah
 * amount would make every row look like it had both sides filled.
 *
 * A cell that contains a non-zero digit but still rounds to zero rupiah is
 * NOT absent — it is a corrupted or sub-unit cell, and throws, exactly as in
 * the single-column path.
 */
function readMoneySide(raw: string | undefined): bigint | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed === "-") return null;
  const value = parseStatementAmount(trimmed);
  if (value === 0n) {
    if (/[1-9]/.test(trimmed)) {
      throw new Error(
        `Amount "${trimmed}" rounds to zero whole rupiah — check the source file.`,
      );
    }
    return null;
  }
  // The column decides the sign, so the cell's own sign is discarded: a bank
  // that writes its outgoing column as "-150.000" and one that writes
  // "150.000" must import identically.
  return value < 0n ? -value : value;
}

/**
 * Maps a parsed table to `ParsedStatementRow[]` using `mapping`.
 *
 * `options.headerIndex` / `options.dataStartIndex` default to 0 / 1 — the
 * "first row is the header" shape every saved template still assumes. They
 * are supplied by `detectTableMapping` for a real bank export, whose header
 * sits several rows down and may occupy two rows (see that function).
 *
 * Rows with a missing date/amount, or one that fails to parse, are SKIPPED
 * (not fatal) — a statement with one malformed line should still import the
 * rest — but every skip is reported back with its line number and reason
 * (never silent) so a partial import cannot be mistaken for a complete one.
 * The caller is responsible for rejecting a zero-row result (see
 * reconciliation.service.ts#uploadFile) — this function alone cannot
 * distinguish "empty file" from "every row skipped", so it never decides that
 * policy itself.
 */
export function mapTableToRows(
  table: string[][],
  mapping: TemplateMapping,
  options: { headerIndex?: number; dataStartIndex?: number } = {},
): MapTableResult {
  const headerIndex = options.headerIndex ?? 0;
  const dataStartIndex = options.dataStartIndex ?? headerIndex + 1;
  const header = table[headerIndex];
  if (!header) return { rows: [], skipped: [] };
  const dataRows = table.slice(dataStartIndex);

  const dateIdx = findColumnIndex(header, mapping.dateColumn);
  const descIdx = findColumnIndex(header, mapping.descriptionColumn);
  const isPair = Boolean(mapping.creditColumn && mapping.debitColumn);
  const amountIdx = isPair ? -1 : findColumnIndex(header, mapping.amountColumn);
  const creditIdx = isPair
    ? findColumnIndex(header, mapping.creditColumn as string)
    : -1;
  const debitIdx = isPair
    ? findColumnIndex(header, mapping.debitColumn as string)
    : -1;

  const resolved = isPair
    ? [dateIdx, descIdx, creditIdx, debitIdx]
    : [dateIdx, descIdx, amountIdx];

  if (resolved.some((idx) => idx === -1)) {
    throw new Error(
      "Column mapping does not match this file's header row — check the saved template or column names.",
    );
  }

  // EPIC-023 Task G retry (MEDIUM finding) — a numeric-index template
  // mapping (fallback path in findColumnIndex) has no semantic check: if a
  // bank reorders its export's columns, two logical fields could silently
  // resolve to the SAME column index (e.g. date and amount both "2").
  // Refuse rather than import with a field silently mapped wrong.
  if (new Set(resolved).size !== resolved.length) {
    throw new Error(
      "Column mapping resolves more than one field to the same column — check the saved template or column names.",
    );
  }

  // EPIC-023 Task G retry (CRITICAL five-reviewer finding) — NEVER infer a
  // date format from the file's own data (see `inferDateFormatFromValues`'s
  // doc comment): only an explicit template `dateFormat` disambiguates an
  // ambiguous DD/MM vs MM/DD row. An unambiguous row (one part >12) still
  // resolves on its own via `parseStatementDate`'s own logic either way.
  const effectiveDateFormat = mapping.dateFormat ?? null;

  /** True when the row carries anything at all in its amount column(s). Kept
   * separate from parsing so an empty amount is reported as "Missing amount"
   * rather than as a date/parse failure, as it always has been. */
  const hasAmountCell = (row: string[]): boolean =>
    isPair
      ? Boolean(row[creditIdx]?.trim() || row[debitIdx]?.trim())
      : Boolean(row[amountIdx]);

  /** The row's signed amount, or null when both sides of a pair turned out to
   * be placeholder zeroes. */
  const readAmount = (row: string[]): bigint | null => {
    if (!isPair) {
      const rawAmount = row[amountIdx] ?? "";
      const amount = parseStatementAmount(rawAmount);
      // EPIC-023 Task G retry (MEDIUM five-reviewer finding) — a raw amount
      // that contains a non-zero digit (e.g. "0,49") but rounds DOWN to
      // zero whole rupiah is a corrupted/sub-unit cell, not a legitimate
      // zero-amount transaction — skip it with a reason instead of storing
      // a real BankSyncEntry with amount 0.
      if (amount === 0n && /[1-9]/.test(rawAmount)) {
        throw new Error(
          `Amount "${rawAmount}" rounds to zero whole rupiah — check the source file.`,
        );
      }
      return amount;
    }
    const incoming = readMoneySide(row[creditIdx]);
    const outgoing = readMoneySide(row[debitIdx]);
    if (incoming !== null && outgoing !== null) {
      throw new Error(
        "Both the incoming and outgoing amount columns hold a value on this row — cannot tell which one is the transaction amount.",
      );
    }
    if (incoming !== null) return incoming;
    if (outgoing !== null) return -outgoing;
    return null;
  };

  const rows: ParsedStatementRow[] = [];
  const skipped: SkippedRow[] = [];

  dataRows.forEach((row, index) => {
    // The table row's own 1-indexed line number, so a reported skip points at
    // the line the user sees in Excel even when the header is not row 1.
    const line = dataStartIndex + index + 1;
    const rawDate = row[dateIdx];
    const rawDesc = row[descIdx] ?? "";

    if (!rawDate || !hasAmountCell(row)) {
      skipped.push({
        line,
        reason: !rawDate ? "Missing date" : "Missing amount",
      });
      return;
    }

    try {
      const date = parseStatementDate(rawDate, effectiveDateFormat);
      const amount = readAmount(row);
      if (amount === null) {
        skipped.push({ line, reason: "Missing amount" });
        return;
      }

      rows.push({ date, description: rawDesc.trim(), amount });
    } catch (err) {
      skipped.push({
        line,
        reason: err instanceof Error ? err.message : "Unparseable row",
      });
    }
  });

  return { rows, skipped };
}
