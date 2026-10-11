import type { BudgetDto } from "@wealthme/contracts";

export type BudgetSummary = {
  /** Sum of monthly limits. */
  limit: number;
  /** Sum of monthly spend. */
  spent: number;
  /** limit - spent, floored at 0. */
  remaining: number;
  /** Whole-percent of the monthly limit spent (can exceed 100). */
  usagePct: number;
  /** remaining spread over the days left in the month. */
  safePerDay: number;
  overCount: number;
  /** The category that most needs attention: highest usage among over/near budgets. */
  worst: BudgetDto | null;
  /** Weekly/yearly budgets left out of the monthly totals. */
  excludedCount: number;
};

/**
 * The anggaran hero is a monthly view. Adding a weekly or yearly limit to it
 * mixed periods (a single large weekly budget once turned six over-budget
 * categories into "0% dari batas"), so only monthly budgets are totalled and
 * the rest are counted for the caption. The alert names the worst category
 * by usage, not whichever over-budget row the API happened to return first.
 */
export function summarizeBudgets(
  budgets: readonly BudgetDto[],
  now: Date,
): BudgetSummary {
  const monthly = budgets.filter((b) => b.period === "monthly");
  const limit = monthly.reduce((sum, b) => sum + b.limitAmount, 0);
  const spent = monthly.reduce((sum, b) => sum + b.spentAmount, 0);
  const remaining = Math.max(0, limit - spent);
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  ).getDate();
  const daysLeft = Math.max(1, daysInMonth - now.getDate());
  const byUsage = (a: BudgetDto, b: BudgetDto) =>
    b.usagePercent - a.usagePercent;
  const over = budgets.filter((b) => b.isOverBudget).sort(byUsage);
  const near = budgets.filter((b) => b.isNearLimit).sort(byUsage);
  return {
    limit,
    spent,
    remaining,
    usagePct: limit > 0 ? Math.round((spent / limit) * 100) : 0,
    safePerDay: remaining / daysLeft,
    overCount: over.length,
    worst: over[0] ?? near[0] ?? null,
    excludedCount: budgets.length - monthly.length,
  };
}
