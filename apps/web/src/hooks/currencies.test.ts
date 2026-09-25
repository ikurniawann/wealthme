/**
 * Revisi E — one currency list shared by /akun (profile preference) and
 * /ringkasan (display picker). Must match apps/api/src/fx/fx-mock.service.ts.
 */

import { en } from "@/i18n/en";
import { id } from "@/i18n/id";

import { CURRENCIES, FOREIGN_CURRENCIES } from "./currencies";

describe("CURRENCIES", () => {
  it("lists the 7 codes the FX table serves, IDR first", () => {
    expect(CURRENCIES.map((c) => c.code)).toEqual([
      "IDR",
      "USD",
      "SGD",
      "EUR",
      "JPY",
      "AUD",
      "CNY",
    ]);
  });

  it("gives every code a distinct, non-empty flag", () => {
    const flags = CURRENCIES.map((c) => c.flag);
    expect(flags.every((f) => f.length > 0)).toBe(true);
    expect(new Set(flags).size).toBe(flags.length);
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
    ]);
  });
});
