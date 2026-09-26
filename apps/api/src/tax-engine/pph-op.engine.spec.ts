import { computeLegacyNetTax, computePphOp, pasal17Tax } from "./pph-op.engine";
import { ptkpFor } from "./ptkp";

import type { PphOpInput } from "./pph-op.engine";

const J = 1_000_000n;
const base = (o: Partial<PphOpInput>): PphOpInput => ({
  taxYear: 2026,
  status: { maritalStatus: "TK", dependents: 0 },
  employmentGross: 0n,
  pensionContribution: 0n,
  freelance: null,
  otherNetIncome: 0n,
  zakat: 0n,
  withheldPph21: 0n,
  ...o,
});

describe("ptkpFor — all 12 combinations", () => {
  it.each([
    ["TK", 0, 54_000_000n],
    ["TK", 1, 58_500_000n],
    ["TK", 2, 63_000_000n],
    ["TK", 3, 67_500_000n],
    ["K", 0, 58_500_000n],
    ["K", 1, 63_000_000n],
    ["K", 2, 67_500_000n],
    ["K", 3, 72_000_000n],
    ["KI", 0, 112_500_000n],
    ["KI", 1, 117_000_000n],
    ["KI", 2, 121_500_000n],
    ["KI", 3, 126_000_000n],
  ] as const)("%s/%i → %s", (maritalStatus, dependents, expected) => {
    expect(ptkpFor({ maritalStatus, dependents }, "2026-12-31").ptkp).toBe(
      expected,
    );
  });
  it("rejects 4 dependents instead of capping", () => {
    expect(() =>
      ptkpFor({ maritalStatus: "K", dependents: 4 }, "2026-12-31"),
    ).toThrow(RangeError);
  });
});

describe("pasal17Tax — bracket boundaries", () => {
  it.each([
    [60_000_000n, 3_000_000n],
    [60_001_000n, 3_000_150n],
    [250_000_000n, 31_500_000n],
    [500_000_000n, 94_000_000n],
    [5_000_000_000n, 1_444_000_000n],
    [5_000_001_000n, 1_444_000_350n],
    [0n, 0n],
  ])("PKP %s → %s", (pkp, tax) => {
    expect(pasal17Tax(pkp, "2026-12-31").tax).toBe(tax);
  });
  it("splits exactly at 60jt into one 5% band", () => {
    expect(pasal17Tax(60_000_000n, "2026-12-31").brackets).toEqual([
      {
        from: 0n,
        upTo: 60_000_000n,
        rateBps: 500,
        label: "0 – 60 Juta",
        taxable: 60_000_000n,
        tax: 3_000_000n,
      },
    ]);
  });
});

describe("computePphOp", () => {
  it("employee K/1 120jt, pension 3,6jt, zakat 2,5jt → PKP 44,9jt, tax 2.245.000", () => {
    const r = computePphOp(
      base({
        status: { maritalStatus: "K", dependents: 1 },
        employmentGross: 120n * J,
        pensionContribution: 3_600_000n,
        zakat: 2_500_000n,
        withheldPph21: 2_000_000n,
      }),
    );
    expect(r).toMatchObject({
      ptkp: 63_000_000n,
      biayaJabatan: 6_000_000n,
      pensionDeduction: 3_600_000n,
      neto: 110_400_000n,
      zakatApplied: 2_500_000n,
      pkp: 44_900_000n,
      tax: 2_245_000n,
      withheld: 2_000_000n,
      balance: 245_000n,
    });
    expect(r.rules.map((x) => x.key)).toEqual(
      expect.arrayContaining([
        "pph.pasal17",
        "pph.ptkp",
        "pph.biayaJabatan",
        "pph.pkpRounding",
        "pph.zakat",
      ]),
    );
  });

  it("zakat is capped at neto: 50jt TK/0 with 100jt zakat → zakatApplied 47,5jt, tax 0", () => {
    const r = computePphOp(base({ employmentGross: 50n * J, zakat: 100n * J }));
    expect(r).toMatchObject({
      neto: 47_500_000n,
      zakatApplied: 47_500_000n,
      pkp: 0n,
      tax: 0n,
    });
  });

  it("NPPN freelancer: 600jt omzet × 50% → neto 300jt, PKP 246jt, tax 30.900.000, no biaya jabatan", () => {
    const r = computePphOp(
      base({ freelance: { gross: 600n * J, nppnBps: 5000 } }),
    );
    expect(r).toMatchObject({
      biayaJabatan: 0n,
      freelanceNet: 300n * J,
      pkp: 246n * J,
      tax: 30_900_000n,
    });
    expect(r.rules.map((x) => x.key)).toContain("pph.nppn");
  });

  it("keeps fractional biaya jabatan exact: 61.234.567 → bj 3.061.728 (display), PKP 4.172.000, tax 208.600", () => {
    const r = computePphOp(base({ employmentGross: 61_234_567n }));
    expect(r).toMatchObject({
      biayaJabatanHundredths: 306_172_835n,
      biayaJabatan: 3_061_728n,
      pkp: 4_172_000n,
      tax: 208_600n,
    });
  });

  it("overpaid withholding yields a negative balance (lebih bayar)", () => {
    const r = computePphOp(
      base({ employmentGross: 60n * J, withheldPph21: 500_000n }),
    );
    expect(r.tax).toBe(150_000n);
    expect(r.balance).toBe(-350_000n);
  });

  it("pension deduction never drives employment neto below zero", () => {
    const r = computePphOp(
      base({ employmentGross: 10n * J, pensionContribution: 50n * J }),
    );
    expect(r.pensionDeduction).toBe(9_500_000n);
    expect(r.neto).toBe(0n);
  });

  it("rejects NPPN outside 1..10000 bps", () => {
    expect(() =>
      computePphOp(base({ freelance: { gross: J, nppnBps: 0 } })),
    ).toThrow(RangeError);
  });

  it("tax year 2019 uses the HPP brackets but flags outOfRange", () => {
    const r = computePphOp(base({ taxYear: 2019, employmentGross: 120n * J }));
    expect(r.rules.find((x) => x.key === "pph.pasal17")?.outOfRange).toBe(true);
  });
});

describe("computeLegacyNetTax", () => {
  it("matches the legacy formula with a stored PTKP", () => {
    expect(computeLegacyNetTax(120n * J, 63n * J, 2_500_000n, 2024)).toBe(
      2_425_000n,
    );
  });
});
