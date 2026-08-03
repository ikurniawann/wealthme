export type InsuranceType =
  | "jiwa"
  | "kesehatan"
  | "kendaraan"
  | "properti"
  | "pendidikan"
  | "lainnya";
export type InsuranceStatus = "aktif" | "tidak_aktif" | "kadaluarsa";
export type PremiumPeriod = "monthly" | "quarterly" | "yearly";

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
  beneficiaries?: CreateInsuranceBeneficiaryDto[];
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
}
