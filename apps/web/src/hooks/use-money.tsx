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
  // hardening G1 — real "Sembunyikan Saldo Default" state, so callers that
  // need to react to it directly (rare; most just call format/formatCompact)
  // don't have to re-read the profile themselves.
  hideBalance: boolean;
};

const MoneyContext = createContext<MoneyContextValue | null>(null);

// Masks the numeric portion of an already-formatted amount, keeping any
// leading currency symbol/prefix (e.g. "Rp ", "≈ $ ") — never the digits
// themselves, since "Sembunyikan Saldo Default" promises no real amount
// leaks while it's on.
function maskAmount(formatted: string): string {
  const digitIndex = formatted.search(/\d/);
  const prefix = digitIndex === -1 ? formatted : formatted.slice(0, digitIndex);
  return `${prefix}••••••`;
}

// "Tampilkan Desimal" only affects the plain IDR path (no conversion target)
// — formatRupiah never prints decimals there. Converted amounts already
// carry their currency's own decimal precision from CURRENCY_CONFIG.
function withDecimals(formatted: string): string {
  return /,\d\d$/.test(formatted) ? formatted : `${formatted},00`;
}

export function DisplayCurrencyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currency, formatMoney, isIndicative, isReady, privacyPrefs } =
    useCurrencyPreference();
  // Conservative fallback while the profile hasn't resolved yet (or in a
  // test harness that mocks useCurrencyPreference() directly, predating this
  // field): behave exactly like before this batch, i.e. no decimals shown.
  // Once the real profile loads, resolvePrivacyPrefs always fills both keys.
  const hideBalance = privacyPrefs?.hideBalance ?? false;
  const showDecimal = privacyPrefs?.showDecimal ?? false;

  const value = useMemo<MoneyContextValue>(() => {
    // Until a non-IDR rate has actually loaded (or when it failed), show the
    // honest IDR figure under its own symbol. `formatMoney` falls back to a
    // 1:1 rate in that window, which would print an IDR-scale number under a
    // foreign symbol.
    const converts = isIndicative && isReady;
    const format = (idr: number): string => {
      const base = converts ? `≈ ${formatMoney(idr)}` : formatRupiah(idr);
      const withDecimalsApplied =
        showDecimal && !converts ? withDecimals(base) : base;
      return hideBalance
        ? maskAmount(withDecimalsApplied)
        : withDecimalsApplied;
    };
    const formatCompact = (idr: number): string => {
      const base = converts
        ? `≈ ${formatMoney(idr)}`
        : formatRupiahCompact(idr);
      return hideBalance ? maskAmount(base) : base;
    };
    return {
      currency,
      isIndicative,
      isReady,
      format,
      formatCompact,
      hideBalance,
    };
  }, [currency, formatMoney, isIndicative, isReady, hideBalance, showDecimal]);

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
    hideBalance: false,
  };
}
