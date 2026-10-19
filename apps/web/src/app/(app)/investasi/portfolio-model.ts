import { effectiveMarketFor } from "@wealthme/contracts";
import type { InvestmentDto, InvestmentMoneyDto } from "@wealthme/contracts";
import type { InvestasiV3Copy } from "@/i18n/investasi-v3";

export const TYPES = [
  "saham",
  "reksa_dana",
  "obligasi",
  "emas",
  "kripto",
  "deposito",
  "lainnya",
] as const;
export interface PortfolioFilters {
  ownerUserId: string;
  platformAccountId: string;
  type: string;
  market: string;
  displayCurrency: string;
}
export const INITIAL_FILTERS: PortfolioFilters = {
  ownerUserId: "",
  platformAccountId: "",
  type: "",
  market: "",
  displayCurrency: "IDR",
};
export interface PortfolioHistory {
  points: { date: string; valueIdr: string }[];
  currency: string;
  historicalFxUnavailable: boolean;
}
export type InvestmentAction = {
  kind: "add" | "topup" | "price" | "buy" | "sell";
  investmentId?: string;
};
export function queryString(f: PortfolioFilters) {
  return new URLSearchParams(
    Object.entries(f).filter(([, v]) => v !== ""),
  ).toString();
}
export function money(
  value: string | null | undefined,
  currency: string,
  locale: string,
  hidden = false,
  precision?: number,
) {
  if (hidden) return "••••";
  if (value == null) return "—";
  return new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: precision ?? (currency === "IDR" ? 0 : 2),
  }).format(Number(value));
}
export function portfolioMoney(
  value: InvestmentMoneyDto | undefined,
  currency: string,
  locale: string,
  hidden = false,
  precision?: number,
) {
  return money(
    currency === "IDR" ? value?.idr : value?.display,
    currency,
    locale,
    hidden,
    precision,
  );
}
export function quantity(h: InvestmentDto, c: InvestasiV3Copy, locale: string) {
  const market = effectiveMarketFor(h.type, h.market ?? null, h.currency);
  const format = new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US", {
    maximumFractionDigits: 8,
  });
  const q = Number(h.quantity);
  if (h.type === "saham" && market === "IDX")
    return `${format.format(q / 100)} ${c.lot} · ${format.format(q)} ${c.lembar}`;
  const unit =
    h.type === "saham"
      ? c.shares
      : h.type === "emas"
        ? (h.details?.gold?.unit ?? c.gram)
        : (h.details?.other?.unit ?? c.units);
  return `${format.format(q)} ${unit}`;
}
/** Exact comparison for the API's fixed-point strings (display sorting only). */
export function compareDecimal(a: string | null, b: string | null): number {
  if (a === null) return b === null ? 0 : -1;
  if (b === null) return 1;
  const scaled = (s: string) => {
    const [whole, fraction = ""] = s.replace("-", "").split(".");
    return (
      BigInt(`${whole}${fraction.padEnd(8, "0").slice(0, 8)}`) *
      (s.startsWith("-") ? BigInt(-1) : BigInt(1))
    );
  };
  const left = scaled(a),
    right = scaled(b);
  return left < right ? -1 : left > right ? 1 : 0;
}
