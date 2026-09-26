export type LiabilityType =
  | "kartu_kredit"
  | "pinjaman_pribadi"
  | "kpr"
  | "kendaraan"
  | "lainnya";

export type InterestMethod = "efektif" | "flat" | "anuitas";

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
  startDate?: string;
  installmentAmount?: string;
  fixedRateMonths?: number;
  floatingRate?: string;
}

export interface LiabilityScheduleRowDto {
  period: number;
  installment: string;
  interest: string;
  principal: string;
  remaining: string;
}

export interface LiabilityScheduleDto {
  liabilityId: string;
  interestMethod: InterestMethod;
  installmentAmount: string | null;
  rows: LiabilityScheduleRowDto[];
}
