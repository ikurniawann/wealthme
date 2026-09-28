import {
  UNIT_BY_TYPE,
  formatQuantity,
  hasAtMostDecimals,
  maxQuantityDecimals,
  quantityStep,
  quantityUnitLabel,
} from "./instrument-units";

const LABELS = {
  lot: "Lot",
  lembar: "Lembar",
  unit: "unit",
  gram: "gram",
  kg: "kg",
  coin: "koin",
};

describe("UNIT_BY_TYPE (Revisi D item 9)", () => {
  it.each([
    ["saham", "shares", 0],
    ["reksa_dana", "unit", 4],
    ["obligasi", "unit", null],
    // B9 follow-up — emas stays stored in grams; the decimals ceiling is
    // now expressed against the kg DISPLAY unit (6 dp of kg = 3 dp of grams,
    // the original ceiling — no precision lost or gained).
    ["emas", "gram", 6],
    ["kripto", "coin", 8],
    ["lainnya", "unit", null],
    ["deposito", "nominal", null],
  ] as const)("%s → %s, %s dp", (type, kind, maxDecimals) => {
    expect(UNIT_BY_TYPE[type]).toEqual({ kind, maxDecimals });
  });
});

describe("maxQuantityDecimals / quantityStep", () => {
  it("saham allows 2 dp in lot and whole lembar", () => {
    expect(maxQuantityDecimals("saham", "lot")).toBe(2);
    expect(maxQuantityDecimals("saham", "lembar")).toBe(0);
    expect(quantityStep("saham", "lot")).toBe("0.01");
    expect(quantityStep("saham", "lembar")).toBe("1");
  });

  it("other types follow their own decimals; unrestricted types use any", () => {
    // B9 follow-up — 6 dp of kg (see UNIT_BY_TYPE comment above).
    expect(quantityStep("emas", "lembar")).toBe("0.000001");
    expect(quantityStep("reksa_dana", "lembar")).toBe("0.0001");
    expect(quantityStep("kripto", "lembar")).toBe("0.00000001");
    expect(quantityStep("lainnya", "lembar")).toBe("any");
  });

  it("an unknown type behaves like lainnya", () => {
    expect(maxQuantityDecimals("xyz", "lembar")).toBeNull();
  });
});

describe("hasAtMostDecimals", () => {
  it.each([
    ["1.234", 3, true],
    ["1.2345", 3, false],
    ["1.2340", 3, true],
    ["7", 0, true],
    ["7.5", 0, false],
    ["0.123456789", null, true],
    ["", 3, true],
  ] as const)("%s with max %s → %s", (value, max, ok) => {
    expect(hasAtMostDecimals(value, max)).toBe(ok);
  });
});

describe("quantityUnitLabel", () => {
  it.each([
    ["saham", "lot", "Lot"],
    ["saham", "lembar", "Lembar"],
    // B9 follow-up — emas's primary single-label spots (Beli/Jual, the
    // decimals-error message, buy/sell history) now read "kg", the user's
    // explicit "Per kilogram" choice; "gram" only ever shows as the muted
    // secondary line next to it (see formatQuantityCell in page.tsx).
    ["emas", "lembar", "kg"],
    ["kripto", "lembar", "koin"],
    ["reksa_dana", "lembar", "unit"],
    ["lainnya", "lembar", "unit"],
  ] as const)("%s (%s) → %s", (type, unit, label) => {
    expect(quantityUnitLabel(type, unit, LABELS)).toBe(label);
  });
});

describe("formatQuantity", () => {
  it("formats a plain decimal string to id-ID separators (unit-agnostic)", () => {
    expect(formatQuantity("10.5", "emas")).toBe("10,5");
  });
  it("does not round a gold value with up to 6 decimal places (B9 follow-up)", () => {
    // 0.0105 kg == 10.5 g at 3dp gram precision, expressed in kg needs 4dp.
    expect(formatQuantity("0.0105", "emas")).toBe("0,0105");
    // Full mg-precision ceiling: 6dp of kg.
    expect(formatQuantity("0.000001", "emas")).toBe("0,000001");
  });
  it("keeps reksa dana units to 4 dp", () => {
    expect(formatQuantity("1250.56789", "reksa_dana")).toBe("1.250,5679");
  });
  it("shows odd lots without rounding them to zero", () => {
    expect(formatQuantity("0.07", "saham", "lot")).toBe("0,07");
  });
  it("shows whole lembar", () => {
    expect(formatQuantity("1000", "saham")).toBe("1.000");
  });
});
