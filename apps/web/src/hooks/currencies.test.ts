/**
 * Revisi E — one currency list shared by /akun (profile preference) and
 * /ringkasan (display picker). Must match apps/api/src/fx/fx-mock.service.ts.
 */

import { currencyDisplay } from "@/lib/format";
import { en } from "@/i18n/en";
import { id } from "@/i18n/id";

import { CURRENCIES, FOREIGN_CURRENCIES } from "./currencies";

describe("CURRENCIES", () => {
  it("lists all supported codes from the FX table, IDR first", () => {
    expect(CURRENCIES.map((c) => c.code)).toEqual([
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
    ]);
  });

  it("gives every code a distinct, non-empty symbol that matches the formatter", () => {
    const symbols = CURRENCIES.map((c) => c.symbol);
    expect(symbols.every((s) => s.length > 0)).toBe(true);
    expect(new Set(symbols).size).toBe(symbols.length);
    for (const c of CURRENCIES) {
      expect(c.symbol).toBe(currencyDisplay(c.code).symbol);
    }
  });

  it("has a display name for every code in both locales", () => {
    const codes = CURRENCIES.map((c) => c.code).sort();
    expect(Object.keys(id.akun.pengaturan.currencies).sort()).toEqual(codes);
    expect(Object.keys(en.akun.pengaturan.currencies).sort()).toEqual(codes);
  });
});

describe("FOREIGN_CURRENCIES", () => {
  it("is every code except IDR, in the same order", () => {
    expect(FOREIGN_CURRENCIES.map((c) => c.code)).toEqual([
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
    ]);
  });
});
