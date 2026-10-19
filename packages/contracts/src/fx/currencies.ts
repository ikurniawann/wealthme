/** Revisi I — the input/display currency universe (matches apps/web/src/hooks/currencies.ts). */
export const FX_CURRENCY_CODES = [
  "IDR",
  "USD",
  "SGD",
  "EUR",
  "JPY",
  "AUD",
  "CNY",
  "GBP",
  "HKD",
  "MYR",
  "THB",
  "PHP",
  "KRW",
  "INR",
] as const;
export type FxCurrencyCode = (typeof FX_CURRENCY_CODES)[number];
export type ForeignFxCurrencyCode = Exclude<FxCurrencyCode, "IDR">;
export const FOREIGN_FX_CURRENCY_CODES = FX_CURRENCY_CODES.filter(
  (c): c is ForeignFxCurrencyCode => c !== "IDR",
);

/** ISO 4217 minor-unit digits. IDR and JPY have none. */
export const FX_CURRENCY_DECIMALS: Record<FxCurrencyCode, number> = {
  IDR: 0,
  USD: 2,
  SGD: 2,
  EUR: 2,
  JPY: 0,
  AUD: 2,
  CNY: 2,
  GBP: 2,
  HKD: 2,
  MYR: 2,
  THB: 2,
  PHP: 2,
  KRW: 0,
  INR: 2,
};

/** Rates travel as IDR-per-1-unit decimal strings with this many decimals. */
export const FX_RATE_SCALE = 6;
