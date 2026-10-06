// Currency & number formatting helpers (Indonesian Rupiah, id-ID locale)

/** A currency target for formatRupiah's optional conversion overload. */
export type CurrencyTarget = { code: string; rate: number };

type CurrencyConfig = { symbol: string; decimals: number };

// EPIC-016 Task B2 — display-currency config. Rates that produce these
// targets come from FxPort (apps/api/src/fx) — FrankfurterFxService (a live
// feed, cached) by default, FxMockService only under FX_PROVIDER=mock — so
// any non-IDR output stays labeled indicative (see useCurrencyPreference /
// useMoney), never presented as an authoritative real-time rate.
// EPIC-021 Group F (#1) — AUD/CNY added alongside the pre-existing
// currencies (reviewed foundation change: this file is otherwise
// protected). Batch C (revisi-2) comment update is the same kind of
// reviewed foundation change.
const CURRENCY_CONFIG: Record<string, CurrencyConfig> = {
  IDR: { symbol: "Rp", decimals: 0 },
  // Every display currency groups digits the id-ID way (period thousands,
  // comma decimal) so a foreign amount never mixes locales with the Rupiah
  // text around it; only the symbol and the decimal count are per-currency.
  // "US$" (not a bare "$") so the dollar reads unambiguously next to SGD/AUD.
  USD: { symbol: "US$", decimals: 2 },
  SGD: { symbol: "S$", decimals: 2 },
  EUR: { symbol: "€", decimals: 2 },
  JPY: { symbol: "¥", decimals: 0 },
  AUD: { symbol: "A$", decimals: 2 },
  // "CN¥" (not a bare "¥") so it never reads as JPY at a glance.
  CNY: { symbol: "CN¥", decimals: 2 },
};

/** Display symbol + decimal count for a currency code (IDR fallback). */
export function currencyDisplay(code: string): CurrencyConfig {
  return CURRENCY_CONFIG[code] ?? CURRENCY_CONFIG.IDR!;
}

/**
 * Format a numeric value as Rupiah, e.g. 1256780000 -> "Rp 1.256.780.000".
 *
 * IDR never prints decimals, and a negative always puts its sign BEFORE the
 * symbol: "-Rp 4.200.000" (ASCII hyphen-minus; never "Rp -4.200.000" and never
 * U+2212). Rounding to zero never yields "-Rp 0".
 *
 * With an optional `target` ({ code, rate }), converts `value` (assumed to be
 * IDR) into the target currency (value * rate) and formats it with that
 * currency's symbol and decimal precision (same sign-first rule). Omitting
 * `target` is byte-for-byte identical to the original single-argument
 * behavior for non-negative values.
 */
export function formatRupiah(value: number, target?: CurrencyTarget): string {
  if (!target) {
    const rounded = Math.round(value);
    const sign = rounded < 0 ? "-" : "";
    return `${sign}Rp\u00A0${Math.abs(rounded).toLocaleString("id-ID")}`;
  }
  const config = currencyDisplay(target.code);
  const converted = value * target.rate;
  const formatted = Math.abs(converted).toLocaleString("id-ID", {
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  });
  // "-0,00" must not appear: only sign a value that still rounds away from 0.
  const sign = converted < 0 && /[1-9]/.test(formatted) ? "-" : "";
  return `${sign}${config.symbol}\u00A0${formatted}`;
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/**
 * Display-only cleanup of stored notification text. React already escapes on
 * render, so an entity in the data ("Tabungan &amp; Investasi", written by an
 * older API build that HTML-escaped in-app text) would show literally. Also
 * re-formats a legacy space-less / ungrouped amount ("Rp5000000") into the
 * canonical "Rp 5.000.000". Pure string work; never injected as HTML.
 */
export function displayNotificationText(raw: string): string {
  return raw
    .replace(/&(?:amp|lt|gt|quot|#39);/g, (m) => HTML_ENTITIES[m] ?? m)
    .replace(/\bRp[ \u00A0]?(\d{4,})(?!\d|[.,]\d)/g, (_, digits: string) =>
      formatRupiah(Number(digits)),
    );
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

/**
 * Compact Rupiah for tight UI, e.g. 25850000 -> "Rp 25,85 jt".
 *
 * The thresholds are the value at which the SMALLER unit's own rounding would
 * overflow into four digits, not a round power of ten: 999.999.999 divided
 * into "jt" and shown at two decimals is 1000,00 — so it belongs in "M"
 * (1,00 M), and 999.999 shown as "rb" at zero decimals is 1000 rb, so it
 * belongs in "jt". Bucketing on 1e9/1e6/1e3 instead printed "Rp 1000,00 jt"
 * and "Rp 1000 rb".
 *
 * A negative value keeps its sign and its unit ("-Rp 1,23 M"); the original
 * `value >= …` comparisons sent every negative straight to the full
 * `formatRupiah`, which is exactly the long string the compact form exists to
 * avoid, in the tight spots (deltas, a negative net worth) where it appears.
 */
const COMPACT_M_MIN = 999_995_000;
const COMPACT_JT_MIN = 999_500;

export function formatRupiahCompact(value: number): string {
  const sign = Math.round(value) < 0 ? "-" : "";
  const abs = Math.abs(value);
  const unit = (divisor: number, decimals: number, suffix: string): string =>
    `${sign}Rp\u00A0` +
    (abs / divisor)
      .toFixed(decimals)
      .replace(/\.?0+$/, (m) => (decimals > 0 ? "" : m))
      .replace(".", ",") +
    " " +
    suffix;

  if (abs >= COMPACT_M_MIN) return unit(1_000_000_000, 2, "M");
  if (abs >= COMPACT_JT_MIN) return unit(1_000_000, 2, "jt");
  if (abs >= 1_000) return unit(1_000, 0, "rb");
  return sign + formatRupiah(abs);
}

/**
 * Chart-axis tick without the currency: 12_000_000 -> "12 jt",
 * 1_500_000_000 -> "1,5 M", -45_000 -> "-45 rb". Axes are the one place (with
 * hero secondary labels) where the compact unit form is allowed.
 */
export function formatAxisCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const trim = (n: number) =>
    n.toFixed(1).replace(/\.0$/, "").replace(".", ",");
  if (abs >= 1e9) return `${sign}${trim(abs / 1e9)} M`;
  if (abs >= 1e6) return `${sign}${trim(abs / 1e6)} jt`;
  if (abs >= 1e3) return `${sign}${trim(abs / 1e3)} rb`;
  return `${sign}${Math.round(abs)}`;
}

/**
 * The one percent format: id-ID decimal comma, at most 2 decimals, trailing
 * zeros dropped ("6,33%", "12%", "0%"). `signed` adds an explicit "+" to
 * positive deltas ("+6,33%"); a value that rounds to zero never carries a
 * sign ("0%", never "-0%" / "+0,00%"). `value` is already in percent units
 * (6.33 means 6,33%), matching what the API returns.
 */
export function formatPercent(
  value: number,
  options: { signed?: boolean } = {},
): string {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 100) / 100;
  const body = Math.abs(rounded).toLocaleString("id-ID", {
    maximumFractionDigits: 2,
  });
  if (rounded === 0) return `${body}%`;
  if (rounded < 0) return `-${body}%`;
  return `${options.signed ? "+" : ""}${body}%`;
}
