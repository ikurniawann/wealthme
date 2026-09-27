export type LiabilityType =
  | "kartu_kredit"
  | "pinjaman_pribadi"
  | "kpr"
  | "kendaraan"
  | "lainnya";

export type InterestMethod = "efektif" | "flat" | "anuitas";

export type KprScheme =
  | "konvensional"
  | "berjenjang"
  | "flpp"
  | "syariah_murabahah"
  | "syariah_mmq";

export type RatePeriodKind = "fixed" | "floating";

export type PrepaymentMode = "full" | "reduce_tenor" | "reduce_installment";

// Revisi K — one KPR rate period; months null = runs to maturity (last period only).
export interface LiabilityRatePeriodDto {
  kind: RatePeriodKind;
  months: number | null;
  ratePercent: string;
}

export interface LiabilityDto {
  id: string;
  familyGroupId: string;
  name: string;
  institution: string | null;
  type: LiabilityType;
  totalDebt: string;
  remainingBalance: string;
  minimumPayment: string;
  interestRate: string;
  dueDate: string | null;
  // E2E round 1 bug 2 — the real next-installment due date for
  // installment-type liabilities (kpr/kendaraan/pinjaman_pribadi with a
  // Tanggal Akad + tenor), computed by the same due-anchor rule the
  // amortisation schedule uses (see LiabilitiesService.nextDueDateFor).
  // `dueDate` is a separate legacy manual field the KPR form never sets —
  // prefer `nextDueDate ?? dueDate` everywhere "next due" is displayed.
  nextDueDate: string | null;
  autoAdvanceDueDate: boolean;
  paymentRatio: number;
  // EPIC-023 E2 — true when a payment transaction linked to this liability
  // landed within the current calendar-month period.
  paidThisPeriod: boolean;
  notes: string | null;
  currency: string;
  // Revisi G — per-product interest terms.
  interestMethod: InterestMethod;
  tenorMonths: number | null;
  startDate: string | null;
  installmentAmount: string | null;
  // Installment due now; past a KPR's fixed period, re-amortised at the floating rate.
  currentInstallmentAmount: string | null;
  fixedRateMonths: number | null;
  floatingRate: string | null;
  kprScheme: KprScheme | null;
  ratePeriods: LiabilityRatePeriodDto[];
  // Annual rate the next installment accrues at.
  currentRatePercent: string;
  // The installment now due is late (5-day grace window) or the loan is past maturity: the Pay dialog shows "Telat".
  currentInstallmentLate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LiabilitySummaryDto {
  totalRemainingBalance: string;
  totalDebt: string;
  currency: string;
}

export interface CreateLiabilityDto {
  name: string;
  institution?: string;
  type: LiabilityType;
  totalDebt: string;
  remainingBalance: string;
  minimumPayment?: string;
  interestRate?: string;
  dueDate?: string;
  autoAdvanceDueDate?: boolean;
  notes?: string;
  currency?: string;
  interestMethod?: InterestMethod;
  tenorMonths?: number;
  startDate?: string;
  installmentAmount?: string;
  fixedRateMonths?: number;
  floatingRate?: string;
  kprScheme?: KprScheme;
  ratePeriods?: LiabilityRatePeriodDto[];
}

export interface UpdateLiabilityDto {
  name?: string;
  institution?: string;
  type?: LiabilityType;
  totalDebt?: string;
  remainingBalance?: string;
  minimumPayment?: string;
  interestRate?: string;
  dueDate?: string;
  autoAdvanceDueDate?: boolean;
  notes?: string;
  currency?: string;
  interestMethod?: InterestMethod;
  tenorMonths?: number;
  // null clears a previously set Tanggal Akad.
  startDate?: string | null;
  installmentAmount?: string;
  fixedRateMonths?: number;
  floatingRate?: string;
  kprScheme?: KprScheme;
  ratePeriods?: LiabilityRatePeriodDto[];
}

export interface LiabilityScheduleRowDto {
  period: number;
  installment: string;
  interest: string;
  principal: string;
  remaining: string;
}

// Consecutive schedule rows sharing one rate; floating bands are estimates.
export interface LiabilityRateBandDto {
  fromPeriod: number;
  toPeriod: number;
  ratePercent: string;
  kind: RatePeriodKind;
}

export interface LiabilityScheduleDto {
  liabilityId: string;
  interestMethod: InterestMethod;
  installmentAmount: string | null;
  rows: LiabilityScheduleRowDto[];
  rateBands: LiabilityRateBandDto[];
  hasFloatingPeriod: boolean;
}

// Read-only split a payment of `amount` would book right now (same math as pay).
export interface LiabilityPaymentPreviewDto {
  liabilityId: string;
  amount: string;
  interest: string;
  principal: string;
  remainingAfter: string;
}

// Revisi K — a floating-rate change the user recorded from a bank notice.
export interface LiabilityFloatingRateDto {
  id: string;
  // YYYY-MM-DD
  effectiveDate: string;
  ratePercent: string;
  // First installment accruing at this rate; null when the loan has no Tanggal Akad.
  effectivePeriod: number | null;
  note: string | null;
  createdAt: string;
}

export interface CreateLiabilityFloatingRateDto {
  effectiveDate: string;
  ratePercent: string;
  note?: string;
}

// Revisi K — read-only early-repayment simulation; nothing is recorded.
export interface LiabilityPrepaymentPreviewDto {
  liabilityId: string;
  mode: PrepaymentMode;
  prepaidPrincipal: string;
  penaltyPercent: string;
  penalty: string;
  cashOutNow: string;
  installmentBefore: string | null;
  installmentAfter: string | null;
  remainingMonthsBefore: number;
  remainingMonthsAfter: number;
  totalInterestBefore: string;
  totalInterestAfter: string;
  interestSaved: string;
  // May be negative when the penalty exceeds the interest saved.
  netSaving: string;
  // True when the projection runs into a floating period (assumes today's floating rate persists).
  assumesCurrentFloatingRate: boolean;
}

// Revisi K — record an early repayment (the simulator's "Catat pelunasan").
export interface RecordLiabilityPrepaymentDto {
  sourceAccountId: string;
  mode: PrepaymentMode;
  amount?: string;
  penaltyPercent?: string;
  // Client UUID, one per simulation; a repeat returns the first record.
  idempotencyKey: string;
}

export interface LiabilityPrepaymentDto {
  id: string;
  mode: PrepaymentMode;
  principalAmount: string;
  penaltyPercent: string;
  penaltyAmount: string;
  effectivePeriod: number;
  installmentBefore: string | null;
  installmentAfter: string | null;
  tenorMonthsBefore: number;
  tenorMonthsAfter: number;
  occurredAt: string;
}

export interface LiabilityPrepaymentRecordResultDto {
  liability: LiabilityDto;
  prepayment: LiabilityPrepaymentDto;
  replayed: boolean;
}
