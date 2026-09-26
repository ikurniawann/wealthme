import { formatAmountInput } from "@/lib/format";

import { moneyDigits, withFxInputs } from "./fx-inputs";
import { TEST_FX_RATES } from "./fx-test-rates";
import {
  canonicalToTyping,
  formatIdrPreview,
  formatMoneyTyping,
  idrPreview,
  toCanonicalAmount,
} from "./money-format";

import type { MoneyField } from "./use-money-field";

describe("formatMoneyTyping — revisi I", () => {
  it.each(["1250000", "0012", "1.250.000", "abc", "", "1.250,50", "Rp 5.000"])(
    "IDR (0 decimals) matches lib/format formatAmountInput for %p",
    (raw) => {
      expect(formatMoneyTyping(raw, 0)).toBe(formatAmountInput(raw));
    },
  );

  it("2-decimal currencies keep up to 2 digits after the comma", () => {
    expect(formatMoneyTyping("1250,505", 2)).toBe("1.250,50");
    expect(formatMoneyTyping("1250,", 2)).toBe("1.250,");
    expect(formatMoneyTyping(",5", 2)).toBe("0,5");
  });

  it("0-decimal currencies drop the fraction (JPY)", () => {
    expect(formatMoneyTyping("1500,5", 0)).toBe("15.005");
  });

  it("keeps a leading minus only when allowed", () => {
    expect(formatMoneyTyping("-20,00", 2, true)).toBe("-20,00");
    expect(formatMoneyTyping("-20", 2, false)).toBe("20");
    expect(formatMoneyTyping("-", 0, true)).toBe("-");
  });
});

describe("toCanonicalAmount / canonicalToTyping — revisi I", () => {
  it("canonicalises the id-ID display", () => {
    expect(toCanonicalAmount("1.250,50")).toBe("1250.50");
    expect(toCanonicalAmount("-20")).toBe("-20");
    expect(toCanonicalAmount("0,5")).toBe("0.5");
    expect(toCanonicalAmount("")).toBeNull();
    expect(toCanonicalAmount("-")).toBeNull();
  });

  it("round-trips a stored decimal back to display", () => {
    expect(canonicalToTyping("12345.67", 2)).toBe("12.345,67");
    expect(canonicalToTyping("-358278", 0, true)).toBe("-358.278");
  });
});

describe("idrPreview / formatIdrPreview — revisi I", () => {
  it("uses the same rounding as the server", () => {
    expect(idrPreview("1250.50", "USD", TEST_FX_RATES, 0)).toBe(
      BigInt(22_401_332),
    );
    expect(idrPreview("-20.00", "USD", TEST_FX_RATES, 0)).toBe(
      -BigInt(358_278),
    );
    expect(idrPreview("12.34", "USD", TEST_FX_RATES, 2)).toBe(
      BigInt(22_105_752),
    );
    expect(idrPreview("250000", "IDR", undefined, 0)).toBe(BigInt(250_000));
  });

  it("is null when empty or when a foreign rate is not loaded", () => {
    expect(idrPreview(null, "USD", TEST_FX_RATES, 0)).toBeNull();
    expect(idrPreview("1.00", "USD", undefined, 0)).toBeNull();
  });

  it("formats whole rupiah and sen", () => {
    expect(formatIdrPreview(BigInt(22_401_332), 0)).toBe("Rp 22.401.332");
    expect(formatIdrPreview(BigInt(22_105_752), 2)).toBe("Rp 221.057,52");
  });
});

describe("moneyDigits — revisi I", () => {
  const f = (over: Partial<MoneyField>) =>
    ({
      allowNegative: false,
      currency: "IDR",
      raw: "",
      resolved: { idrPreview: null },
      ...over,
    }) as unknown as MoneyField;

  it("IDR keeps the old digit strip (sign only when allowed)", () => {
    expect(moneyDigits(f({ raw: "1.250.000" }))).toBe("1250000");
    expect(moneyDigits(f({ raw: "-1.000", allowNegative: true }))).toBe(
      "-1000",
    );
    expect(moneyDigits(f({ raw: "-1.000" }))).toBe("1000");
  });

  it("a foreign currency sends the preview", () => {
    expect(
      moneyDigits(
        f({
          currency: "JPY",
          raw: "-1.000",
          allowNegative: true,
          resolved: { idrPreview: -BigInt(113_674) } as MoneyField["resolved"],
        }),
      ),
    ).toBe("-113674");
  });
});

describe("withFxInputs — revisi I", () => {
  const field = (fx: ResolvedFx) =>
    ({ resolved: { fx } }) as unknown as MoneyField;
  type ResolvedFx = MoneyField["resolved"]["fx"];

  it("returns the SAME body object when every field is IDR (no fxInputs key)", () => {
    const body = { amount: 250_000 };
    const out = withFxInputs(body, [["amount", field(null)]]);
    expect(out).toBe(body);
    expect(out).not.toHaveProperty("fxInputs");
  });

  it("adds fxInputs for foreign fields only", () => {
    const out = withFxInputs({ amount: 1, adminFee: 0 }, [
      ["amount", field({ currency: "USD", amount: "10.00" })],
      ["adminFee", field(null)],
    ]);
    expect(out).toEqual({
      amount: 1,
      adminFee: 0,
      fxInputs: [{ field: "amount", currency: "USD", amount: "10.00" }],
    });
  });
});
