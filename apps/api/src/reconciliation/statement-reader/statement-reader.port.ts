import { z } from "zod";

/**
 * EPIC-029 group 2 (E1) — the ONE schema every statement-reader adapter
 * validates against, and the single most load-bearing decision in this epic:
 *
 *   **the model never produces a final amount.**
 *
 * Every money field below is `z.string()`. Not `z.union([z.string(),
 * z.number()])`, not `z.coerce.string()` — a schema that ADMITS a number is
 * a bug, because it would let a model's own arithmetic ("the amount is
 * 37000") reach a `BankSyncEntry` without ever passing
 * `parseStatementAmount`. What the model returns is the raw cell text as
 * printed on the statement; the hardened, already-reviewed parser turns that
 * text into rupiah, exactly as it does for a CSV or an XLSX.
 *
 * The one field the model DOES normalise is `date`, and only into ISO
 * `YYYY-MM-DD`. That is not an exception carved out of E1, it is forced by
 * the source: BCA prints `01/04` with no year at all, and `01/04/2026` is
 * ambiguous between DD/MM and MM/DD — `parseStatementDate` refuses both, on
 * purpose. The year lives in the statement's own period header, which is
 * exactly the context the model has and a per-cell parser does not. The
 * result is still re-parsed and range-checked by `parseStatementDate`, and a
 * date the model got wrong is visible in the preview; a wrong AMOUNT would
 * not be, which is why the two are treated differently.
 */
const rawRowSchema = z.object({
  /** ISO `YYYY-MM-DD`, resolved against the statement's period header. */
  date: z.string().min(1).max(40),
  description: z.string().max(500),
  /**
   * The amount cell EXACTLY as printed — separators, currency label, sign,
   * `DB`/`CR` marker and all. `parseStatementAmount` understands every one
   * of those forms already.
   */
  amount: z.string().min(1).max(60),
});

/**
 * The statement's own stated totals, when it prints them. Raw strings for
 * the same reason the rows are: these are the numbers the extracted rows are
 * checked AGAINST (E3b/E7), so letting the model hand back a typed number
 * here would let it satisfy its own cross-check.
 *
 * Every field is nullable: not every statement prints every total, and a
 * model that invents one to fill the field is worse than a null.
 */
const rawTotalsSchema = z.object({
  openingBalance: z.string().max(60).nullable(),
  closingBalance: z.string().max(60).nullable(),
  /** "Dana Masuk" / "Mutasi CR" — the sum of incoming amounts. */
  totalCredit: z.string().max(60).nullable(),
  /** "Dana Keluar" / "Mutasi DB" — the sum of outgoing amounts. */
  totalDebit: z.string().max(60).nullable(),
});

/** Bounds the model's answer so a runaway generation cannot produce a table
 * larger than any real personal statement. 2000 rows is ~40x the busiest
 * month either real fixture carries. */
export const MAX_STATEMENT_ROWS = 2000;

export const statementReadingSchema = z.object({
  rows: z.array(rawRowSchema).max(MAX_STATEMENT_ROWS),
  totals: rawTotalsSchema,
});

export type StatementReading = z.infer<typeof statementReadingSchema>;
export type StatementRawRow = z.infer<typeof rawRowSchema>;
export type StatementRawTotals = z.infer<typeof rawTotalsSchema>;

export interface StatementReaderPort {
  /** `statementText` is the PDF's extracted text layer, page-separated. */
  readStatement(statementText: string): Promise<StatementReading>;
}
