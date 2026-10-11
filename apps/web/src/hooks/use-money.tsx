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

import {
  currencyDisplay,
  formatAxisMoney,
  formatRupiah,
  formatRupiahCompact,
} from "@/lib/format";
import { useCurrencyPreference } from "@/hooks/use-currency-preference";
import { useBalancesHidden } from "@/hooks/use-my-access";

type MoneyContextValue = {
  currency: string;
  isIndicative: boolean;
  isReady: boolean;
  format: (idr: number) => string;
  formatCompact: (idr: number) => string;
  /**
   * Chart-axis tick for an IDR value, in the display currency ("€ 2,4 rb").
   * Every axis goes through this so a tick never shows raw IDR magnitudes
   * beside amounts in another currency.
   */
  formatAxis: (idr: number) => string;
  // hardening G1 — real "Sembunyikan Saldo Default" state, so callers that
  // need to react to it directly (rare; most just call format/formatCompact)
  // don't have to re-read the profile themselves.
  hideBalance: boolean;
  formatExact: (idr: string | bigint | null) => string;
  /**
   * A single account balance as the API returned it: null means the server
   * withheld it ("Lihat saldo" off, not the viewer's own account) and renders
   * masked; a number is shown even when aggregates are masked, because the
   * API only sends it for accounts the viewer owns.
   */
  formatBalance: (
    balance: string | number | null | undefined,
    compact?: boolean,
  ) => string;
};

function rateFraction(rate: number): [bigint, bigint] {
  const [mantissa, exponentText] = rate.toString().toLowerCase().split("e");
  const exponent = Number(exponentText ?? 0);
  const [whole = "0", fraction = ""] = (mantissa ?? "0").split(".");
  const digits = BigInt(`${whole}${fraction}`);
  const scale = fraction.length - exponent;
  return scale >= 0
    ? [digits, BigInt(10) ** BigInt(scale)]
    : [digits * BigInt(10) ** BigInt(-scale), BigInt(1)];
}

function formatExactCurrency(
  amount: bigint,
  currency: string,
  rate: number,
): string {
  const { symbol, decimals } = currencyDisplay(currency);
  const negative = amount < BigInt(0);
  const absolute = negative ? -amount : amount;
  if (currency === "IDR" && rate === 1) {
    return `${negative ? "-" : ""}Rp\u00A0${new Intl.NumberFormat("id-ID").format(absolute)}`;
  }
  const [rateNumerator, rateDenominator] = rateFraction(rate);
  const scale = BigInt(10) ** BigInt(decimals);
  const scaledNumerator = absolute * rateNumerator * scale;
  const rounded =
    (scaledNumerator * BigInt(2) + rateDenominator) /
    (BigInt(2) * rateDenominator);
  const whole = rounded / scale;
  const fraction = rounded % scale;

  // Digits group the id-ID way for every currency (period thousands, comma
  // decimal); only the symbol differs, prepended like formatRupiah does.
  const wholeText = new Intl.NumberFormat("id-ID").format(whole);
  const fractionText =
    decimals > 0 ? `,${fraction.toString().padStart(decimals, "0")}` : "";
  const sign = negative && rounded > BigInt(0) ? "-" : "";
  return `${sign}${symbol}\u00A0${wholeText}${fractionText}`;
}

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

export function DisplayCurrencyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currency, rate, formatMoney, isIndicative, isReady, privacyPrefs } =
    useCurrencyPreference();
  // IDR never prints decimals (design contract: "Rp 1.234.567", no ",00").
  // "Lihat saldo" off (set by the Master on /iam): the API already withholds
  // the numbers (null + balancesHidden); every formatted amount renders
  // "••••••" so a nulled balance never shows as "Rp 0".
  const balancesHidden = useBalancesHidden();
  const privacyHide = privacyPrefs?.hideBalance ?? false;
  const hideBalance = privacyHide || balancesHidden;

  const value = useMemo<MoneyContextValue>(() => {
    // Until a non-IDR rate has actually loaded (or when it failed), show the
    // honest IDR figure under its own symbol. `formatMoney` falls back to a
    // 1:1 rate in that window, which would print an IDR-scale number under a
    // foreign symbol.
    const converts = isIndicative && isReady;
    const format = (idr: number): string => {
      const base = converts ? `≈ ${formatMoney(idr)}` : formatRupiah(idr);
      return hideBalance ? maskAmount(base) : base;
    };
    const formatCompact = (idr: number): string => {
      const base = converts
        ? `≈ ${formatMoney(idr)}`
        : formatRupiahCompact(idr);
      return hideBalance ? maskAmount(base) : base;
    };
    const formatAxis = (idr: number): string => {
      if (hideBalance) return "";
      return converts
        ? formatAxisMoney(idr * rate, currency)
        : formatAxisMoney(idr, "IDR");
    };
    const formatExact = (idr: string | bigint | null): string => {
      if (!isReady) return "…";
      if (idr === null) return maskAmount("Rp 0");
      const amount = typeof idr === "bigint" ? idr : BigInt(idr);
      const result = formatExactCurrency(amount, currency, rate);
      const indicated = isIndicative ? `≈ ${result}` : result;
      return hideBalance ? maskAmount(indicated) : indicated;
    };
    const formatBalance = (
      balance: string | number | null | undefined,
      compact = false,
    ): string => {
      if (balance === null) return maskAmount("Rp 0");
      const n =
        typeof balance === "number" ? balance : parseFloat(balance ?? "0");
      const base = compact
        ? converts
          ? `≈ ${formatMoney(n)}`
          : formatRupiahCompact(n)
        : converts
          ? `≈ ${formatMoney(n)}`
          : formatRupiah(n);
      return privacyHide ? maskAmount(base) : base;
    };
    return {
      currency,
      isIndicative,
      isReady,
      format,
      formatCompact,
      formatAxis,
      hideBalance,
      formatExact,
      formatBalance,
    };
  }, [
    currency,
    formatMoney,
    isIndicative,
    isReady,
    rate,
    hideBalance,
    privacyHide,
  ]);

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
    formatAxis: (idr) => formatAxisMoney(idr, "IDR"),
    hideBalance: false,
    formatExact: (idr) =>
      idr === null
        ? maskAmount("Rp 0")
        : formatExactCurrency(BigInt(idr), "IDR", 1),
    formatBalance: (balance, compact = false) =>
      balance === null
        ? maskAmount("Rp 0")
        : (compact ? formatRupiahCompact : formatRupiah)(
            typeof balance === "number" ? balance : parseFloat(balance ?? "0"),
          ),
  };
}
