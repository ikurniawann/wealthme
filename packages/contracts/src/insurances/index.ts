export type InsuranceType =
  | "jiwa"
  | "kesehatan"
  | "kendaraan"
  | "properti"
  | "lainnya";
export type InsuranceStatus = "aktif" | "tidak_aktif" | "kadaluarsa";
export type PremiumPeriod = "monthly" | "quarterly" | "yearly";

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
  createdAt: string;
  updatedAt: string;
}

export interface InsuranceSummaryDto {
  activePolicies: number;
  totalMonthlyPremium: string;
  currency: string;
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
}
