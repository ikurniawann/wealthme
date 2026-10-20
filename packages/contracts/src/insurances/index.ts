export type InsuranceType =
  | "jiwa"
  | "kesehatan"
  | "kendaraan"
  | "properti"
  | "pendidikan"
  | "lainnya";
// Asuransi S2 — masa_tenggang/lapse/berakhir/dibatalkan added; the legacy
// tidak_aktif/kadaluarsa stay readable (kadaluarsa reads as "berakhir").
// Policy status is separate from payment status (InsurancePaymentDueStatus).
export type InsuranceStatus =
  | "aktif"
  | "tidak_aktif"
  | "kadaluarsa"
  | "masa_tenggang"
  | "lapse"
  | "berakhir"
  | "dibatalkan";
export const INSURANCE_STATUSES: readonly InsuranceStatus[] = [
  "aktif",
  "masa_tenggang",
  "lapse",
  "berakhir",
  "dibatalkan",
  "tidak_aktif",
  "kadaluarsa",
];

// Premium frequency. semiannual/single/custom exist in the schema; the API
// accepts them once the premium schedule lands (Asuransi Task 22).
export type PremiumPeriod =
  | "monthly"
  | "quarterly"
  | "yearly"
  | "semiannual"
  | "single"
  | "custom";
export const PREMIUM_PERIODS: readonly PremiumPeriod[] = [
  "monthly",
  "quarterly",
  "semiannual",
  "yearly",
  "single",
  "custom",
];

// Asuransi S2 — user-confirmed, never inferred from the product name.
// null on a policy = "belum ditentukan".
export type InsurancePolicyType = "traditional" | "unit_link";
export const INSURANCE_POLICY_TYPES: readonly InsurancePolicyType[] = [
  "traditional",
  "unit_link",
];

// Asuransi S4 — benefits are grouped by kind + currency, never summed into
// one "total protection" figure. Sum assured is never an asset.
export type InsuranceBenefitKind =
  | "life_sum_assured"
  | "health_annual_limit"
  | "per_event"
  | "daily"
  | "critical_illness"
  | "accident"
  | "other";
export const INSURANCE_BENEFIT_KINDS: readonly InsuranceBenefitKind[] = [
  "life_sum_assured",
  "health_annual_limit",
  "per_event",
  "daily",
  "critical_illness",
  "accident",
  "other",
];

export type InsuranceBenefitPeriod =
  | "per_year"
  | "per_event"
  | "per_day"
  | "per_policy_term"
  | "lifetime";
export const INSURANCE_BENEFIT_PERIODS: readonly InsuranceBenefitPeriod[] = [
  "per_year",
  "per_event",
  "per_day",
  "per_policy_term",
  "lifetime",
];

// Asuransi S5 — provenance and trust of a policy value.
export type InsuranceValuationSource = "manual" | "report";
export type InsuranceValuationStatus =
  | "ai_extracted"
  | "needs_confirmation"
  | "confirmed";
export const INSURANCE_VALUATION_STATUSES: readonly InsuranceValuationStatus[] =
  ["ai_extracted", "needs_confirmation", "confirmed"];

// Asuransi S2 — payment status per scheduled due (computed, not stored).
export type InsurancePaymentDueStatus = "scheduled" | "paid" | "overdue";

// EPIC-021 Group D (#14) — same beneficiary shape as InheritanceHeirDto
// (Decision #9: warisan + asuransi share one beneficiary shape).
export interface InsuranceBeneficiaryDto {
  id: string;
  insuranceId: string;
  name: string;
  relationship: string;
  sharePercent: string;
  memberUserId: string | null;
  createdAt: string;
}

export interface CreateInsuranceBeneficiaryDto {
  name: string;
  relationship: string;
  sharePercent: number;
  memberUserId?: string;
}

// Asuransi S3 — an insured person (tertanggung): a family member or free text.
export interface InsuranceInsuredDto {
  id: string;
  insuranceId: string;
  name: string;
  relationship: string | null;
  memberUserId: string | null;
  createdAt: string;
}

export interface CreateInsuranceInsuredDto {
  name: string;
  relationship?: string;
  memberUserId?: string;
}

