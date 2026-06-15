import { test, describe } from "node:test";
import assert from "node:assert/strict";

const mod = await import("../laporan-utils.js").catch(() => ({}));
const {
  categoryBreakdownToDonut,
  txTypeToBadgeVariant,
  sankeyToFlowBars,
  formatJuta,
  getMonthDateRange,
  getTodayDateRange,
  buildInvChartData,
} = mod;

describe("categoryBreakdownToDonut", () => {
  test("exported as a function", () => {
    assert.strictEqual(
      typeof categoryBreakdownToDonut,
      "function",
      "categoryBreakdownToDonut must be exported from laporan-utils",
    );
  });

  test("returns empty array for empty input", () => {
    assert.deepStrictEqual(categoryBreakdownToDonut([]), []);
  });

  test("maps category breakdown to donut segments", () => {
    const items = [
      {
        categoryName: "Gaji",
        amount: 18000000,
        percentage: 70,
        color: "#10B981",
      },
      { categoryName: "Dividen", amount: 5000000, percentage: 20, color: null },
      { categoryName: "Lainnya", amount: 2000000, percentage: 10, color: null },
    ];
    const result = categoryBreakdownToDonut(items);
    assert.equal(result.length, 3);
    assert.equal(result[0].label, "Gaji");
    assert.equal(result[0].value, 70);
    assert.equal(result[0].color, "#10B981");
    assert.equal(result[1].label, "Dividen");
    assert.ok(typeof result[1].color === "string", "fallback color for null");
  });

  test("skips items with percentage=0", () => {
    const items = [
      { categoryName: "Gaji", amount: 0, percentage: 0, color: null },
      {
        categoryName: "Aktif",
        amount: 5000000,
        percentage: 100,
        color: "#4F46E5",
      },
    ];
    const result = categoryBreakdownToDonut(items);
    assert.equal(result.length, 1);
    assert.equal(result[0].label, "Aktif");
  });
});

describe("txTypeToBadgeVariant", () => {
  test("exported as a function", () => {
    assert.strictEqual(
      typeof txTypeToBadgeVariant,
      "function",
      "txTypeToBadgeVariant must be exported from laporan-utils",
    );
  });

  test("income returns success", () => {
    assert.equal(txTypeToBadgeVariant("income"), "success");
  });

  test("expense returns danger", () => {
    assert.equal(txTypeToBadgeVariant("expense"), "danger");
  });

  test("transfer returns info", () => {
    assert.equal(txTypeToBadgeVariant("transfer"), "info");
  });

  test("unknown returns info", () => {
    assert.equal(txTypeToBadgeVariant("unknown"), "info");
  });
});

describe("formatJuta", () => {
  test("exported as a function", () => {
    assert.strictEqual(
      typeof formatJuta,
      "function",
      "formatJuta must be exported from laporan-utils",
    );
  });

  test("formats millions correctly", () => {
    assert.equal(formatJuta(18000000), "18 jt");
  });

  test("formats with decimal", () => {
    assert.equal(formatJuta(5150000), "5,15 jt");
  });

  test("formats below 1 million", () => {
    assert.equal(formatJuta(500000), "0,5 jt");
  });

  test("formats zero", () => {
    assert.equal(formatJuta(0), "0 jt");
  });
});

describe("sankeyToFlowBars", () => {
  test("exported as a function", () => {
    assert.strictEqual(
      typeof sankeyToFlowBars,
      "function",
      "sankeyToFlowBars must be exported from laporan-utils",
    );
  });

  test("returns empty array for empty nodes", () => {
    const data = { nodes: [], links: [] };
    assert.deepStrictEqual(sankeyToFlowBars(data, "income"), []);
  });

  test("extracts income nodes with widthPct", () => {
    const data = {
      nodes: [
        { id: "inc1", label: "Gaji" },
        { id: "exp1", label: "Makan" },
      ],
      links: [{ source: "inc1", target: "exp1", value: 18000000 }],
    };
    const result = sankeyToFlowBars(data, "income");
    assert.equal(result.length, 1);
    assert.equal(result[0].label, "Gaji");
    assert.equal(result[0].amount, 18000000);
    assert.equal(result[0].widthPct, 100);
  });

  test("extracts expense nodes with widthPct relative to max", () => {
    const data = {
      nodes: [
        { id: "inc1", label: "Gaji" },
        { id: "exp1", label: "Makan" },
        { id: "exp2", label: "Transport" },
      ],
      links: [
        { source: "inc1", target: "exp1", value: 8000000 },
        { source: "inc1", target: "exp2", value: 2000000 },
      ],
    };
    const result = sankeyToFlowBars(data, "expense");
    assert.equal(result.length, 2);
    const makan = result.find((r) => r.label === "Makan");
    const transport = result.find((r) => r.label === "Transport");
    assert.ok(makan);
    assert.ok(transport);
    assert.equal(makan.widthPct, 100);
    assert.equal(transport.widthPct, 25);
  });
});

