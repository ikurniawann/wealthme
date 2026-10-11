import type { BudgetDto } from "@wealthme/contracts";
import { summarizeBudgets } from "./budget-summary";

function budget(over: Partial<BudgetDto>): BudgetDto {
  const limitAmount = over.limitAmount ?? 100;
  const spentAmount = over.spentAmount ?? 0;
  return {
    id: over.id ?? Math.random().toString(36),
    categoryId: "c",
    categoryName: over.categoryName ?? "Belanja",
    categoryIcon: null,
    period: over.period ?? "monthly",
    limitAmount,
    spentAmount,
    remainingAmount: limitAmount - spentAmount,
    usagePercent: (spentAmount / limitAmount) * 100,
    isOverBudget: spentAmount > limitAmount,
    isNearLimit: spentAmount >= limitAmount * 0.8 && spentAmount <= limitAmount,
    budgetType: null,
    ...over,
  };
}

const OCT_11 = new Date(2026, 9, 11);

describe("summarizeBudgets", () => {
  it("totals monthly budgets only, so a weekly limit never dilutes the month", () => {
    const summary = summarizeBudgets(
      [
        budget({ limitAmount: 100, spentAmount: 266 }),
        budget({ limitAmount: 50, spentAmount: 25 }),
        budget({ period: "weekly", limitAmount: 1_250_000, spentAmount: 0 }),
      ],
      OCT_11,
    );
    expect(summary.limit).toBe(150);
    expect(summary.spent).toBe(291);
    expect(summary.usagePct).toBe(194);
    expect(summary.excludedCount).toBe(1);
  });

  it("names the worst over-budget category, not the first one returned", () => {
    const summary = summarizeBudgets(
      [
        budget({ categoryName: "Makan", limitAmount: 100, spentAmount: 166 }),
        budget({ categoryName: "Hiburan", limitAmount: 10, spentAmount: 119 }),
        budget({ categoryName: "Belanja", limitAmount: 100, spentAmount: 90 }),
      ],
      OCT_11,
    );
    expect(summary.worst?.categoryName).toBe("Hiburan");
    expect(summary.overCount).toBe(2);
  });

  it("falls back to the nearest-to-limit category when nothing is over", () => {
    const summary = summarizeBudgets(
      [
        budget({ categoryName: "Belanja", limitAmount: 100, spentAmount: 82 }),
        budget({ categoryName: "Makan", limitAmount: 100, spentAmount: 95 }),
      ],
      OCT_11,
    );
    expect(summary.worst?.categoryName).toBe("Makan");
  });

  it("spreads what is left over the remaining days, never below zero", () => {
    const left = summarizeBudgets(
      [budget({ limitAmount: 2_000, spentAmount: 1_000 })],
      OCT_11,
    );
    // 31 days in October, the 11th: 20 days remain after today.
    expect(left.remaining).toBe(1_000);
    expect(left.safePerDay).toBe(50);
    const over = summarizeBudgets(
      [budget({ limitAmount: 100, spentAmount: 300 })],
      OCT_11,
    );
    expect(over.remaining).toBe(0);
    expect(over.safePerDay).toBe(0);
  });
});
