import { MARKETS, effectiveMarketFor } from "@wealthme/contracts";
import type { InvestmentDto } from "@wealthme/contracts";
export function percentPrice(h: InvestmentDto) {
  return (
    h.type === "obligasi" &&
    h.details?.bond?.priceConvention === "percent_of_par"
  );
}
export function priceUnit(h: InvestmentDto) {
  if (percentPrice(h)) return "% nominal";
  if (h.type === "obligasi") return "per unit";
  if (h.type === "emas" && h.details?.gold?.unit)
    return `per ${h.details.gold.unit}`;
  if (h.type === "lainnya" && h.details?.other?.unit)
    return `per ${h.details.other.unit}`;
  return MARKETS[effectiveMarketFor(h.type, h.market ?? null, h.currency)]
    .priceUnitLabel;
}
