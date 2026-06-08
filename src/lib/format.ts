// Currency & number formatting helpers (Indonesian Rupiah, id-ID locale)

/** Format a numeric value as Rupiah, e.g. 1256780000 -> "Rp 1.256.780.000" */
export function formatRupiah(value: number): string {
  return "Rp " + Math.round(value).toLocaleString("id-ID");
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
  if (value >= 1_000_000_000) return "Rp " + (value / 1_000_000_000).toFixed(2).replace(".", ",") + " M";
  if (value >= 1_000_000) return "Rp " + (value / 1_000_000).toFixed(2).replace(".", ",") + " jt";
  if (value >= 1_000) return "Rp " + (value / 1_000).toFixed(0) + " rb";
  return formatRupiah(value);
}
