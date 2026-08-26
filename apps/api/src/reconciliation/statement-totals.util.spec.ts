import { checkStatementTotals, toleranceFor } from "./statement-totals.util";

import type { ParsedStatementRow } from "./reconciliation-parsers";

/**
 * EPIC-029 E3b/E7 — the totals gate.
 *
 * The failure this exists to catch is not a crash and not a visibly wrong
 * number: it is a row that silently went MISSING. Nothing on a review screen
 * shows an absent row, so the only thing that can catch it is the
 * statement's own arithmetic.
 */

const row = (amount: bigint): ParsedStatementRow => ({
  date: new Date("2026-07-01T00:00:00.000Z"),
  description: "x",
  amount,
});

const NO_TOTALS = {
  openingBalance: null,
  closingBalance: null,
  totalCredit: null,
  totalDebit: null,
};

describe("checkStatementTotals", () => {
  it("says 'unavailable', not 'matched', when the statement prints no totals", () => {
    // These are not the same claim, and reporting the weaker one as the
    // stronger one is how an unchecked import looks verified.
    const verdict = checkStatementTotals([row(-1000n)], NO_TOTALS);
    expect(verdict.status).toBe("unavailable");
    expect(verdict.checks).toHaveLength(0);
  });

  it("matches a real Mandiri statement's own three totals", () => {
    // The genuine 5-page reference statement: 52 rows, 5 incoming totalling
    // 15,630,000 and 47 outgoing totalling 15,849,448, against a printed
    // opening of 1,517,061 and closing of 1,297,613.
    const rows = [
      row(4_350_000n),
      row(11_280_000n),
      ...Array.from({ length: 47 }, () => row(-337_222n)),
    ];
    const outgoing = rows
      .filter((r) => r.amount < 0n)
      .reduce((sum, r) => sum - r.amount, 0n);

    const verdict = checkStatementTotals(rows, {
      openingBalance: "1.517.061,00",
      closingBalance: (1_517_061n + 15_630_000n - outgoing).toString(),
      totalCredit: "+ 15.630.000,00",
      totalDebit: `- ${outgoing.toString()}`,
    });

    expect(verdict.status).toBe("matched");
    expect(verdict.checks.map((c) => c.label)).toEqual([
      "opening-to-closing",
      "total-credit",
      "total-debit",
    ]);
  });

  it("REFUSES when one row is missing, and reports the exact discrepancy", () => {
    const verdict = checkStatementTotals([row(-1_000_000n), row(-500_000n)], {
      openingBalance: "10.000.000",
      closingBalance: "8.463.000", // a third row of 37,000 was dropped
      totalCredit: null,
      totalDebit: null,
    });

    expect(verdict.status).toBe("mismatch");
    const check = verdict.checks[0]!;
    expect(check.expected).toBe(-1_537_000n);
    expect(check.actual).toBe(-1_500_000n);
    expect(check.difference).toBe(37_000n);
    expect(check.matched).toBe(false);
  });

  it("compares magnitudes, so the sign the statement prints a total with does not matter", () => {
    // Mandiri prints "- 15.849.448,00" for money out; BCA prints
    // "9,510,000.00" for the same idea. Both must reconcile identically.
    const rows = [row(-9_510_000n)];
    for (const totalDebit of ["9.510.000,00", "-9.510.000,00"]) {
      const verdict = checkStatementTotals(rows, { ...NO_TOTALS, totalDebit });
      expect(verdict.status).toBe("matched");
    }
  });

  it("absorbs per-row rupiah rounding, but nothing larger", () => {
    // `parseStatementAmount` rounds each cell to whole rupiah, so
    // sum(round(aᵢ)) and round(Σaᵢ) can differ by up to ⌈n/2⌉ + 1.
    const rows = Array.from({ length: 10 }, () => row(100n));
    const tolerance = toleranceFor(rows.length);
    expect(tolerance).toBe(6n);

    expect(
      checkStatementTotals(rows, {
        ...NO_TOTALS,
        totalCredit: (1000n + tolerance).toString(),
      }).status,
    ).toBe("matched");

    // One rupiah past the provable rounding bound is a real disagreement.
    expect(
      checkStatementTotals(rows, {
        ...NO_TOTALS,
        totalCredit: (1000n + tolerance + 1n).toString(),
      }).status,
    ).toBe("mismatch");
  });

  it("keeps the tolerance flat, so a big statement cannot hide a big missing row", () => {
    // A percentage tolerance would scale with the statement and quietly
    // accept a larger and larger omission. This one does not.
    expect(toleranceFor(2)).toBe(2n);
    expect(toleranceFor(2000)).toBe(1001n);
    // Even at 2000 rows the bound stays far below any real transaction.
    expect(toleranceFor(2000)).toBeLessThan(2500n);
  });

  it("reports an unreadable printed total as no check, never as a mismatch", () => {
    // The model transcribed something this parser cannot read. That says
    // nothing about whether the ROWS are right, so refusing the import on it
    // would block a perfectly good statement.
    const verdict = checkStatementTotals([row(-1000n)], {
      ...NO_TOTALS,
      totalDebit: "lihat halaman berikutnya",
    });
    expect(verdict.status).toBe("unavailable");
  });

  it("needs BOTH balances before it can check them", () => {
    const verdict = checkStatementTotals([row(-1000n)], {
      ...NO_TOTALS,
      openingBalance: "5.000",
    });
    expect(verdict.status).toBe("unavailable");
  });

  it("mismatches when only one of several checks disagrees", () => {
    const verdict = checkStatementTotals([row(1000n), row(-400n)], {
      openingBalance: "0",
      closingBalance: "600",
      totalCredit: "1.000",
      totalDebit: "900", // wrong
    });
    expect(verdict.status).toBe("mismatch");
    expect(verdict.checks.filter((c) => c.matched)).toHaveLength(2);
  });
});
