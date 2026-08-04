/**
 * EPIC-022 B1 — the real balance-sheet identity: Total Assets should equal
 * Total Liabilities + Equity (net worth). The /laporan UI must never
 * re-display `totalAssets` on both sides of the table and must only claim
 * "balanced" when the two sides actually match.
 *
 * This file replaces the legacy `apps/web/src/lib/__tests__/laporan-utils.
 * test.mjs`, which ran via `node --test` only and was not part of any gate
 * script (`scripts/test.sh` runs `turbo run test`, i.e. Jest) — plus it had
 * a hand-maintained `laporan-utils.js` CJS mirror of this module that Jest's
 * default extension resolution (`.js` before `.ts`) would silently prefer
 * over the real TS source for any bare `./laporan-utils` import, so any new
 * export added only to the `.ts` file (like `computeBalanceSheetIdentity`
 * and `formatSignedRupiah` below) would appear "not a function" under Jest.
 * Both the stale mirror and the dead `.mjs` suite have been removed; this
 * file carries the same coverage for the pre-existing exports plus the new
 * EPIC-022 additions, and is the one Jest actually runs.
 */

import {
  balanceSheetToWealthAlloc,
  buildInvChartData,
  categoryBreakdownToDonut,
  computeBalanceSheetIdentity,
  formatJuta,
  formatSignedRupiah,
  getMonthDateRange,
  getTodayDateRange,
  sankeyToFlowBars,
  txTypeToBadgeVariant,
} from "./laporan-utils";

describe("computeBalanceSheetIdentity", () => {
  it("reports balanced when Assets == Liabilities + Equity", () => {
    const result = computeBalanceSheetIdentity({
      totalAssets: 1_000_000,
      totalLiabilities: 200_000,
      netWorth: 800_000,
    });
    expect(result.totalLiabilitiesPlusEquity).toBe(1_000_000);
    expect(result.diff).toBe(0);
    expect(result.isBalanced).toBe(true);
  });

  it("never re-displays totalAssets as the right-hand side — it derives from liabilities + netWorth", () => {
    // netWorth deliberately inconsistent with totalAssets - totalLiabilities,
    // simulating a future data inconsistency the UI must be able to catch
    // rather than silently reflecting totalAssets back at itself.
    const result = computeBalanceSheetIdentity({
      totalAssets: 1_000_000,
      totalLiabilities: 200_000,
      netWorth: 750_000, // should have been 800_000
    });
    expect(result.totalLiabilitiesPlusEquity).toBe(950_000);
    expect(result.diff).toBe(50_000);
    expect(result.isBalanced).toBe(false);
  });

  it("treats a sub-1-rupiah rounding slack as still balanced", () => {
    const result = computeBalanceSheetIdentity({
      totalAssets: 1_000_000,
      totalLiabilities: 200_000,
      netWorth: 800_000.4,
    });
    expect(result.isBalanced).toBe(true);
  });

  it("discloses the real discrepancy amount when out of balance", () => {
    const result = computeBalanceSheetIdentity({
      totalAssets: 500_000,
      totalLiabilities: 100_000,
      netWorth: 300_000, // 100k short of matching totalAssets
    });
    expect(result.diff).toBe(100_000);
    expect(result.isBalanced).toBe(false);
  });

  it("holds for the zero-data (fresh family group) case", () => {
    const result = computeBalanceSheetIdentity({
      totalAssets: 0,
      totalLiabilities: 0,
      netWorth: 0,
    });
    expect(result.isBalanced).toBe(true);
    expect(result.diff).toBe(0);
  });
});

// EPIC-022 B2 — a negative cashflow figure must render with a real minus
// sign, not `Math.abs()`'d down to a bare positive distinguished only by
// colour.
describe("formatSignedRupiah", () => {
  it("prefixes a positive amount with a real plus sign", () => {
    expect(formatSignedRupiah(1_500_000)).toBe("+Rp 1.500.000");
  });

  it("prefixes a negative amount with a real minus sign — never Math.abs()'d to a bare positive", () => {
    expect(formatSignedRupiah(-1_500_000)).toBe("-Rp 1.500.000");
  });

  it("treats zero as non-negative (a real plus sign, not a minus)", () => {
    expect(formatSignedRupiah(0)).toBe("+Rp 0");
  });

  it("never returns the same string for a value and its negation", () => {
    const positive = formatSignedRupiah(750_000);
    const negative = formatSignedRupiah(-750_000);
    expect(positive).not.toBe(negative);
    // The magnitude portion (everything after the leading sign) must be
    // identical — only the sign differs.
    expect(positive.slice(1)).toBe(negative.slice(1));
  });
});