// Asuransi S4 — one benefit. Money is a decimal string. `confirmed: false`
// marks a row the user has not reviewed yet (e.g. migrated from the legacy
// single coverageAmount).
export interface InsuranceBenefitDto {
  id: string;
  insuranceId: string;
  kind: InsuranceBenefitKind;
  label: string | null;
  amount: string | null;
  currency: string;
  period: InsuranceBenefitPeriod | null;
  note: string | null;
  isPrimary: boolean;
  confirmed: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInsuranceBenefitDto {
  kind: InsuranceBenefitKind;
  label?: string;
  amount?: string;
  currency?: string;
  period?: InsuranceBenefitPeriod;
  note?: string;
  isPrimary?: boolean;
}

// Summary rows: benefits grouped by kind + currency (never one combined sum).
export interface InsuranceBenefitGroupDto {
  kind: InsuranceBenefitKind;
  currency: string;
  total: string;
  policyCount: number;
  // true when any contributing benefit is still unconfirmed.
  hasUnconfirmed: boolean;
}

// Asuransi S5 — a unit-link sub-fund.
export interface InsuranceFundDto {
  id: string;
  insuranceId: string;
  code: string | null;
  name: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInsuranceFundDto {
  code?: string;
  name: string;
  currency?: string;
}

// Asuransi S5 — a dated value statement (policy-level when fundId is null).
// Decimals are strings. `computedValue` = units × navPerUnit, set by the
// server only when both exist and their dates are compatible; otherwise
// null with `warning`. A row never carries both reportedValue and units×NAV.
export interface InsuranceValuationDto {
  id: string;
  insuranceId: string;
  fundId: string | null;
  currency: string;
  units: string | null;
  navPerUnit: string | null;
  navDate: string | null;
  unitsDate: string | null;
  reportedValue: string | null;
  cashValue: string | null;
  surrenderEstimate: string | null;
  maturityBenefit: string | null;
  guaranteed: boolean;
  effectiveDate: string;
  source: InsuranceValuationSource;
  documentId: string | null;
  page: number | null;
  snippet: string | null;
  status: InsuranceValuationStatus;
  confirmedAt: string | null;
  computedValue: string | null;
  warning: "dates_incompatible" | "incomplete" | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInsuranceValuationDto {
  fundId?: string;
  currency?: string;
  units?: string;
  navPerUnit?: string;
  navDate?: string;
  unitsDate?: string;
  reportedValue?: string;
  cashValue?: string;
  surrenderEstimate?: string;
  maturityBenefit?: string;
  guaranteed?: boolean;
  effectiveDate: string;
  source?: InsuranceValuationSource;
  documentId?: string;
  page?: number;
  snippet?: string;
}

// Asuransi S7 — one recorded premium payment. dueDate is null on payments
// migrated from legacy transactions (the due they settled is unknown).
export interface InsurancePaymentDto {
  id: string;
  insuranceId: string;
  dueDate: string | null;
  paidAt: string;
  amount: string;
  currency: string;
  accountId: string | null;
  transactionId: string | null;
  createdAt: string;
}

// Asuransi S8 — an uploaded policy document / company report.
export interface InsuranceDocumentDto {
  id: string;
  insuranceId: string;
  fileName: string;
  mimeType: string;
  size: number;
  reportDate: string | null;
  createdAt: string;
}

export interface InsuranceDto {
  id: string;
  familyGroupId: string;
  name: string;
  provider: string | null;
  type: InsuranceType;
  status: InsuranceStatus;
  coverageAmount: string | null;
  premiumAmount: string;
  premiumPeriod: PremiumPeriod;
  renewalDate: string | null;
  autoRenewDate: boolean;
  policyNumber: string | null;
  daysUntilRenewal: number | null;
  notes: string | null;
  currency: string;
  beneficiaries: InsuranceBeneficiaryDto[];
  // EPIC-023 E2 — true when a payment transaction linked to this policy
  // landed within the current calendar-month period.
  paidThisPeriod: boolean;
  createdAt: string;
  updatedAt: string;
  // ── Asuransi rebuild — optional until the API serves them (Task 22) ──
  policyType?: InsurancePolicyType | null;
  // S1 — the split schedule dates (YYYY-MM-DD). `renewalDate` above is the
  // legacy overloaded date; reminders come only from nextPremiumDueDate.
  nextPremiumDueDate?: string | null;
  policyRenewalDate?: string | null;
  premiumPaymentEndDate?: string | null;
  coverageStartDate?: string | null;
  coverageEndDate?: string | null;
  daysUntilNextPremium?: number | null;
  // S3 — roles.
  holderUserId?: string | null;
  holderName?: string | null;
  payerUserId?: string | null;
  payerName?: string | null;
  insured?: InsuranceInsuredDto[];
  paymentAccountId?: string | null;
  // S4/S5.
  benefits?: InsuranceBenefitDto[];
  funds?: InsuranceFundDto[];
  // S6 — only confirmed value of a policy with this flag counts in net worth.
  includeInNetWorth?: boolean;
  // ── Task 22 ──
  // S2 — payment status of the next due (computed, Asia/Jakarta).
  premiumDueStatus?: Exclude<InsurancePaymentDueStatus, "paid"> | null;
  // Monthly-equivalent premium — a NORMALIZATION, not a bill (decimal string;
  // null for single/custom).
  monthlyEquivalentPremium?: string | null;
  // S9 — family members this policy is explicitly shared with.
  sharedWithUserIds?: string[];
}

// Result of POST …/insurances/:id/pay (S7). `replayed` = an earlier request
// with the same idempotency key already paid; nothing was charged again.
export interface InsurancePayResultDto extends InsuranceDto {
  payment: InsurancePaymentDto;
  replayed: boolean;
}

/** Money grouped by currency (never summed across currencies). */
export interface InsuranceCurrencyTotalDto {
  currency: string;
  total: string;
  count: number;
}

/** A policy's confirmed value (S5/S6) with its date and source. */
export interface InsuranceConfirmedValueDto {
  insuranceId: string;
  name: string;
  currency: string;
  value: string;
  effectiveDate: string;
  source: InsuranceValuationSource;
  fundId: string | null;
  includeInNetWorth: boolean;
}

export interface InsuranceSummaryDto {
  activePolicies: number;
  totalMonthlyPremium: string;
  currency: string;
  // ── Asuransi rebuild (Task 22) ──
  benefitGroups?: InsuranceBenefitGroupDto[];
  // The period the premium-due figures cover (YYYY-MM-DD, inclusive).
  period?: { from: string; to: string };
  timeZone?: string;
  // Scheduled dues falling in `period`, per currency.
  premiumDue?: InsuranceCurrencyTotalDto[];
  // Next dues already past (unpaid), per currency.
  overdue?: InsuranceCurrencyTotalDto[];
  // Monthly-equivalent premium per currency — a NORMALIZATION, not a bill.
  monthlyPremiumNormalized?: (InsuranceCurrencyTotalDto & {
    isNormalization: true;
  })[];
  confirmedValues?: InsuranceConfirmedValueDto[];
  // S6 — what insurance adds to net worth (whole IDR), the shared helper's total.
  netWorthValueIdr?: string;
}

export interface CreateInsuranceDto {
  name: string;
  provider?: string;
  type: InsuranceType;
  status?: InsuranceStatus;
  coverageAmount?: string;
  premiumAmount: string;
  premiumPeriod?: PremiumPeriod;
  renewalDate?: string;
  autoRenewDate?: boolean;
  policyNumber?: string;
  notes?: string;
  currency?: string;
  beneficiaries?: CreateInsuranceBeneficiaryDto[];
  // ── Asuransi rebuild (S1–S4) ──
  policyType?: InsurancePolicyType | null;
  nextPremiumDueDate?: string | null;
  policyRenewalDate?: string | null;
  premiumPaymentEndDate?: string | null;
  coverageStartDate?: string | null;
  coverageEndDate?: string | null;
  holderUserId?: string | null;
  holderName?: string | null;
  payerUserId?: string | null;
  payerName?: string | null;
  insured?: CreateInsuranceInsuredDto[];
  paymentAccountId?: string | null;
  benefits?: CreateInsuranceBenefitDto[];
  includeInNetWorth?: boolean;
  sharedWithUserIds?: string[];
}

export interface UpdateInsuranceDto {
  name?: string;
  provider?: string;
  type?: InsuranceType;
  status?: InsuranceStatus;
  coverageAmount?: string;
  premiumAmount?: string;
  premiumPeriod?: PremiumPeriod;
  renewalDate?: string;
  autoRenewDate?: boolean;
  policyNumber?: string;
  notes?: string;
  currency?: string;
  beneficiaries?: CreateInsuranceBeneficiaryDto[];
  // ── Asuransi rebuild (S1–S4) ──
  policyType?: InsurancePolicyType | null;
  nextPremiumDueDate?: string | null;
  policyRenewalDate?: string | null;
  premiumPaymentEndDate?: string | null;
  coverageStartDate?: string | null;
  coverageEndDate?: string | null;
  holderUserId?: string | null;
  holderName?: string | null;
  payerUserId?: string | null;
  payerName?: string | null;
  insured?: CreateInsuranceInsuredDto[];
  paymentAccountId?: string | null;
  benefits?: CreateInsuranceBenefitDto[];
  includeInNetWorth?: boolean;
  sharedWithUserIds?: string[];
}
