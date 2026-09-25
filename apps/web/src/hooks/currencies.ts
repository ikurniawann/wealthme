// Structural only (code/flag); names resolve from `t.akun.pengaturan.currencies[code]`.
export type CurrencyCode =
  | "IDR"
  | "USD"
  | "SGD"
  | "EUR"
  | "JPY"
  | "AUD"
  | "CNY";

export type ForeignCurrencyCode = Exclude<CurrencyCode, "IDR">;

export const CURRENCIES: readonly { code: CurrencyCode; flag: string }[] = [
  { code: "IDR", flag: "🇮🇩" },
  { code: "USD", flag: "🇺🇸" },
  { code: "SGD", flag: "🇸🇬" },
  { code: "EUR", flag: "🇪🇺" },
  { code: "JPY", flag: "🇯🇵" },
  { code: "AUD", flag: "🇦🇺" },
  { code: "CNY", flag: "🇨🇳" },
];

export const FOREIGN_CURRENCIES: readonly {
  code: ForeignCurrencyCode;
  flag: string;
}[] = CURRENCIES.filter(
  (c): c is { code: ForeignCurrencyCode; flag: string } => c.code !== "IDR",
);
