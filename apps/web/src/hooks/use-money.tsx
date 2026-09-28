"use client";

// Batch C (client revision round 2) — a single, shared display-currency
// context. Before this, `/beranda`, `/ringkasan` and `consolidated-total-card`
// each called `useCurrencyPreference()` independently and every other page
// called `formatRupiah()` directly, so a non-IDR profile currency only ever
// converted on those two pages. `DisplayCurrencyProvider` resolves the
// preference once per app shell and `useMoney()` exposes it to any page or
// shared component: `format` for full Rupiah/converted amounts,
// `formatCompact` for the tight "Rp 1,2 jt" form, plus `currency`,
// `isIndicative` and `isReady` so callers can gate a skeleton instead of ever
// rendering a 1:1 number under a foreign symbol.
//
// Money is always summed/aggregated in IDR first; `format`/`formatCompact`
// convert once, at the point of display, never before.

import { createContext, useContext, useMemo } from "react";

import { formatRupiah, formatRupiahCompact } from "@/lib/format";
import { useCurrencyPreference } from "@/hooks/use-currency-preference";

type MoneyContextValue = {
  currency: string;
  isIndicative: boolean;
  isReady: boolean;
  format: (idr: number) => string;
  formatCompact: (idr: number) => string;
};

const MoneyContext = createContext<MoneyContextValue | null>(null);

export function DisplayCurrencyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currency, formatMoney, isIndicative, isReady } =
    useCurrencyPreference();

  const value = useMemo<MoneyContextValue>(() => {
    const format = (idr: number): string =>
      isIndicative ? `≈ ${formatMoney(idr)}` : formatRupiah(idr);
    const formatCompact = (idr: number): string =>
      isIndicative ? `≈ ${formatMoney(idr)}` : formatRupiahCompact(idr);
    return { currency, isIndicative, isReady, format, formatCompact };
  }, [currency, formatMoney, isIndicative, isReady]);

  return (
    <MoneyContext.Provider value={value}>{children}</MoneyContext.Provider>
  );
}

/**
 * Read the shared display-currency preference. Must be used under
 * `DisplayCurrencyProvider` (mounted once in the `(app)` layout); falls back
 * to a plain IDR-only formatter outside it (e.g. `/split/[shareToken]`,
 * which is unauthenticated and outside the `(app)` shell) so callers never
 * crash — they simply never see a non-IDR conversion there.
 */
export function useMoney(): MoneyContextValue {
  const ctx = useContext(MoneyContext);
  if (ctx) return ctx;
  return {
    currency: "IDR",
    isIndicative: false,
    isReady: true,
    format: formatRupiah,
    formatCompact: formatRupiahCompact,
  };
}
