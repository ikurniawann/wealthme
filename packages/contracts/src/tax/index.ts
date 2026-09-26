export type SptStatus = "belum_lapor" | "sudah_lapor" | "terlambat";

export interface TaxRecordDto {
  id: string;
  familyGroupId: string;
  taxYear: number;
  grossIncome: string;
  ptkp: string;
  zakatDeduction: string;
  netTax: string;
  sptStatus: SptStatus;
  documentUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  calcMode: TaxCalcMode;
  maritalStatus: TaxMaritalStatus | null;
  dependents: number | null;
  pensionContribution: string | null;
  freelanceGross: string | null;
  nppnRateBps: number | null;
  otherNetIncome: string | null;
  withheldPph21: string | null;
  /** netTax − (withheldPph21 ?? 0) */
  balance: string;
  sptFiledAt: string | null;
  rules: TaxRuleRefDto[];
}

export interface CreateTaxRecordDto {
  taxYear: number;
  grossIncome: string;
  ptkp?: string;
  netTax?: string;
  sptStatus?: SptStatus;
  documentUrl?: string;
  notes?: string;
  maritalStatus?: TaxMaritalStatus;
  dependents?: number;
  pensionContribution?: string;
  freelanceGross?: string;
  nppnRateBps?: number;
  otherNetIncome?: string;
  withheldPph21?: string;
}

export interface UpdateTaxRecordDto {
  taxYear?: number;
  grossIncome?: string;
  ptkp?: string;
  netTax?: string;
  sptStatus?: SptStatus;
  documentUrl?: string;
  notes?: string;
  maritalStatus?: TaxMaritalStatus;
  dependents?: number;
  pensionContribution?: string;
  freelanceGross?: string;
  nppnRateBps?: number;
  otherNetIncome?: string;
  withheldPph21?: string;
}

export type TaxMaritalStatus = "TK" | "K" | "KI";
export type TaxCalcMode = "legacy" | "detailed";
export type TerCategory = "A" | "B" | "C";
export type DtpSector =
  | "alas_kaki"
  | "tekstil_pakaian"
  | "furnitur"
  | "kulit"
  | "pariwisata";
export type DtpEmployment = "permanent" | "non_permanent";
export type DtpReason =
  | "no_program"
  | "sector_not_covered"
  | "gross_above_cap"
  | "daily_wage_above_cap"
  | "nik_not_validated";
export type TaxFinalInstrument =
  | "bunga_deposito"
  | "bunga_tabungan"
  | "dividen"
  | "saham_idx"
  | "kupon_sbn"
  | "reksa_dana"
  | "p2p"
  | "kripto_domestik"
  | "kripto_luar"
  | "emas"
  | "sewa";
export type CryptoExchangeKind = "domestik" | "luar_negeri";

export interface TaxRuleRefDto {
  key: string;
  legalBasis: string;
  source: string | null;
  verified: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  outOfRange: boolean;
  note: string | null;
}
/** Public GET /calculators/tax-rules: the ref plus its value (BigInt fields as digit strings). */
export interface TaxRuleDetailDto extends TaxRuleRefDto {
  value: unknown;
}

export interface PphOpPreviewRequestDto {
  taxYear: number;
  maritalStatus: TaxMaritalStatus;
  dependents: number;
  employmentGross: string;
  pensionContribution?: string;
  freelanceGross?: string;
  nppnRateBps?: number;
  otherNetIncome?: string;
  zakat?: string;
  withheldPph21?: string;
}
export interface PphOpBracketDto {
  from: string;
  upTo: string | null;
  rateBps: number;
  label: string;
  taxable: string;
  tax: string;
}
export interface PphOpResultDto {
  taxYear: number;
  ptkp: string;
  biayaJabatan: string;
  pensionDeduction: string;
  freelanceNet: string;
  neto: string;
  zakatApplied: string;
  pkp: string;
  brackets: PphOpBracketDto[];
  tax: string;
  withheld: string;
  /** tax − withheld; negative = lebih bayar */
  balance: string;
  rules: TaxRuleRefDto[];
}

