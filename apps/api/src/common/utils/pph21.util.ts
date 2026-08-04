/**
 * EPIC-022 Group E (E6) — the single source of truth for PPh 21 progressive
 * tax math, shared by `CalculatorsService.calculatePph21` (the interactive
 * `/kalkulator` and `/tax` calculators) and `TaxService.computeNetTax` (the
 * persisted tax record). Before this file existed the two engines defined
 * the same brackets twice — once as cumulative PKP limits, once as band
 * widths — and agreed only by coincidence; any future bracket/PTKP edit to
 * one would silently diverge from the other. Both callers now import from
 * here so an edit to the law only has one place to happen.
 */

/** PTKP (non-taxable income threshold) for TK/0 per UU HPP, used as the
 * default when a caller does not supply an override. */
export const PPH21_DEFAULT_PTKP = 54_000_000;

/** Biaya jabatan (job-expense allowance): 5% of gross, capped at Rp 6.000.000/year. */
export const PPH21_BIAYA_JABATAN_RATE = 0.05;
export const PPH21_BIAYA_JABATAN_CAP = 6_000_000;

export interface Pph21Bracket {
  /** Cumulative PKP upper bound for this bracket (Infinity for the top one). */
  limit: number;
  rate: number;
  label: string;
}

/** PPh 21 progressive brackets (UU HPP 2021) — cumulative PKP boundaries. */
export const PPH21_BRACKETS: readonly Pph21Bracket[] = [
  { limit: 60_000_000, rate: 0.05, label: "0 – 60 Juta" },
  { limit: 250_000_000, rate: 0.15, label: "60 – 250 Juta" },
  { limit: 500_000_000, rate: 0.25, label: "250 – 500 Juta" },
  { limit: 5_000_000_000, rate: 0.3, label: "500 Juta – 5 Miliar" },
  { limit: Infinity, rate: 0.35, label: "> 5 Miliar" },
];

export interface Pph21BracketTax {
  bracket: string;
  taxableAmount: number;
  rate: number;
  tax: number;
}

/** Rounds a raw PKP down to the nearest Rp 1.000, per DJP rounding practice for PPh 21. */
export function roundPkpDown(pkpRaw: number): number {
  return Math.floor(Math.max(0, pkpRaw) / 1000) * 1000;
}

/** Computes biaya jabatan + the rounded PKP (Penghasilan Kena Pajak) for a given gross income. */
export function computePkp(
  grossIncome: number,
  ptkp: number,
  zakatDeduction = 0,
): { biayaJabatan: number; pkp: number } {
  const biayaJabatan = Math.min(
    grossIncome * PPH21_BIAYA_JABATAN_RATE,
    PPH21_BIAYA_JABATAN_CAP,
  );
  const pkpRaw = grossIncome - biayaJabatan - ptkp - zakatDeduction;
  return { biayaJabatan, pkp: roundPkpDown(pkpRaw) };
}

/** Splits a PKP amount across the progressive PPh 21 brackets. */
export function computeTaxBrackets(pkp: number): Pph21BracketTax[] {
  const breakdown: Pph21BracketTax[] = [];
  let remaining = pkp;
  let previousLimit = 0;

  for (const bracket of PPH21_BRACKETS) {
    if (remaining <= 0) break;
    const bandWidth =
      bracket.limit === Infinity
        ? remaining
        : Math.min(remaining, bracket.limit - previousLimit);
    const taxableAmount = Math.min(remaining, bandWidth);
    const tax = taxableAmount * bracket.rate;

    breakdown.push({
      bracket: bracket.label,
      taxableAmount,
      rate: bracket.rate,
      tax,
    });

    remaining -= taxableAmount;
    previousLimit = bracket.limit;
  }

  return breakdown;
}

/** Sums a bracket breakdown into a single rounded rupiah total — rounded here
 * (not left as a float) so both callers persist/display the exact same
 * number instead of drifting apart on floating-point noise. */
export function sumTaxRounded(breakdown: readonly Pph21BracketTax[]): number {
  const total = breakdown.reduce((sum, b) => sum + b.tax, 0);
  return Math.round(total);
}
