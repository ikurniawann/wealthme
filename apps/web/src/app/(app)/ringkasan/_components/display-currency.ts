import { formatRupiah } from "@/lib/format";
import type { CurrencyCode, ForeignCurrencyCode } from "@/hooks/currencies";

export type DisplayCurrency = CurrencyCode | "GOLD";

export function isForeignCurrency(
  c: DisplayCurrency,
): c is ForeignCurrencyCode {
  return c !== "IDR" && c !== "GOLD";
}

export function formatInDisplayCurrency(
  value: number,
  displayCurrency: DisplayCurrency,
  ctx: {
    formatIdr: (v: number) => string;
    rates: Record<string, number> | undefined;
    gramPrice: number | null;
  },
): string {
  if (displayCurrency === "IDR") return ctx.formatIdr(value);
  if (displayCurrency === "GOLD") {
    return ctx.gramPrice
      ? `${(value / ctx.gramPrice).toLocaleString("id-ID", { maximumFractionDigits: 2 })} gr`
      : "...";
  }
  const rate = ctx.rates?.[displayCurrency];
  return rate
    ? `≈ ${formatRupiah(value, { code: displayCurrency, rate })}`
    : "...";
}

export function indicativeNoteCurrency(
  displayCurrency: DisplayCurrency,
  profileCurrency: string,
  profileIsIndicative: boolean,
): string | null {
  if (isForeignCurrency(displayCurrency)) return displayCurrency;
  return profileIsIndicative ? profileCurrency : null;
}
