import type { CoaMatrixCell, CoaMatrixDto } from "@wealthme/contracts";

// Pure derivations over the sparse `CoaMatrixDto.cells` map, shared by the
// compact matrix ("Matriks") and the per-month list ("Ringkas") views of the
// Ringkasan COA tab. Kept free of React so the arithmetic is testable alone.

export const COA_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
export const COA_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/** Number of tint steps a filled matrix cell can take (1 = faintest). */
export const COA_TINT_LEVELS = 5;

export interface CoaMonthSummary {
  month: number;
  total: number;
  count: number;
  txs: Array<CoaMatrixCell & { day: number }>;
}

export function cellTxs(
  matrix: CoaMatrixDto,
  month: number,
  day: number,
): CoaMatrixCell[] {
  return matrix.cells[month]?.[day] ?? [];
}

export function sumTxs(txs: CoaMatrixCell[]): number {
  return txs.reduce((sum, tx) => sum + tx.amount, 0);
}

/** Days (1-31) that hold at least one transaction in any month. */
export function activeDays(matrix: CoaMatrixDto): number[] {
  return COA_DAYS.filter((day) =>
    COA_MONTHS.some((month) => cellTxs(matrix, month, day).length > 0),
  );
}

export function monthSummaries(matrix: CoaMatrixDto): CoaMonthSummary[] {
  return COA_MONTHS.map((month) => {
    const txs = COA_DAYS.flatMap((day) =>
      cellTxs(matrix, month, day).map((tx) => ({ ...tx, day })),
    );
    return { month, total: sumTxs(txs), count: txs.length, txs };
  });
}

/** Largest absolute single-cell sum, the top of the tint scale. */
export function maxCellMagnitude(matrix: CoaMatrixDto): number {
  let max = 0;
  for (const month of COA_MONTHS) {
    for (const day of COA_DAYS) {
      const txs = cellTxs(matrix, month, day);
      if (txs.length > 0) max = Math.max(max, Math.abs(sumTxs(txs)));
    }
  }
  return max;
}

export function isoDay(year: number, month: number, day: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** /transaksi narrowed to one COA account on one calendar day. */
export function coaDayHref(
  coaAccountId: string,
  year: number,
  month: number,
  day: number,
): string {
  const date = isoDay(year, month, day);
  const params = new URLSearchParams({
    coa: coaAccountId,
    from: date,
    to: date,
  });
  return `/transaksi?${params.toString()}`;
}

/** /transaksi on the transaction's day with its detail dialog opened. */
export function coaTxHref(
  txId: string,
  year: number,
  month: number,
  day: number,
): string {
  const date = isoDay(year, month, day);
  const params = new URLSearchParams({ from: date, to: date, tx: txId });
  return `/transaksi?${params.toString()}`;
}

/**
 * Tint step for a filled cell on a square-root scale, so one large payment
 * does not wash every smaller cell out to the faintest step.
 */
export function tintLevel(value: number, max: number): number {
  if (max <= 0) return 1;
  const ratio = Math.sqrt(Math.abs(value) / max);
  return Math.min(
    COA_TINT_LEVELS,
    Math.max(1, Math.ceil(ratio * COA_TINT_LEVELS)),
  );
}