export interface TerPreviewRequestDto {
  taxYear: number;
  maritalStatus: TaxMaritalStatus;
  dependents: number;
  monthlyGross: string[];
  monthlyPension?: string[];
  zakat?: string;
  dtp?: {
    sector: DtpSector | null;
    employment: DtpEmployment;
    dailyWage?: string | null;
    nikValidated: boolean;
  } | null;
}
export interface TerMonthDto {
  month: number;
  gross: string;
  category: TerCategory;
  rateBps: number | null;
  withholding: string;
  dtp: { eligible: boolean; reasons: DtpReason[]; amount: string } | null;
}
export interface TerPreviewResultDto {
  category: TerCategory;
  months: TerMonthDto[];
  annualTax: string;
  withheldJanNov: string;
  december: string;
  isRefund: boolean;
  dtpTotal: string;
  rules: TaxRuleRefDto[];
}

export interface UmkmPreviewRequestDto {
  taxYear: number;
  monthlyOmzet: string[];
  firstRegisteredYear?: number | null;
}
export interface UmkmMonthDto {
  month: number;
  omzet: string;
  cumulative: string;
  taxable: string;
  tax: string | null;
  eligible: boolean;
}
export interface UmkmResultDto {
  taxYear: number;
  months: UmkmMonthDto[];
  totalOmzet: string;
  totalTax: string;
  exceedsCeiling: boolean;
  ineligibleReason: "time_limit" | null;
  firstRegisteredYear: number | null;
  saved: boolean;
  rules: TaxRuleRefDto[];
}

export interface PpnPreviewRequestDto {
  date: string;
  amount: string;
  luxury: boolean;
  priceIncludesPpn: boolean;
}
export interface PpnPreviewResultDto {
  priceExcludingPpn: string;
  dpp: string;
  ppn: string;
  totalWithPpn: string;
  nominalBps: number;
  effectiveBps: number;
  rules: TaxRuleRefDto[];
}

export interface TaxFinalIncomeEntryDto {
  id: string;
  taxYear: number;
  instrument: TaxFinalInstrument;
  grossAmount: string;
  occurredAt: string;
  reinvested: boolean;
  rateBpsOverride: number | null;
  investmentId: string | null;
  accountId: string | null;
  notes: string | null;
}
export interface CreateTaxFinalIncomeEntryDto {
  instrument: TaxFinalInstrument;
  grossAmount: string;
  occurredAt: string;
  reinvested?: boolean;
  rateBpsOverride?: number | null;
  investmentId?: string | null;
  accountId?: string | null;
  notes?: string | null;
}
export type UpdateTaxFinalIncomeEntryDto =
  Partial<CreateTaxFinalIncomeEntryDto>;

export interface FinalTaxLineDto {
  source: "holding" | "entry";
  instrument: TaxFinalInstrument;
  label: string;
  investmentId: string | null;
  accountId: string | null;
  entryId: string | null;
  grossAmount: string;
  rateBps: number | null;
  tax: string | null;
  rateSource: "rule" | "override" | "missing";
  belowThreshold: boolean;
  /** Machine-readable caveat, rendered via i18n: "assumed_domestic" | "assumed_sbn" | "no_purchase_date" | "no_interest_rate" | null */
  caveat:
    | "assumed_domestic"
    | "assumed_sbn"
    | "no_purchase_date"
    | "no_interest_rate"
    | null;
  rule: TaxRuleRefDto;
}
export interface FinalTaxEstimateDto {
  taxYear: number;
  lines: FinalTaxLineDto[];
  totalTax: string;
  missingRateCount: number;
  skippedForeign: number;
}

export interface SptTimingDto {
  status: SptStatus | null;
  deadline: string;
  graceUntil: string | null;
  daysToDeadline: number;
  pastDeadline: boolean;
  withinGrace: boolean;
  filedAt: string | null;
}
export interface TaxAnnualSummaryDto {
  taxYear: number;
  pphOp: {
    recordId: string;
    calcMode: TaxCalcMode;
    tax: string;
    withheld: string;
    balance: string;
  } | null;
  finalTax: { totalTax: string; lineCount: number; missingRateCount: number };
  umkm: {
    totalTax: string;
    exceedsCeiling: boolean;
    ineligibleReason: "time_limit" | null;
  } | null;
  totalEstimatedTax: string;
  spt: SptTimingDto;
  rules: TaxRuleRefDto[];
}
