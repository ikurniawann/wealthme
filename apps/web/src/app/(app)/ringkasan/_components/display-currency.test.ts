/**
 * Revisi E — the Ringkasan picker used to convert only USD. Every FX code now
 * converts via /fx/rates, always prefixed "≈" (mock table, never live).
 * Rates below are the real values in apps/api/src/fx/fx-mock.service.ts.
 */

import {
  formatInDisplayCurrency,
  indicativeNoteCurrency,
  isForeignCurrency,
} from "./display-currency";

const RATES = {
  IDR: 1,
  USD: 0.000063,
  SGD: 0.000085,
  EUR: 0.000058,
  JPY: 0.0095,
  AUD: 0.000097,
  CNY: 0.000448,
};
const formatIdr = (v: number) => `IDR:${v}`;

describe("isForeignCurrency", () => {
  it("is true for the 6 FX codes and false for IDR and GOLD", () => {
    expect(isForeignCurrency("SGD")).toBe(true);
    expect(isForeignCurrency("CNY")).toBe(true);
    expect(isForeignCurrency("IDR")).toBe(false);
    expect(isForeignCurrency("GOLD")).toBe(false);
  });
});

describe("formatInDisplayCurrency", () => {
  it("IDR delegates to the page's own IDR formatter", () => {
    expect(
      formatInDisplayCurrency(1_000_000, "IDR", {
        formatIdr,
        rates: RATES,
        gramPrice: null,
      }),
    ).toBe("IDR:1000000");
  });

  it("converts JPY with its 0-decimal format and the indicative ≈ prefix", () => {
    expect(
      formatInDisplayCurrency(1_000_000, "JPY", {
        formatIdr,
        rates: RATES,
        gramPrice: null,
      }),
    ).toBe("≈ ¥ 9.500");
  });

  it("converts EUR with 2 decimals", () => {
    expect(
      formatInDisplayCurrency(1_000_000, "EUR", {
        formatIdr,
        rates: RATES,
        gramPrice: null,
      }),
    ).toBe("≈ € 58,00");
  });

  it("shows the loading placeholder while rates are unavailable", () => {
    expect(
      formatInDisplayCurrency(1_000_000, "SGD", {
        formatIdr,
        rates: undefined,
        gramPrice: null,
      }),
    ).toBe("...");
  });

  it("shows the loading placeholder when the chosen code is missing from the rate table", () => {
    expect(
      formatInDisplayCurrency(1_000_000, "AUD", {
        formatIdr,
        rates: { IDR: 1, USD: 0.000063 },
        gramPrice: null,
      }),
    ).toBe("...");
  });

  it("GOLD divides by the family's price per gram", () => {
    expect(
      formatInDisplayCurrency(2_500_000, "GOLD", {
        formatIdr,
        rates: undefined,
        gramPrice: 1_000_000,
      }),
    ).toBe("2,5 gr");
  });

  it("GOLD without a price shows the loading placeholder", () => {
    expect(
      formatInDisplayCurrency(2_500_000, "GOLD", {
        formatIdr,
        rates: undefined,
        gramPrice: null,
      }),
    ).toBe("...");
  });
});

describe("indicativeNoteCurrency", () => {
  it("names the picked foreign currency even when the profile is on IDR", () => {
    expect(indicativeNoteCurrency("SGD", "IDR", false)).toBe("SGD");
  });

  it("falls back to the profile currency when the picker is on IDR", () => {
    expect(indicativeNoteCurrency("IDR", "USD", true)).toBe("USD");
  });

  it("is null for IDR on an IDR profile", () => {
    expect(indicativeNoteCurrency("IDR", "IDR", false)).toBeNull();
  });

  it("is null for GOLD on an IDR profile (gold is not an FX conversion)", () => {
    expect(indicativeNoteCurrency("GOLD", "IDR", false)).toBeNull();
  });
});