describe("getMonthDateRange", () => {
  test("exported as a function", () => {
    assert.strictEqual(
      typeof getMonthDateRange,
      "function",
      "getMonthDateRange must be exported from laporan-utils",
    );
  });

  test("returns startDate and endDate as ISO strings", () => {
    const { startDate, endDate } = getMonthDateRange();
    assert.ok(typeof startDate === "string");
    assert.ok(typeof endDate === "string");
    assert.ok(new Date(startDate) <= new Date(endDate));
  });

  test("startDate is first day of current month", () => {
    const { startDate } = getMonthDateRange();
    const d = new Date(startDate);
    assert.equal(d.getDate(), 1);
  });
});

describe("getTodayDateRange", () => {
  test("exported as a function", () => {
    assert.strictEqual(
      typeof getTodayDateRange,
      "function",
      "getTodayDateRange must be exported from laporan-utils",
    );
  });

  test("returns startDate and endDate spanning exactly today", () => {
    const { startDate, endDate } = getTodayDateRange();
    const s = new Date(startDate);
    const e = new Date(endDate);
    const now = new Date();
    assert.equal(s.getDate(), now.getDate());
    assert.equal(e.getDate(), now.getDate());
    assert.ok(s <= e);
  });
});

describe("buildInvChartData", () => {
  test("exported as a function", () => {
    assert.strictEqual(
      typeof buildInvChartData,
      "function",
      "buildInvChartData must be exported from laporan-utils",
    );
  });

  test("returns null when summary is undefined", () => {
    assert.strictEqual(buildInvChartData(undefined), null);
  });

  test("returns null when both nilai and modal are zero", () => {
    const summary = {
      totalCostBasis: "0",
      totalCurrentValue: "0",
      totalReturnRp: "0",
      totalReturnPct: 0,
      todayReturnRp: "0",
      todayReturnPct: 0,
    };
    assert.strictEqual(buildInvChartData(summary), null);
  });

  test("nilaiPct is 100 when nilai equals modal (breakeven)", () => {
    const summary = {
      totalCostBasis: "10000000",
      totalCurrentValue: "10000000",
      totalReturnRp: "0",
      totalReturnPct: 0,
      todayReturnRp: "0",
      todayReturnPct: 0,
    };
    const result = buildInvChartData(summary);
    assert.ok(result !== null);
    assert.equal(result.nilaiPct, 100);
    assert.equal(result.modalPct, 100);
    assert.equal(result.hasReturn, true);
  });

  test("nilaiPct 100, modalPct < 100 when nilai > modal (profit)", () => {
    const summary = {
      totalCostBasis: "8000000",
      totalCurrentValue: "10000000",
      totalReturnRp: "2000000",
      totalReturnPct: 25,
      todayReturnRp: "0",
      todayReturnPct: 0,
    };
    const result = buildInvChartData(summary);
    assert.ok(result !== null);
    assert.equal(result.nilaiPct, 100);
    assert.equal(result.modalPct, 80);
    assert.equal(result.hasReturn, true);
  });

  test("modalPct 100, nilaiPct < 100 when nilai < modal (loss)", () => {
    const summary = {
      totalCostBasis: "10000000",
      totalCurrentValue: "7000000",
      totalReturnRp: "-3000000",
      totalReturnPct: -30,
      todayReturnRp: "0",
      todayReturnPct: 0,
    };
    const result = buildInvChartData(summary);
    assert.ok(result !== null);
    assert.equal(result.modalPct, 100);
    assert.equal(result.nilaiPct, 70);
    assert.equal(result.hasReturn, false);
  });

  test("pct values are integers (rounded)", () => {
    const summary = {
      totalCostBasis: "3000000",
      totalCurrentValue: "10000000",
      totalReturnRp: "7000000",
      totalReturnPct: 233,
      todayReturnRp: "0",
      todayReturnPct: 0,
    };
    const result = buildInvChartData(summary);
    assert.ok(result !== null);
    assert.equal(result.nilaiPct % 1, 0, "nilaiPct must be integer");
    assert.equal(result.modalPct % 1, 0, "modalPct must be integer");
  });
});
