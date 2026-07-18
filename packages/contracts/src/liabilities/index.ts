export type LiabilityType =
  | "kartu_kredit"
  | "pinjaman_pribadi"
  | "kpr"
  | "kendaraan"
  | "lainnya";

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
  notes: string | null;
  currency: string;
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
}
