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
  // EPIC-023 G1 (D15) — `latestPriceAsOf` is the provider's own quote time
  // (falls back to `latestPriceRecordedAt` for legacy rows);
  // `latestPriceDelayed` is true only for feeds that must be labelled
  // delayed/unofficial (Yahoo `.JK`). Both null when no price exists yet —
  // the manual-only types (reksa_dana, obligasi, emas, lainnya) show an
  // honest "input manual" prompt in that case, never a fabricated figure.
  latestPriceAsOf: string | null;
  latestPriceDelayed: boolean | null;
  // EPIC-023 Task G retry (MEDIUM finding) — true only when THIS request
  // attempted a fresh automated quote and the feed failed, so the price
  // shown below is a RETAINED (stale) one, not a fresh tick. Always false
  // for manual prices and for a price that didn't need refreshing yet.
  priceRefreshFailed: boolean;
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

// EPIC-023 G1 (D15) — response shape for POST .../investments/:id/price
// (manual price entry). `source` is "manual" for user-entered prices,
// "yahoo-finance"/"coingecko"/"mock" for automated ones.
export interface InvestmentPriceDto {
  id: string;
  investmentId: string;
  price: string;
  source: string;
  asOf: string;
  delayed: boolean;
  recordedAt: string;
}
