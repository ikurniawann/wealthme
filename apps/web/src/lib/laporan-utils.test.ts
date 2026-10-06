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
  investmentCurrentValue,
  sankeyToFlowBars,
  txTypeToBadgeVariant,
} from "./laporan-utils";

// EPIC-022 B9 (CRITICAL fix) — inv.currentValue from the API is already the
// TOTAL position value (investments.service.ts: currentPrice.times(quantity)),
// never per-unit. Multiplying it by quantity again — the pre-fix bug at both
// /laporan call sites — computed price × quantity², inflating every priced
// holding by a factor of its own share count. These cases use quantity > 1
// specifically because the bug is invisible whenever quantity === 1.
describe("investmentCurrentValue", () => {
  it("uses currentValue as-is when present — does NOT multiply by quantity again", () => {
    // 500 shares, market price implies a Rp 5.000.000 total position — the
    // API already returns that total in currentValue.
    const result = investmentCurrentValue({
      currentValue: "5000000",
      costBasisPerUnit: "9000",
      quantity: "500",
    });
    expect(result).toBe(5_000_000);
    // The exact regression this test guards against: the old formula
    // (`parseFloat(currentValue) * parseFloat(quantity)`) would have
    // returned 2.500.000.000 (2,5 billion / 2,5 miliar) here — 500× too
    // large, one multiplication by `quantity` more than correct.
    expect(result).not.toBe(5_000_000 * 500);
  });

  it("multiplies costBasisPerUnit by quantity only in the fallback (no price recorded yet)", () => {
    const result = investmentCurrentValue({
      currentValue: null,
      costBasisPerUnit: "9500",
      quantity: "10",
    });
    expect(result).toBe(95_000);
  });

  it("matches the API's own getSummary basis for a priced holding with quantity > 1", () => {
    // Mirrors apps/api/src/investments/investments.service.spec.ts's
    // fixture: inv-1 currentValue = 10000 * 10 = 100_000.
    const result = investmentCurrentValue({
      currentValue: "100000",
      costBasisPerUnit: "9500",
      quantity: "10",
    });
    expect(result).toBe(100_000);
  });

  it("a quantity=1 holding cannot distinguish the bug — confirms the fix is not a no-op for quantity>1", () => {
    const qty1 = investmentCurrentValue({
      currentValue: "10000",
      costBasisPerUnit: "9000",
      quantity: "1",
    });
    const qty500 = investmentCurrentValue({
      currentValue: "10000",
      costBasisPerUnit: "9000",
      quantity: "500",
    });
    // Same currentValue, different quantity — the correct result ignores
    // quantity entirely once currentValue is present, so both must be equal.
    expect(qty1).toBe(10_000);
    expect(qty500).toBe(10_000);
  });
});

