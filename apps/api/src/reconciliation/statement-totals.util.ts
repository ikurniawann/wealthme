import { parseStatementAmount } from "./reconciliation-parsers";

import type { ParsedStatementRow } from "./reconciliation-parsers";
import type { StatementRawTotals } from "./statement-reader/statement-reader.port";

/**
 * EPIC-029 E3b/E7 — the totals gate.
 *
 * The governing risk of this whole epic is a silently wrong number on a
 * money row. Per-entry human confirmation catches a row that looks wrong;
 * it cannot catch a row that is simply MISSING, because there is nothing on
 * screen to look at. A statement that prints its own opening/closing balance
 * or its own incoming/outgoing totals is therefore checked against, and a
 * mismatch REFUSES the import (E7) — it is never imported "mostly right"
 * behind a warning banner.
 *
 * Both sides of every comparison go through `parseStatementAmount`. The
 * model supplies raw printed text on both sides and does no arithmetic, so
 * it cannot make its own check pass (E1).
 */

export type TotalsCheckLabel =
  /** closing − opening, against the net of the extracted rows. */
  | "opening-to-closing"
  /** The statement's stated incoming total, against the sum of positive rows. */
  | "total-credit"
  /** The statement's stated outgoing total, against the sum of negative rows. */
  | "total-debit";

export type TotalsCheck = {
  label: TotalsCheckLabel;
  /** Whole rupiah, from the statement's own printed figures. */
  expected: bigint;
  /** Whole rupiah, summed from the rows that were extracted. */
  actual: bigint;
  /** `actual - expected`. Zero on an exact agreement. */
  difference: bigint;
  matched: boolean;
};

export type TotalsVerdict = {
  /**
   * `unavailable` means the statement printed no total this code could read
   * — NOT that everything checked out. The two are reported differently on
   * purpose: an import with no cross-check available is a weaker claim than
   * one with a matching cross-check, and the preview says which it is.
   */
  status: "matched" | "mismatch" | "unavailable";
  checks: TotalsCheck[];
  /** The rounding allowance applied, in whole rupiah. See `toleranceFor`. */
  tolerance: bigint;
};

/**
 * Whole-rupiah rounding allowance.
 *
 * `parseStatementAmount` rounds each cell to whole rupiah, so a statement
 * quoted in rupiah-and-cents ("135,57") produces `sum(round(aᵢ))` on one
 * side and `round(Σaᵢ)` on the other. Each row can differ by up to 0.5, and
 * the printed total by up to 0.5 more, so the bound is `⌈n/2⌉ + 1` and
 * nothing wider.
 *
 * It is deliberately NOT a percentage. A percentage tolerance scales with
 * the statement, so a large statement would silently accept a large missing
 * transaction — exactly the failure this gate exists to catch. The smallest
 * real transaction on either reference statement is 2,500 rupiah, far above
 * this bound at any plausible row count.
 */
export function toleranceFor(rowCount: number): bigint {
  return BigInt(Math.ceil(Math.max(rowCount, 0) / 2) + 1);
}

/** Parses one of the model's raw total strings, or null when the statement
 * printed none — or printed something this parser cannot read, which is
 * reported as "no check available" rather than as a mismatch, because it
 * says nothing about whether the rows are right. */
function readTotal(raw: string | null): bigint | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return parseStatementAmount(trimmed);
  } catch {
    return null;
  }
}

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

export function checkStatementTotals(
  rows: readonly ParsedStatementRow[],
  totals: StatementRawTotals,
): TotalsVerdict {
  const tolerance = toleranceFor(rows.length);
  const net = rows.reduce((sum, row) => sum + row.amount, 0n);
  const credit = rows.reduce(
    (sum, row) => (row.amount > 0n ? sum + row.amount : sum),
    0n,
  );
  const debit = rows.reduce(
    (sum, row) => (row.amount < 0n ? sum - row.amount : sum),
    0n,
  );

  const checks: TotalsCheck[] = [];
  const push = (label: TotalsCheckLabel, expected: bigint, actual: bigint) => {
    const difference = actual - expected;
    checks.push({
      label,
      expected,
      actual,
      difference,
      matched: absolute(difference) <= tolerance,
    });
  };

  const opening = readTotal(totals.openingBalance);
  const closing = readTotal(totals.closingBalance);
  if (opening !== null && closing !== null) {
    push("opening-to-closing", closing - opening, net);
  }

  // The statement's own labels already say which side is which, so the sign
  // it prints them with ("- 15.849.448,00" for money out) carries no extra
  // information — compare magnitudes.
  const statedCredit = readTotal(totals.totalCredit);
  if (statedCredit !== null)
    push("total-credit", absolute(statedCredit), credit);

  const statedDebit = readTotal(totals.totalDebit);
  if (statedDebit !== null) push("total-debit", absolute(statedDebit), debit);

  if (checks.length === 0) {
    return { status: "unavailable", checks, tolerance };
  }
  return {
    status: checks.every((check) => check.matched) ? "matched" : "mismatch",
    checks,
    tolerance,
  };
}
