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

  // EPIC-023 Task A1 — groups 4 (Account Receivable) and 5 (Account Payable)
  // are internal balance-sheet movements (a claim owed to/by the family), not
  // real revenue/expense: they must be shelved as TRANSFER so reports never
  // count a loan disbursement as income or a principal repayment as an
  // expense (decision D23 — fix the chart, not the reports engine).
  it("classifies every group-4 (Account Receivable) account as TRANSFER, not INCOME", () => {
    const group4 = GENERIC_COA_CHART.filter((c) => c.groupNum === 4);
    expect(group4.length).toBeGreaterThan(0);
    for (const account of group4) {
      expect(account.direction).toBe("TRANSFER");
    }
  });

  it("classifies every group-5 (Account Payable) account as TRANSFER, not EXPENSE", () => {
    const group5 = GENERIC_COA_CHART.filter((c) => c.groupNum === 5);
    expect(group5.length).toBeGreaterThan(0);
    for (const account of group5) {
      expect(account.direction).toBe("TRANSFER");
    }
  });

  // EPIC-023 Task A2 — the interest portion of a liability payment IS a real
  // expense (unlike the principal, which nets against the group-5 TRANSFER
  // liability account above).
  it("has a group-2 loan-interest EXPENSE account at code 20009 (Bunga Pinjaman)", () => {
    const entry = GENERIC_COA_CHART.find((c) => c.code === "20009");
    expect(entry).toBeDefined();
    expect(entry?.name).toBe("Bunga Pinjaman");
    expect(entry?.groupNum).toBe(2);
    expect(entry?.direction).toBe("EXPENSE");
  });
});
