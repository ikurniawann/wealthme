import type { InvestmentType } from "@prisma/client";

/**
 * EPIC-023 G1 (D15) — widened from `{price, source}`: every automated quote
 * must carry its own as-of time and whether it is delayed, so the UI can
 * label it honestly instead of implying a live figure. `asOf` is the
 * provider's own quote timestamp (falls back to "now" for feeds that don't
 * expose one, e.g. CoinGecko without `last_updated_at`). `delayed` is true
 * only for feeds the product decision requires labelling delayed/unofficial
 * (Yahoo `.JK` IDX equities) — false for near-real-time feeds and manual
 * entries (manual entries never go through this port at all — see
 * AUTOMATED_PRICE_TYPES below).
 */
export interface MarketDataQuote {
  price: number;
  source: string;
  asOf: Date;
  delayed: boolean;
}

export interface MarketDataPort {
  /**
   * `type` selects the routing behind the port (crypto → CoinGecko, saham →
   * Yahoo `.JK`). Callers must never invoke this for a type in
   * `AUTOMATED_PRICE_TYPES`'s complement — see investments.service.ts.
   */
  getPrice(ticker: string, type: InvestmentType): Promise<MarketDataQuote>;
}

export const MARKET_DATA_PORT = "MARKET_DATA_PORT";

/**
 * EPIC-023 G1 (D15) — "automate what can be automated, label the rest".
 * Only these two instrument types ever get an automated quote; mutual funds
 * (reksa_dana), bonds (obligasi), gold (emas) and "lainnya" are manual-only —
 * no live feed exists or may be fabricated for them, matching the family
 * gold price precedent (family-groups.service.ts's goldPricePerGram).
 */
export const AUTOMATED_PRICE_TYPES: ReadonlySet<InvestmentType> = new Set([
  "saham",
  "kripto",
]);

export function isAutomatedPriceType(type: InvestmentType): boolean {
  return AUTOMATED_PRICE_TYPES.has(type);
}
