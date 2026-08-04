// Currency & number formatting helpers (Indonesian Rupiah, id-ID locale)

/** A currency target for formatRupiah's optional conversion overload. */
export type CurrencyTarget = { code: string; rate: number };

type CurrencyConfig = { symbol: string; decimals: number; locale: string };

// EPIC-016 Task B2 — display-currency config. Rates that produce these
// targets come from the mock FxPort (apps/api/src/fx), so any non-IDR
// output is always indicative, never a live market rate.
// EPIC-021 Group F (#1) — AUD/CNY added alongside the pre-existing
// currencies (reviewed foundation change: this file is otherwise
// protected). Rates still come from the mock FxPort, so both stay
// indicative, never a live market rate.
const CURRENCY_CONFIG: Record<string, CurrencyConfig> = {
  IDR: { symbol: "Rp", decimals: 0, locale: "id-ID" },
  USD: { symbol: "$", decimals: 2, locale: "en-US" },
  SGD: { symbol: "S$", decimals: 2, locale: "en-SG" },
  // en-US (not de-DE) so EUR renders with a period decimal separator
  // ("€ 58.00"), consistent with USD/SGD — the € symbol is prepended
  // manually, so the locale here only controls digit grouping.
  EUR: { symbol: "€", decimals: 2, locale: "en-US" },
  JPY: { symbol: "¥", decimals: 0, locale: "ja-JP" },
  AUD: { symbol: "A$", decimals: 2, locale: "en-AU" },
  // "CN¥" (not a bare "¥") so it never reads as JPY at a glance.
  CNY: { symbol: "CN¥", decimals: 2, locale: "zh-CN" },
};

/**
 * Format a numeric value as Rupiah, e.g. 1256780000 -> "Rp 1.256.780.000".
 *
 * With an optional `target` ({ code, rate }), converts `value` (assumed to be
 * IDR) into the target currency (value * rate) and formats it with that
 * currency's symbol and decimal precision. Omitting `target` is byte-for-byte
 * identical to the original single-argument behavior — every existing call
 * site across the app is unaffected.
 */
export function formatRupiah(value: number, target?: CurrencyTarget): string {
  if (!target) {
    return "Rp " + Math.round(value).toLocaleString("id-ID");
  }
  const config = CURRENCY_CONFIG[target.code] ?? CURRENCY_CONFIG.IDR!;
  const converted = value * target.rate;
  const formatted = converted.toLocaleString(config.locale, {
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  });
  return `${config.symbol} ${formatted}`;
}

/** Format a number with id-ID thousands separators (no currency prefix). */
export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("id-ID");
}

/** Parse a user-entered Rupiah/number string ("1.256.780" / "Rp 5.000") into a number. */
export function parseRupiah(value: string | null | undefined): number {
  if (!value) return 0;
  return parseInt(value.replace(/\D/g, ""), 10) || 0;
}

/** Live-format an input value: strip non-digits then re-group with id-ID separators. */
export function formatAmountInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return parseInt(digits, 10).toLocaleString("id-ID");
}

/** Compact Rupiah for tight UI, e.g. 25850000 -> "Rp 25,85 jt" */
export function formatRupiahCompact(value: number): string {
  if (value >= 1_000_000_000)
    return "Rp " + (value / 1_000_000_000).toFixed(2).replace(".", ",") + " M";
  if (value >= 1_000_000)
    return "Rp " + (value / 1_000_000).toFixed(2).replace(".", ",") + " jt";
  if (value >= 1_000) return "Rp " + (value / 1_000).toFixed(0) + " rb";
  return formatRupiah(value);
}
