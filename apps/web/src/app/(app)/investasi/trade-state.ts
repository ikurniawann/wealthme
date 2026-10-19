import { effectiveMarketFor, MARKETS } from "@wealthme/contracts";
import type {
  FxCurrencyCode,
  InvestmentDto,
  InvestmentMarket,
} from "@wealthme/contracts";
import { canonicalToTyping } from "@/components/money";
import { initialPosition } from "./position-state";
import type { PositionState } from "./position-state";

export function tradeState(
  h: InvestmentDto,
  kind: "buy" | "sell",
): PositionState {
  const market = effectiveMarketFor(h.type, h.market ?? null, h.currency);
  return {
    ...initialPosition(h.ownerUserId ?? ""),
    mode: kind,
    name: h.name,
    type: h.type,
    ticker: h.ticker,
    market,
    currency: h.currency as FxCurrencyCode,
    unit: market === "IDX" ? "lot" : "base",
    platformId: h.platformAccountId ?? "",
    pocketId: h.cashAccountId ?? "",
    details: {
      priceConvention: h.details?.bond?.priceConvention ?? "per_unit",
      unit: h.details?.gold?.unit ?? h.details?.other?.unit ?? "unit",
    },
    quantity: h.type === "deposito" ? "1" : "",
    price: "",
    knownCost: h.details?.costBasisKnown !== false,
    fee: canonicalToTyping("0", 2),
    tax: canonicalToTyping("0", 2),
  };
}
export function settlementDate(date: string, market: InvestmentMarket): string {
  if (market === "MUTUAL_FUND_ID") return "";
  const config = MARKETS[market];
  const result = new Date(`${date}T00:00:00Z`);
  let left = config.settlementDays ?? 0;
  while (left > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (!config.settlementBusinessDays || ![0, 6].includes(result.getUTCDay()))
      left--;
  }
  return result.toISOString().slice(0, 10);
}
