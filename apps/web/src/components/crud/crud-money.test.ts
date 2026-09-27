import { TEST_FX_RATES } from "@/components/money/fx-test-rates";

import { CRUD_CONFIG } from "./crud-config";
import { normalizeCrudMoney, withCrudFx } from "./crud-money";

describe("normalizeCrudMoney — revisi I", () => {
  const fields = CRUD_CONFIG.cash.fields;

  it("leaves IDR values byte-identical", () => {
    const values = { nama: "Kas", saldo: "-250.000", ownerUserId: "" };
    const out = normalizeCrudMoney(fields, values, undefined, "IDR");
    expect(out).toEqual({ values, pending: false });
    expect(out.values).toBe(values);
  });

  it("rewrites a foreign amount to its IDR preview and records the original", () => {
    const out = normalizeCrudMoney(
      fields,
      { nama: "Dompet", saldo: "-20", saldo__currency: "USD", ownerUserId: "" },
      TEST_FX_RATES,
      "IDR",
    );
    expect(out.pending).toBe(false);
    expect(out.values.saldo).toBe("-358.278");
    expect(JSON.parse(out.values.saldo__fx ?? "")).toEqual({
      currency: "USD",
      amount: "-20",
    });
  });

  it("is pending when a foreign rate is not loaded", () => {
    expect(
      normalizeCrudMoney(
        fields,
        { nama: "D", saldo: "5", saldo__currency: "USD" },
        undefined,
        "IDR",
      ).pending,
    ).toBe(true);
  });

  it("an amount with no __currency key uses the fallback (a USD-display user's add form)", () => {
    const out = normalizeCrudMoney(
      fields,
      { nama: "D", saldo: "100" },
      TEST_FX_RATES,
      "USD",
    );
    expect(out.values.saldo).toBe("1.791.390");
    expect(JSON.parse(out.values.saldo__fx ?? "")).toEqual({
      currency: "USD",
      amount: "100",
    });
  });

  it("edit mode's IDR fallback leaves an untouched prefill byte-identical for a USD-display user", () => {
    const values = { nama: "D", saldo: "1.791.390" };
    expect(
      normalizeCrudMoney(fields, values, TEST_FX_RATES, "IDR").values,
    ).toBe(values);
  });
});

describe("withCrudFx — revisi I", () => {
  it("returns the same body when nothing is foreign", () => {
    const body = { balance: 5 };
    expect(withCrudFx(body, { saldo: "5" }, { saldo: "balance" })).toBe(body);
  });

  it("maps one form key to one or more API fields", () => {
    const values = {
      total: "1.791.390",
      total__fx: JSON.stringify({ currency: "USD", amount: "100.00" }),
    };
    expect(
      withCrudFx({ totalDebt: "1791390" }, values, {
        total: ["totalDebt", "remainingBalance"],
      }),
    ).toEqual({
      totalDebt: "1791390",
      fxInputs: [
        { field: "totalDebt", currency: "USD", amount: "100.00" },
        { field: "remainingBalance", currency: "USD", amount: "100.00" },
      ],
    });
  });
});
