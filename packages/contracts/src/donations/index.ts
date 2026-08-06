export type DonationType =
  | "zakat_maal"
  | "zakat_fitrah"
  | "infaq"
  | "sedekah"
  | "wakaf"
  // EPIC-023 F2 (D20, US-DON-6/7) — the obligatory Christian contribution
  // (persepuluhan/tithe); tax-deductible per PP 60/2010's widening beyond
  // zakat-only. A voluntary Christian offering has no dedicated type and
  // stays recorded as "lainnya" (never deductible).
  | "persepuluhan"
  | "lainnya";

export interface DonationDto {
  id: string;
  familyGroupId: string;
  type: DonationType;
  recipient: string;
  amount: string;
  currency: string;
  donatedAt: string;
  isTaxDeductible: boolean;
  accountId: string | null;
  transactionId: string | null;
  receiptUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDonationDto {
  type: DonationType;
  recipient: string;
  amount: string;
  currency?: string;
  donatedAt: string;
  isTaxDeductible?: boolean;
  accountId?: string;
  receiptUrl?: string;
  notes?: string;
}

export interface UpdateDonationDto {
  type?: DonationType;
  recipient?: string;
  amount?: string;
  currency?: string;
  donatedAt?: string;
  isTaxDeductible?: boolean;
  receiptUrl?: string;
  notes?: string;
}
