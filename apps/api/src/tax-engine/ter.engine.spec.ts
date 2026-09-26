import {
  TerNotApplicableError,
  terCategoryFor,
  terMonthly,
  terYear,
} from "./ter.engine";

import type { TaxStatus } from "./ptkp";

const J = 1_000_000n;
const st = (
  maritalStatus: TaxStatus["maritalStatus"],
  dependents: number,
): TaxStatus => ({ maritalStatus, dependents });
const twelve = (v: bigint) => Array.from({ length: 12 }, () => v);

describe("terCategoryFor", () => {
  it.each([
    ["TK", 0, "A"],
    ["TK", 1, "A"],
    ["TK", 2, "B"],
    ["TK", 3, "B"],
    ["K", 0, "A"],
    ["K", 1, "B"],
    ["K", 2, "B"],
    ["K", 3, "C"],
    ["KI", 0, "A"],
    ["KI", 1, "B"],
    ["KI", 2, "B"],
    ["KI", 3, "C"],
  ] as const)("%s/%i → %s", (m, d, cat) => {
    expect(terCategoryFor(st(m, d), "2026-01-01").category).toBe(cat);
  });
});

describe("terMonthly — category edges (inclusive upper bounds)", () => {
  it.each([
    [st("TK", 0), 5_400_000n, 0, 0n],
    [st("TK", 0), 5_400_001n, 25, 13_500n],
    [st("TK", 0), 1_400_000_000n, 3300, 462_000_000n],
    [st("TK", 0), 1_400_000_001n, 3400, 476_000_000n],
    [st("K", 1), 6_200_000n, 0, 0n],
    [st("K", 1), 6_200_001n, 25, 15_500n],
    [st("K", 1), 1_405_000_000n, 3300, 463_650_000n],
    [st("K", 1), 1_405_000_001n, 3400, 477_700_000n],
    [st("K", 3), 6_600_000n, 0, 0n],
    [st("K", 3), 6_600_001n, 25, 16_500n],
    [st("K", 3), 1_419_000_000n, 3300, 468_270_000n],
    [st("K", 3), 1_419_000_001n, 3400, 482_460_000n],
  ])(
    "%o gross %s → %i bps = %s",
    (status, monthlyGross, rateBps, withholding) => {
      expect(
        terMonthly({ taxYear: 2026, month: 5, status, monthlyGross }),
      ).toMatchObject({ rateBps, withholding });
    },
  );

  it("is not applicable before 2024", () => {
    expect(() =>
      terMonthly({
        taxYear: 2023,
        month: 1,
        status: st("TK", 0),
        monthlyGross: 10n * J,
      }),
    ).toThrow(TerNotApplicableError);
  });
});

describe("terYear — December true-up", () => {
  const noPension = twelve(0n);

  it("K/1 10jt × 12 → 150.000/month, December 900.000", () => {
    const r = terYear({
      taxYear: 2026,
      status: st("K", 1),
      monthlyGross: twelve(10n * J),
      monthlyPension: noPension,
      zakat: 0n,
      dtp: null,
    });
    expect(r.months[0]).toMatchObject({
      category: "B",
      rateBps: 150,
      withholding: 150_000n,
    });
    expect(r).toMatchObject({
      withheldJanNov: 1_650_000n,
      annualTax: 2_550_000n,
      december: 900_000n,
      isRefund: false,
    });
    expect(r.months[11]).toMatchObject({
      rateBps: null,
      withholding: 900_000n,
    });
  });

  it("employee pension (300rb/month) lowers the true-up to 720.000", () => {
    const r = terYear({
      taxYear: 2026,
      status: st("K", 1),
      monthlyGross: twelve(10n * J),
      monthlyPension: twelve(300_000n),
      zakat: 0n,
      dtp: null,
    });
    expect(r).toMatchObject({ annualTax: 2_370_000n, december: 720_000n });
  });

  it("January bonus over-withholds → December refund −2.000.000", () => {
    const gross = [50n * J, ...Array.from({ length: 11 }, () => 10n * J)];
    const r = terYear({
      taxYear: 2026,
      status: st("TK", 0),
      monthlyGross: gross,
      monthlyPension: noPension,
      zakat: 0n,
      dtp: null,
    });
    expect(r.months[0]).toMatchObject({
      rateBps: 1800,
      withholding: 9_000_000n,
    });
    expect(r.months[1]).toMatchObject({ rateBps: 200, withholding: 200_000n });
    expect(r).toMatchObject({
      withheldJanNov: 11_000_000n,
      annualTax: 9_000_000n,
      december: -2_000_000n,
      isRefund: true,
    });
  });

  it("requires exactly 12 months", () => {
    expect(() =>
      terYear({
        taxYear: 2026,
        status: st("TK", 0),
        monthlyGross: [1n],
        monthlyPension: noPension,
        zakat: 0n,
        dtp: null,
      }),
    ).toThrow(RangeError);
  });

  it("DTP-eligible months carry the TER amount; December uses max(true-up, 0)", () => {
    const r = terYear({
      taxYear: 2026,
      status: st("TK", 0),
      monthlyGross: twelve(10n * J),
      monthlyPension: noPension,
      zakat: 0n,
      dtp: {
        sector: "tekstil_pakaian",
        employment: "permanent",
        dailyWage: null,
        nikValidated: true,
      },
    });
    expect(r.months[2]?.dtp).toEqual({
      eligible: true,
      reasons: [],
      amount: 200_000n,
    });
    expect(r.months[11]?.dtp?.amount).toBe(r.december > 0n ? r.december : 0n);
    expect(r.dtpTotal).toBe(
      11n * 200_000n + (r.december > 0n ? r.december : 0n),
    );
  });
});
