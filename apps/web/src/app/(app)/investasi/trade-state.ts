import { effectiveMarketFor, MARKETS } from "@wealthme/contracts";
import type {
  FxCurrencyCode,
  InvestmentDto,
  InvestmentLedgerConflictDto,
  InvestmentMarket,
} from "@wealthme/contracts";
import { canonicalToTyping } from "@/components/money";
import { apiErrorMessage } from "@/lib/api-error";
import { initialPosition } from "./position-state";
import type { PositionState } from "./position-state";
import type { TradeCopy } from "./trade-copy";

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

/**
 * A 409 ledger conflict as copy for the field it concerns: INSUFFICIENT_FUNDS
 * sits under the pocket, INSUFFICIENT_HOLDINGS / HISTORY_CONFLICT in the form
 * error (the history list stays in InvestmentConflict). Null for any other
 * failure.
 */
export function conflictMessage(
  err: unknown,
  copy: TradeCopy,
  idr: (value: string) => string,
  dateOnly: boolean,
): { field: "funds" | "form"; text: string; history: boolean } | null {
  if (!err || typeof err !== "object" || !("code" in err)) return null;
  const c = err as Partial<InvestmentLedgerConflictDto>;
  // The API's exception filter may keep only `code` + `message` (the
  // Indonesian copy written for users); the structured fields are optional.
  const server = apiErrorMessage(err, "");
  if (c.code === "INSUFFICIENT_FUNDS") {
    const text =
      c.at && c.needed && c.available
        ? copy.conflictFunds(c.at, idr(c.needed), idr(c.available))
        : server || copy.conflictHistory;
    return {
      field: "funds",
      text: dateOnly ? `${text} ${copy.dateOnlyFunds}` : text,
      history: false,
    };
  }
  if (c.code === "INSUFFICIENT_HOLDINGS")
    return {
      field: "form",
      text:
        c.at && c.needed && c.available
          ? copy.conflictHoldings(c.at, c.needed, c.available)
          : server || copy.conflictHistory,
      history: false,
    };
  if (c.code === "HISTORY_CONFLICT")
    return {
      field: "form",
      text: server || copy.conflictHistory,
      history: true,
    };
  return null;
}