// EPIC-022 B1 — hardened TWICE per adversarial review. Round 1 compared
// `totalAssets` against `totalLiabilities + netWorth` (unfalsifiable: the
// API defines netWorth as their difference in the same payload). Round 2
// compared the reported totalAssets/totalLiabilities scalars against a
// client-side sum of their own assets[]/liabilities[] breakdown arrays —
// STILL unfalsifiable, because reports.service.ts builds those very
// scalars *by* summing the same arrays (`totalAssets = assets.reduce(...)`)
// — re-summing on the client is the same computation twice. This round
// compares against a genuinely different source: the dashboard's
// independently computed net worth (a different service, a different
// query path). Every "imbalanced" case below is a payload the function
// must be able to reject; the "does NOT reconcile via ..." cases prove the
// two prior (removed) checks are actually gone.
describe("computeBalanceSheetIdentity", () => {
  it("reports balanced when the two independently-computed net worths agree", () => {
    const result = computeBalanceSheetIdentity(
      { totalLiabilities: 200_000, netWorth: 800_000 },
      { netWorth: "800000" },
    );
    expect(result.totalLiabilitiesPlusEquity).toBe(1_000_000);
    expect(result.dashboardNetWorth).toBe(800_000);
    expect(result.diff).toBe(0);
    expect(result.isBalanced).toBe(true);
  });

  it("is falsifiable: reports imbalanced when the dashboard's independently computed net worth disagrees", () => {
    // The exact bar the adversarial review set (twice): construct input
    // data that makes this report an imbalance. This is the real defect
    // class it now catches — e.g. the balance sheet omitting a whole asset
    // class (investments) that the dashboard's separate query includes.
    const result = computeBalanceSheetIdentity(
      { totalLiabilities: 200_000, netWorth: 800_000 },
      { netWorth: "1300000" }, // dashboard includes Rp 500.000 the balance sheet is missing
    );
    expect(result.dashboardNetWorth).toBe(1_300_000);
    expect(result.diff).toBe(-500_000);
    expect(result.isBalanced).toBe(false);
  });

  it("does NOT reconcile via the totalAssets = totalLiabilities + netWorth identity — that check is gone", () => {
    // Round-1's removed check would have called this "balanced" purely
    // because netWorth was internally consistent — irrelevant here, since
    // this function no longer even accepts totalAssets as input.
    const result = computeBalanceSheetIdentity(
      { totalLiabilities: 200_000, netWorth: 800_000 }, // totalAssets would be 1_000_000
      { netWorth: "50000" }, // but the dashboard says net worth is only 50.000
    );
    expect(result.isBalanced).toBe(false);
  });

  it("does NOT reconcile via re-summing a breakdown array — that check is gone too", () => {
    // Round-2's removed check took an `assets`/`liabilities` array; this
    // function's type no longer accepts one at all, proving the tautology
    // was actually removed, not just hidden behind an unused parameter.
    const result = computeBalanceSheetIdentity(
      { totalLiabilities: 200_000, netWorth: 800_000 },
      { netWorth: "800000" },
    );
    expect(result).not.toHaveProperty("assetsBreakdownSum");
    expect(result).not.toHaveProperty("assetsDiff");
    expect(result.isBalanced).toBe(true);
  });

  it("treats a sub-1-rupiah rounding slack as still balanced", () => {
    const result = computeBalanceSheetIdentity(
      { totalLiabilities: 200_000, netWorth: 800_000 },
      { netWorth: "800000.4" },
    );
    expect(result.isBalanced).toBe(true);
  });

  it("reports isBalanced as null (not false) while the dashboard figure is unavailable — no claim until both numbers are in hand", () => {
    const pending = computeBalanceSheetIdentity(
      { totalLiabilities: 200_000, netWorth: 800_000 },
      undefined,
    );
    expect(pending.isBalanced).toBeNull();
    expect(pending.dashboardNetWorth).toBeNull();
    // The "Total L+E" row is still computed even while the check is pending.
    expect(pending.totalLiabilitiesPlusEquity).toBe(1_000_000);

    const alsoPending = computeBalanceSheetIdentity(
      { totalLiabilities: 200_000, netWorth: 800_000 },
      null,
    );
    expect(alsoPending.isBalanced).toBeNull();
  });

  it("holds for the zero-data (fresh family group) case", () => {
    const result = computeBalanceSheetIdentity(
      { totalLiabilities: 0, netWorth: 0 },
      { netWorth: "0" },
    );
    expect(result.isBalanced).toBe(true);
    expect(result.diff).toBe(0);
  });
});

// EPIC-022 B2 — a negative cashflow figure must render with a real minus
// sign, not `Math.abs()`'d down to a bare positive distinguished only by
// colour.
describe("formatSignedRupiah", () => {
  it("prefixes a positive amount with a real plus sign", () => {
    expect(formatSignedRupiah(1_500_000)).toBe("+Rp\u00A01.500.000");
  });

  it("prefixes a negative amount with a real minus sign — never Math.abs()'d to a bare positive", () => {
    expect(formatSignedRupiah(-1_500_000)).toBe("-Rp\u00A01.500.000");
  });

  it("treats zero as non-negative (a real plus sign, not a minus)", () => {
    expect(formatSignedRupiah(0)).toBe("+Rp\u00A00");
  });

  it("never returns the same string for a value and its negation", () => {
    const positive = formatSignedRupiah(750_000);
    const negative = formatSignedRupiah(-750_000);
    expect(positive).not.toBe(negative);
    // The magnitude portion (everything after the leading sign) must be
    // identical — only the sign differs.
    expect(positive.slice(1)).toBe(negative.slice(1));
  });

  it("C5: routes through a custom formatter (e.g. useMoney().format) instead of always IDR", () => {
    const usdFormat = (idr: number) => `≈ $${(idr / 15000).toFixed(2)}`;
    expect(formatSignedRupiah(1_500_000, usdFormat)).toBe("+≈ $100.00");
    expect(formatSignedRupiah(-1_500_000, usdFormat)).toBe("-≈ $100.00");
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
