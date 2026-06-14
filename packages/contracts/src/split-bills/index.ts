export type SplitStatus = "open" | "settled";
export type ParticipantStatus = "pending" | "paid";

export interface SplitParticipantDto {
  id: string;
  splitBillId: string;
  name: string;
  amountOwed: string;
  status: ParticipantStatus;
  paidAt: string | null;
  createdAt: string;
}

export interface SplitBillDto {
  id: string;
  familyGroupId: string;
  title: string;
  totalAmount: string;
  currency: string;
  shareToken: string;
  status: SplitStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  participants: SplitParticipantDto[];
}

export interface CreateSplitParticipantDto {
  name: string;
  amountOwed: number;
}

export interface CreateSplitBillDto {
  title: string;
  totalAmount: number;
  notes?: string;
  participants: CreateSplitParticipantDto[];
}
