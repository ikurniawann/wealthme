export type InvestmentType =
  | "saham"
  | "reksa_dana"
  | "obligasi"
  | "emas"
  | "kripto"
  | "lainnya"
  // EPIC-024 C2 (D10) — nominal, bunga %/thn (simple interest), tanggal
  // mulai + jatuh tempo. Manual-priced (never reaches MarketDataPort).
  | "deposito";

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
  // EPIC-024 C1 (D8) — true only for an automated-price type (saham/kripto)
  // whose ticker has NO route to a live feed (e.g. no CoinGecko id
  // mapping). Distinct from `priceRefreshFailed`: that flag means "a live
  // feed exists but this attempt failed" (transient, worth retrying);
  // this one means "no live feed will ever exist for this ticker" — the UI
  // shows a permanent "harga manual" fallback badge instead of a
  // refresh-failed warning, and the edit form accepts a manual price for
  // it even though the instrument type is normally automated-only.
  automatedPriceUnmapped: boolean;
  // Batch B6 (client revision round 2) — true only when the latest
  // automated-feed price row is a dev/demo simulated quote ("mock" source,
  // MockMarketDataAdapter), never a real market price. A real holding must
  // never be valued off a fabricated number: when true, `currentPrice` is
  // null and `currentValue` falls back to cost basis × quantity, and the UI
  // shows "harga belum tersedia, perbarui manual" instead of a "Live" badge.
  automatedPriceSimulated: boolean;
  // Annual interest rate (%) for interest-bearing instruments (obligasi,
  // deposito). Null when not applicable/not set.
  interestRatePct: string | null;
  // Simple projected annual yield = currentValue × interestRatePct / 100.
  // Null when either currentValue or interestRatePct is unavailable.
  projectedAnnualYield: string | null;
  // EPIC-024 C2/C3 (D7) — "tanggal beli", recorded for every instrument
  // type so a holding's history starts from the truth (US-INV-10). Null on
  // rows created before this column existed.
  purchasedAt: string | null;
  // EPIC-024 C2/C3 (D10) — deposito's jatuh tempo; null for every other
  // type and for a deposito that hasn't had one set yet.
  maturityDate: string | null;
  // EPIC-022 D2 — sum of `realizedPnl` across every SELL transaction ever
  // recorded against this holding (see InvestmentTransactionDto). Null when
  // no sell has ever been recorded (never a fabricated "0" — distinct from
  // "sold at exactly break-even").
  realizedPnlRp: string | null;
  createdAt: string;
  updatedAt: string;
}

// EPIC-022 D2 — the only two investment-transaction kinds. Buy grows the
// position and recomputes a weighted-average costBasisPerUnit; sell shrinks
// it and books a realized P/L for the sold portion.
export type InvestmentTxType = "buy" | "sell";

// EPIC-022 D2 — one buy or sell event, the real history a whole-record
// "edit" used to silently overwrite with no trace. `quantity`/`pricePerUnit`
// are this EVENT's own terms, never the holding's post-transaction state.
// `realizedPnl` is set only for a sell (null for every buy).
export interface InvestmentTransactionDto {
  id: string;
  investmentId: string;
  type: InvestmentTxType;
  quantity: string;
  pricePerUnit: string;
  occurredAt: string;
  realizedPnl: string | null;
  createdAt: string;
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
