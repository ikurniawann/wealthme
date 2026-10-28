import {
  convertToIdr,
  deriveIdrPerUnit,
  divRoundHalfUp,
  formatScaled,
  isFxCurrency,
  parseMinor,
  parseScaled,
} from "@wealthme/contracts";

// Rates below are real ECB (Frankfurter) values for 2026-09-25, base EUR:
// IDR 20427.22, USD 1.1403, JPY 179.7 → USD = 17913.899851, JPY = 113.674012 IDR/unit.
const USD = "17913.899851";
const JPY = "113.674012";

describe("parseScaled / parseMinor — revisi I", () => {
  it("parses canonical decimals at the requested scale", () => {
    expect(parseScaled("1250.50", 2)).toBe(125050n);
    expect(parseScaled("1250.5", 2)).toBe(125050n);
    expect(parseScaled("-20", 2)).toBe(-2000n);
    expect(parseScaled("20427.22", 6)).toBe(20427220000n);
  });

  it.each(["1.234", "abc", "1e5", "", "1,5", "--1", "."])(
    "rejects %p at scale 2",
    (bad) => {
      expect(() => parseScaled(bad, 2)).toThrow(RangeError);
    },
  );

  it("JPY and IDR have no minor unit: decimals are rejected, not rounded", () => {
    expect(parseMinor("1500", "JPY")).toBe(1500n);
    expect(() => parseMinor("1500.5", "JPY")).toThrow(RangeError);
    expect(() => parseMinor("250000.01", "IDR")).toThrow(RangeError);
    expect(parseMinor("0.01", "USD")).toBe(1n);
  });

  it("isFxCurrency accepts exactly the supported currency codes", () => {
    expect(
      [
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
      ].every(isFxCurrency),
    ).toBe(true);
    expect(isFxCurrency("ZZZ")).toBe(false);
    expect(isFxCurrency("usd")).toBe(false);
  });
});

describe("divRoundHalfUp — revisi I", () => {
  it("rounds .5 away from zero, both signs", () => {
    expect(divRoundHalfUp(5n, 2n)).toBe(3n);
    expect(divRoundHalfUp(-5n, 2n)).toBe(-3n);
    expect(divRoundHalfUp(4n, 2n)).toBe(2n);
    expect(divRoundHalfUp(1n, 4n)).toBe(0n);
    expect(divRoundHalfUp(3n, 4n)).toBe(1n);
    expect(divRoundHalfUp(-3n, 4n)).toBe(-1n);
  });

  it("rejects a non-positive divisor", () => {
    expect(() => divRoundHalfUp(1n, 0n)).toThrow(RangeError);
    expect(() => divRoundHalfUp(1n, -2n)).toThrow(RangeError);
  });
});

describe("convertToIdr — revisi I", () => {
  it("USD 1,250.50 → Rp 22.401.332 (1250.50 × 17913.899851 = 22401331.7637)", () => {
    expect(
      convertToIdr({
        amount: "1250.50",
        currency: "USD",
        idrPerUnit: USD,
        targetScale: 0,
      }),
    ).toBe(22_401_332n);
  });

  it("USD 0.01 → Rp 179 (179.139)", () => {
    expect(
      convertToIdr({
        amount: "0.01",
        currency: "USD",
        idrPerUnit: USD,
        targetScale: 0,
      }),
    ).toBe(179n);
  });

  it("negative cash: USD -20.00 → -Rp 358.278 (symmetric with +20.00)", () => {
    expect(
      convertToIdr({
        amount: "-20.00",
        currency: "USD",
        idrPerUnit: USD,
        targetScale: 0,
      }),
    ).toBe(-358_278n);
    expect(
      convertToIdr({
        amount: "20.00",
        currency: "USD",
        idrPerUnit: USD,
        targetScale: 0,
      }),
    ).toBe(358_278n);
  });

  it("decimal2 target keeps sen: USD 12.34 → Rp 221.057,52", () => {
    expect(
      convertToIdr({
        amount: "12.34",
        currency: "USD",
        idrPerUnit: USD,
        targetScale: 2,
      }),
    ).toBe(22_105_752n);
  });

  it("JPY 1,500 → Rp 170.511", () => {
    expect(
      convertToIdr({
        amount: "1500",
        currency: "JPY",
        idrPerUnit: JPY,
        targetScale: 0,
      }),
    ).toBe(170_511n);
  });

  it("an exact half rounds away from zero", () => {
    expect(
      convertToIdr({
        amount: "1",
        currency: "JPY",
        idrPerUnit: "2.500000",
        targetScale: 0,
      }),
    ).toBe(3n);
    expect(
      convertToIdr({
        amount: "-1",
        currency: "JPY",
        idrPerUnit: "2.500000",
        targetScale: 0,
      }),
    ).toBe(-3n);
  });

  it("IDR passes through without a rate (scale 0 and 2)", () => {
    expect(
      convertToIdr({
        amount: "250000",
        currency: "IDR",
        idrPerUnit: "1.000000",
        targetScale: 0,
      }),
    ).toBe(250_000n);
    expect(
      convertToIdr({
        amount: "250000",
        currency: "IDR",
        idrPerUnit: "1.000000",
        targetScale: 2,
      }),
    ).toBe(25_000_000n);
  });

  it("rejects a zero or negative rate", () => {
    expect(() =>
      convertToIdr({
        amount: "1",
        currency: "USD",
        idrPerUnit: "0",
        targetScale: 0,
      }),
    ).toThrow(RangeError);
    expect(() =>
      convertToIdr({
        amount: "1",
        currency: "USD",
        idrPerUnit: "-1",
        targetScale: 0,
      }),
    ).toThrow(RangeError);
  });
});

describe("formatScaled / deriveIdrPerUnit — revisi I", () => {
  it("formats scaled integers as canonical decimals", () => {
    expect(formatScaled(22_105_752n, 2)).toBe("221057.52");
    expect(formatScaled(-358_278n, 0)).toBe("-358278");
    expect(formatScaled(-5n, 2)).toBe("-0.05");
    expect(formatScaled(0n, 2)).toBe("0.00");
    expect(formatScaled(17_913_899_851n, 6)).toBe("17913.899851");
  });

  it("derives IDR per unit from EUR crosses at scale 6", () => {
    expect(deriveIdrPerUnit("20427.22", "1.1403")).toBe(USD);
    expect(deriveIdrPerUnit("20427.22", "179.7")).toBe(JPY);
    expect(deriveIdrPerUnit("20427.22", "1")).toBe("20427.220000");
  });
});
