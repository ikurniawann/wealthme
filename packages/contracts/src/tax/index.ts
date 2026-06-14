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
}

export interface CreateTaxRecordDto {
  taxYear: number;
  grossIncome: string;
  ptkp: string;
  netTax?: string;
  sptStatus?: SptStatus;
  documentUrl?: string;
  notes?: string;
}

export interface UpdateTaxRecordDto {
  taxYear?: number;
  grossIncome?: string;
  ptkp?: string;
  netTax?: string;
  sptStatus?: SptStatus;
  documentUrl?: string;
  notes?: string;
}
