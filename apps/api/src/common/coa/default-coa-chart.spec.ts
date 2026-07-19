import {
  defaultCoaCodeForCategory,
  GENERIC_COA_CHART,
} from "./default-coa-chart";

function directionOf(code: string): string {
  const entry = GENERIC_COA_CHART.find((c) => c.code === code);
  if (!entry) throw new Error(`No generic COA account for code ${code}`);
  return entry.direction;
}

describe("defaultCoaCodeForCategory", () => {
  it("maps a known name to a hinted account of the matching direction", () => {
    expect(defaultCoaCodeForCategory("income", "Gaji")).toBe("10001");
    expect(defaultCoaCodeForCategory("expense", "Makan & Minum")).toBe("20001");
  });

  it("falls back to the catch-all bucket for an unknown name", () => {
    expect(defaultCoaCodeForCategory("income", "Sesuatu")).toBe("10099");
    expect(defaultCoaCodeForCategory("expense", "Sesuatu")).toBe("20099");
  });

  it("never links an income category to a non-INCOME account", () => {
    for (const name of ["Gaji", "Tabungan", "Utang", "Pajak", "Zzz"]) {
      expect(directionOf(defaultCoaCodeForCategory("income", name))).toBe(
        "INCOME",
      );
    }
  });

  it("never links an expense category to an INCOME account (TRANSFER is allowed)", () => {
    // Regression: "Tabungan & Investasi" (expense) must resolve to a
    // wealth-allocation TRANSFER account, never an INCOME account.
    expect(
      directionOf(defaultCoaCodeForCategory("expense", "Tabungan & Investasi")),
    ).toBe("TRANSFER");
    for (const name of ["Makan", "Gaji", "Investasi", "Zzz"]) {
      expect(directionOf(defaultCoaCodeForCategory("expense", name))).not.toBe(
        "INCOME",
      );
    }
  });
});
