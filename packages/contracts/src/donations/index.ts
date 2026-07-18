export type DonationType =
  | "zakat_maal"
  | "zakat_fitrah"
  | "infaq"
  | "sedekah"
  | "wakaf"
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