describe("categoryBreakdownToDonut", () => {
  it("returns empty array for empty input", () => {
    expect(categoryBreakdownToDonut([])).toEqual([]);
  });

  it("maps category breakdown to donut segments", () => {
    const items = [
      {
        categoryName: "Gaji",
        amount: 18_000_000,
        percentage: 70,
        color: "#10B981",
      },
      {
        categoryName: "Dividen",
        amount: 5_000_000,
        percentage: 20,
        color: null,
      },
      {
        categoryName: "Lainnya",
        amount: 2_000_000,
        percentage: 10,
        color: null,
      },
    ];
    const result = categoryBreakdownToDonut(items);
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      label: "Gaji",
      value: 70,
      color: "#10B981",
    });
    expect(result[1]!.label).toBe("Dividen");
    expect(typeof result[1]!.color).toBe("string");
  });

  it("skips items with percentage=0", () => {
    const items = [
      { categoryName: "Gaji", amount: 0, percentage: 0, color: null },
      {
        categoryName: "Aktif",
        amount: 5_000_000,
        percentage: 100,
        color: "#4F46E5",
      },
    ];
    const result = categoryBreakdownToDonut(items);
    expect(result).toHaveLength(1);
    expect(result[0]!.label).toBe("Aktif");
  });
});

describe("txTypeToBadgeVariant", () => {
  it("income returns success", () => {
    expect(txTypeToBadgeVariant("income")).toBe("success");
  });

  it("expense returns danger", () => {
    expect(txTypeToBadgeVariant("expense")).toBe("danger");
  });

  it("transfer returns info", () => {
    expect(txTypeToBadgeVariant("transfer")).toBe("info");
  });

  it("unknown returns info", () => {
    expect(txTypeToBadgeVariant("unknown")).toBe("info");
  });
});

describe("formatJuta", () => {
  it("formats millions correctly", () => {
    expect(formatJuta(18_000_000)).toBe("18 jt");
  });

  it("formats with decimal", () => {
    expect(formatJuta(5_150_000)).toBe("5,15 jt");
  });

  it("formats below 1 million", () => {
    expect(formatJuta(500_000)).toBe("0,5 jt");
  });

  it("formats zero", () => {
    expect(formatJuta(0)).toBe("0 jt");
  });
});

describe("sankeyToFlowBars", () => {
  it("returns empty array for empty nodes", () => {
    expect(sankeyToFlowBars({ nodes: [], links: [] }, "income")).toEqual([]);
  });

  it("extracts income nodes with widthPct", () => {
    const data = {
      nodes: [
        { id: "inc1", label: "Gaji" },
        { id: "exp1", label: "Makan" },
      ],
      links: [{ source: "inc1", target: "exp1", value: 18_000_000 }],
    };
    const result = sankeyToFlowBars(data, "income");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      label: "Gaji",
      amount: 18_000_000,
      widthPct: 100,
    });
  });

  it("extracts expense nodes with widthPct relative to max", () => {
    const data = {
      nodes: [
        { id: "inc1", label: "Gaji" },
        { id: "exp1", label: "Makan" },
        { id: "exp2", label: "Transport" },
      ],
      links: [
        { source: "inc1", target: "exp1", value: 8_000_000 },
        { source: "inc1", target: "exp2", value: 2_000_000 },
      ],
    };
    const result = sankeyToFlowBars(data, "expense");
    const makan = result.find((r) => r.label === "Makan");
    const transport = result.find((r) => r.label === "Transport");
    expect(makan?.widthPct).toBe(100);
    expect(transport?.widthPct).toBe(25);
  });
});

describe("getMonthDateRange", () => {
  it("returns startDate and endDate as ISO strings, start <= end", () => {
    const { startDate, endDate } = getMonthDateRange();
    expect(new Date(startDate).getTime()).toBeLessThanOrEqual(
      new Date(endDate).getTime(),
    );
  });

  it("startDate is the first day of the current month", () => {
    const { startDate } = getMonthDateRange();
    expect(new Date(startDate).getDate()).toBe(1);
  });
});

