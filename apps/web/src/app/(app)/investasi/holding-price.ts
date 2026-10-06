import type { InvestmentDto } from "@wealthme/contracts";

type PriceFields = Pick<
  InvestmentDto,
  | "type"
  | "currentPrice"
  | "latestPriceSource"
  | "automatedPriceSimulated"
  | "automatedPriceUnmapped"
>;

/**
 * Whether the holding's current value comes from a real price (feed, manual
 * entry, family gold price) or deposito interest. When false the API values the
 * row at its cost basis (or not at all), so its return is a stand-in 0, not a
 * measured 0: the UI shows "—" instead of "Rp 0 · 0%".
 */
export function hasMarketPrice(h: PriceFields): boolean {
  if (h.type === "deposito") return true;
  if (h.automatedPriceSimulated) return false;
  if (h.currentPrice === null) return false;
  // Emas without a family gold price or a manual entry is valued at cost.
  if (h.type === "emas" && h.latestPriceSource === null) return false;
  return true;
}

/** Saham/kripto quoted by a real feed (Yahoo/CoinGecko): the only rows "posisi berharga live" may count. */
export function hasLiveFeedPrice(h: PriceFields): boolean {
  return (
    (h.type === "saham" || h.type === "kripto") &&
    !h.automatedPriceUnmapped &&
    hasMarketPrice(h) &&
    (h.latestPriceSource === "yahoo-finance" ||
      h.latestPriceSource === "coingecko")
  );
}
