/**
 * Canonical IDR text for server-built strings (in-app notification bodies,
 * emails). Mirrors `formatRupiah` in apps/web/src/lib/format.ts so the same
 * figure reads identically everywhere: "Rp 1.234.567", never decimals, and a
 * negative puts its ASCII hyphen-minus BEFORE the symbol ("-Rp 4.200.000").
 *
 * Grouping is done by hand (not `toLocaleString`) so the output never depends
 * on the runtime's ICU data, and so a `bigint` ledger amount never loses
 * precision through `Number()`.
 */
export function formatRupiah(amount: bigint | number | string): string {
  const value =
    typeof amount === "bigint"
      ? amount
      : BigInt(Math.round(Number(amount)) || 0);
  const negative = value < BigInt(0);
  const digits = (negative ? -value : value).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}Rp ${grouped}`;
}
