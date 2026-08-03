export type InvestmentType =
  | "saham"
  | "reksa_dana"
  | "obligasi"
  | "emas"
  | "kripto"
  | "lainnya";

export interface InvestmentDto {
  id: string;
  familyGroupId: string;
  ticker: string;
  name: string;
  type: InvestmentType;
  quantity: string; // Decimal serialized as string
  costBasisPerUnit: string;
  currentPrice: string | null;
  currentValue: string | null;
  returnRp: string | null;
  returnPct: number | null;
  currency: string;
  notes: string | null;
  // EPIC-021 #20: latest price provenance, for the "online stock detail" row.
  latestPriceRecordedAt: string | null;
  latestPriceSource: string | null;
  // Annual interest rate (%) for interest-bearing instruments (obligasi,
  // deposito). Null when not applicable/not set.
  interestRatePct: string | null;
  // Simple projected annual yield = currentValue × interestRatePct / 100.
  // Null when either currentValue or interestRatePct is unavailable.
  projectedAnnualYield: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvestmentSummaryDto {
  totalCostBasis: string;
  totalCurrentValue: string;
  totalReturnRp: string;
  totalReturnPct: number;
  todayReturnRp: string;
  todayReturnPct: number;
}
