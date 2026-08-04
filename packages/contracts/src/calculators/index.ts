/* ─── Zakat Maal ─────────────────────────────────────────── */

export interface ZakatRequestDto {
  /** Total cash holdings (IDR) */
  cash: number;
  /** Total investment value (IDR) */
  investments: number;
  /** Total gold value (IDR) */
  gold: number;
  /** Total short-term / due liabilities (IDR) */
  liabilities: number;
  /**
   * Whether this wealth has been held for a full lunar year (haul). A
   * balance-sheet snapshot alone can never confirm haul — without it the
   * result is an estimate, not a settled obligation (EPIC-022 E1).
   */
  haulConfirmed: boolean;
  /**
   * Owner-maintained `FamilyGroup.goldPricePerGram` (IDR). When provided,
   * nisab = 85g × this price; when omitted, nisab falls back to an
   * indicative constant (EPIC-022 E2).
   */
  goldPricePerGram?: number;
}

export interface ZakatResultDto {
  /** Total zakatable wealth = cash + investments + gold − liabilities */
  zakatable: number;
  /** Nisab threshold (85g gold × the price used — see `nisabSource`) */
  nisab: number;
  /** Zakat amount due (2.5% of zakatable once nisab is met) — an estimate
   * until `isObligated` is also true. */
  zakat: number;
  /** Whether zakatable wealth meets/exceeds nisab (threshold only — does
   * NOT by itself confirm haul). */
  meetsNisab: boolean;
  /** True only when nisab is met AND haul is confirmed by the caller — the
   * actual zakat obligation. Never inferred from the snapshot alone. */
  isObligated: boolean;
  /** Whether nisab was derived from the family's own gold price or the
   * indicative fallback constant. */
  nisabSource: "family" | "indicative";
}

/* ─── PPh 21 ─────────────────────────────────────────────── */

export interface Pph21RequestDto {
  /** Annual gross income (IDR) */
  grossIncome: number;
  /** Zakat paid in the year (reduces PKP) */
  zakatPaid?: number;
  /** PTKP override (IDR) for the taxpayer's marital/dependents status. Defaults to TK/0 (Rp 54,000,000) when omitted. */
  ptkp?: number;
}

export interface TaxBracketDto {
  /** Bracket label e.g. "0 – 60 Juta" */
  bracket: string;
  /** Taxable amount within this bracket */
  taxableAmount: number;
  /** Tax rate as decimal (e.g. 0.05) */
  rate: number;
  /** Tax due for this bracket */
  tax: number;
}

export interface Pph21ResultDto {
  grossIncome: number;
  /** Biaya jabatan deduction (5% of gross, max Rp 6,000,000) */
  biayaJabatan: number;
  /** PTKP deduction (Rp 54,000,000 for TK/0) */
  ptkp: number;
  /** Zakat deduction applied */
  zakatDeduction: number;
  /** Penghasilan Kena Pajak */
  pkp: number;
  /** Per-bracket tax breakdown */
  taxBreakdown: TaxBracketDto[];
  /** Total annual tax */
  totalTax: number;
  /** Effective tax rate (totalTax / grossIncome) */
  effectiveRate: number;
}

/* ─── Investment Calculator ──────────────────────────────── */

export interface InvestmentCalcRequestDto {
  /** Present value / initial investment (IDR) */
  pv: number;
  /** Periodic payment / regular contribution (IDR) */
  pmt: number;
  /** Annual interest/return rate as decimal (e.g. 0.12 for 12%) */
  rate: number;
  /** Investment duration in years */
  years: number;
  /** Number of compounding periods per year (default: 12) */
  compoundsPerYear?: number;
}

export interface InvestmentCalcResultDto {
  /** Future value */
  futureValue: number;
  /** Total amount contributed (pv + pmt × total periods) */
  totalContributions: number;
  /** Total interest/gain earned */
  totalInterest: number;
}

/* ─── KPR / Mortgage Calculator ──────────────────────────── */

export interface KprCalcRequestDto {
  /** Principal loan amount (IDR) */
  principal: number;
  /** Annual interest rate as decimal (e.g. 0.07 for 7%) */
  annualRate: number;
  /** Loan duration in years */
  years: number;
}

export interface KprCalcResultDto {
  /** Monthly instalment payment (IDR) */
  monthlyPayment: number;
  /** Total amount paid over the full term */
  totalPayment: number;
  /** Total interest paid */
  totalInterest: number;
}

/* ─── Retirement / Pensiun Calculator ───────────────────── */

export interface RetirementCalcRequestDto {
  /** Target retirement fund (IDR) */
  targetAmount: number;
  /** Years until retirement */
  years: number;
  /** Annual investment return rate as decimal */
  annualRate: number;
  /** Existing savings already accumulated (IDR, default: 0) */
  existingAmount?: number;
}

export interface RetirementCalcResultDto {
  /** Required monthly contribution to reach target */
  monthlyContribution: number;
  /** Total contributions over the period */
  totalContributions: number;
  /** Projected final value (existing + contributions + growth) */
  projectedValue: number;
}