describe("getTodayDateRange", () => {
  it("returns startDate and endDate spanning exactly today", () => {
    const { startDate, endDate } = getTodayDateRange();
    const now = new Date();
    expect(new Date(startDate).getDate()).toBe(now.getDate());
    expect(new Date(endDate).getDate()).toBe(now.getDate());
    expect(new Date(startDate).getTime()).toBeLessThanOrEqual(
      new Date(endDate).getTime(),
    );
  });
});

describe("buildInvChartData", () => {
  it("returns null when summary is undefined", () => {
    expect(buildInvChartData(undefined)).toBeNull();
  });

  it("returns null when both nilai and modal are zero", () => {
    expect(
      buildInvChartData({ totalCostBasis: "0", totalCurrentValue: "0" }),
    ).toBeNull();
  });

  it("nilaiPct is 100 when nilai equals modal (breakeven)", () => {
    const result = buildInvChartData({
      totalCostBasis: "10000000",
      totalCurrentValue: "10000000",
    });
    expect(result).toMatchObject({
      nilaiPct: 100,
      modalPct: 100,
      hasReturn: true,
    });
  });

  it("nilaiPct 100, modalPct < 100 when nilai > modal (profit)", () => {
    const result = buildInvChartData({
      totalCostBasis: "8000000",
      totalCurrentValue: "10000000",
    });
    expect(result).toMatchObject({
      nilaiPct: 100,
      modalPct: 80,
      hasReturn: true,
    });
  });

  it("modalPct 100, nilaiPct < 100 when nilai < modal (loss)", () => {
    const result = buildInvChartData({
      totalCostBasis: "10000000",
      totalCurrentValue: "7000000",
    });
    expect(result).toMatchObject({
      modalPct: 100,
      nilaiPct: 70,
      hasReturn: false,
    });
  });

  it("pct values are integers (rounded)", () => {
    const result = buildInvChartData({
      totalCostBasis: "3000000",
      totalCurrentValue: "10000000",
    });
    expect(result!.nilaiPct % 1).toBe(0);
    expect(result!.modalPct % 1).toBe(0);
  });
});

describe("balanceSheetToWealthAlloc", () => {
  it("returns empty array when totalAssets is 0", () => {
    const assets = [{ category: "Kas", amount: 0, items: [] }];
    expect(balanceSheetToWealthAlloc(assets, 0)).toEqual([]);
  });

  it("returns empty array for empty assets", () => {
    expect(balanceSheetToWealthAlloc([], 100)).toEqual([]);
  });

  it("filters out zero-amount categories", () => {
    const assets = [
      { category: "Kas", amount: 0, items: [] },
      { category: "Investasi", amount: 5_000_000, items: [] },
    ];
    const result = balanceSheetToWealthAlloc(assets, 5_000_000);
    expect(result).toHaveLength(1);
    expect(result[0]!.label).toBe("Investasi");
  });

  it("computes percentage relative to totalAssets", () => {
    const assets = [
      { category: "Kas", amount: 3_000_000, items: [] },
      { category: "Investasi", amount: 7_000_000, items: [] },
    ];
    const result = balanceSheetToWealthAlloc(assets, 10_000_000);
    expect(result.find((r) => r.label === "Kas")?.value).toBe(30);
    expect(result.find((r) => r.label === "Investasi")?.value).toBe(70);
  });

  it("sum of values is 100 for a full balance sheet", () => {
    const assets = [
      { category: "Kas", amount: 2_000_000, items: [] },
      { category: "Investasi", amount: 5_000_000, items: [] },
      { category: "Properti", amount: 3_000_000, items: [] },
    ];
    const result = balanceSheetToWealthAlloc(assets, 10_000_000);
    expect(result.reduce((acc, s) => acc + s.value, 0)).toBe(100);
  });

  it("sorts segments descending by value", () => {
    const assets = [
      { category: "Kas", amount: 1_000_000, items: [] },
      { category: "Investasi", amount: 8_000_000, items: [] },
      { category: "Properti", amount: 1_000_000, items: [] },
    ];
    const result = balanceSheetToWealthAlloc(assets, 10_000_000);
    expect(result[0]!.label).toBe("Investasi");
    expect(result[0]!.value).toBeGreaterThanOrEqual(result[1]!.value);
    expect(result[1]!.value).toBeGreaterThanOrEqual(result[2]!.value);
  });
});
