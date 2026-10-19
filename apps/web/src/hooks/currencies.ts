// Structural only (code/symbol); names resolve from `t.akun.pengaturan.currencies[code]`.
// `symbol` replaced emoji flags: flag emoji render as tofu boxes without an
// emoji font and as bare letters on Windows ("EU EUR").
export type CurrencyCode =
  | "IDR"
  | "USD"
  | "SGD"
  | "EUR"
  | "JPY"
  | "AUD"
  | "CNY"
  | "GBP"
  | "HKD"
  | "MYR"
  | "THB"
  | "PHP"
  | "KRW"
  | "INR";

export type ForeignCurrencyCode = Exclude<CurrencyCode, "IDR">;

export const CURRENCIES: readonly { code: CurrencyCode; symbol: string }[] = [
  { code: "IDR", symbol: "Rp" },
  { code: "USD", symbol: "US$" },
  { code: "SGD", symbol: "S$" },
  { code: "EUR", symbol: "€" },
  { code: "JPY", symbol: "¥" },
  { code: "AUD", symbol: "A$" },
  { code: "CNY", symbol: "CN¥" },
  { code: "GBP", symbol: "£" },
  { code: "HKD", symbol: "HK$" },
  { code: "MYR", symbol: "RM" },
  { code: "THB", symbol: "฿" },
  { code: "PHP", symbol: "₱" },
  { code: "KRW", symbol: "₩" },
  { code: "INR", symbol: "₹" },
];

export const FOREIGN_CURRENCIES: readonly {
  code: ForeignCurrencyCode;
  symbol: string;
}[] = CURRENCIES.filter(
  (c): c is { code: ForeignCurrencyCode; symbol: string } => c.code !== "IDR",
);
