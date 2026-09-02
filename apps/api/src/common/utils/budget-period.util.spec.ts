import {
  budgetSpendWindow,
  currentBudgetPeriodBounds,
} from "./budget-period.util";

// EPIC-022 group C (C1) — the regression this util fixes: the spend query
// was hardcoded to the calendar month regardless of `budget.period`, so a
// weekly budget read ~400% over forever and a yearly budget read ~8% used
// until the money was gone. These assertions use an absolute-instant `wib()`
// helper (not the local-time `new Date(y, m, d)` constructor) so the
// expectation does not silently follow the test-runner machine's own clock —
// the same class of bug `payment-period.util.spec.ts` documents.
const wib = (
  year: number,
  monthIndex: number,
  day: number,
  hours = 0,
  minutes = 0,
  seconds = 0,
  ms = 0,
): Date =>
  new Date(
    Date.UTC(year, monthIndex, day, hours, minutes, seconds, ms) -
      7 * 60 * 60 * 1000,
  );

describe("currentBudgetPeriodBounds", () => {
  it("monthly: bounds span the first to the last day of the current calendar month", () => {
    const now = wib(2026, 5, 15, 12);
    const { periodStart, periodEnd } = currentBudgetPeriodBounds(
      "monthly",
      now,
    );
    expect(periodStart).toEqual(wib(2026, 5, 1));
    expect(periodEnd).toEqual(wib(2026, 5, 30, 23, 59, 59, 999));
  });

  it("yearly: bounds span the entire calendar year", () => {
    const now = wib(2026, 5, 15, 12);
    const { periodStart, periodEnd } = currentBudgetPeriodBounds("yearly", now);
    expect(periodStart).toEqual(wib(2026, 0, 1));
    expect(periodEnd).toEqual(wib(2026, 11, 31, 23, 59, 59, 999));
  });

  it("weekly: bounds span Monday through Sunday when checked mid-week", () => {
    // 2026-06-17 is a Wednesday.
    const now = wib(2026, 5, 17, 12);
    const { periodStart, periodEnd } = currentBudgetPeriodBounds("weekly", now);
    expect(periodStart).toEqual(wib(2026, 5, 15)); // Monday
    expect(periodEnd).toEqual(wib(2026, 5, 21, 23, 59, 59, 999)); // Sunday
  });

  it("weekly: checked ON a Monday still starts that same Monday", () => {
    const now = wib(2026, 5, 15, 0, 30); // Monday, just after midnight
    const { periodStart } = currentBudgetPeriodBounds("weekly", now);
    expect(periodStart).toEqual(wib(2026, 5, 15));
  });

  it("weekly: checked on a Sunday still belongs to the week that started the prior Monday", () => {
    const now = wib(2026, 5, 21, 23, 0); // Sunday night
    const { periodStart, periodEnd } = currentBudgetPeriodBounds("weekly", now);
    expect(periodStart).toEqual(wib(2026, 5, 15));
    expect(periodEnd).toEqual(wib(2026, 5, 21, 23, 59, 59, 999));
  });

  it("weekly: a week spanning a month boundary resolves correctly", () => {
    // 2026-07-01 is a Wednesday; the week's Monday is 2026-06-29.
    const now = wib(2026, 6, 1, 12);
    const { periodStart, periodEnd } = currentBudgetPeriodBounds("weekly", now);
    expect(periodStart).toEqual(wib(2026, 5, 29));
    expect(periodEnd).toEqual(wib(2026, 6, 5, 23, 59, 59, 999));
  });
});

describe("budgetSpendWindow (C3 — clamp to createdAt, never to periodEnd)", () => {
  it("clamps the start to createdAt when the budget was created mid-period", () => {
    const now = wib(2026, 5, 20, 12); // June 20
    const createdAt = wib(2026, 5, 18, 9); // June 18 — after the monthly period start
    const { start, end } = budgetSpendWindow("monthly", createdAt, now);
    expect(start).toEqual(createdAt);
    expect(end).toEqual(wib(2026, 5, 30, 23, 59, 59, 999));
  });

  it("uses the period start when the budget predates the current period", () => {
    const now = wib(2026, 5, 20, 12);
    const createdAt = wib(2026, 0, 5); // January — long before June's period
    const { start } = budgetSpendWindow("monthly", createdAt, now);
    expect(start).toEqual(wib(2026, 5, 1));
  });
});
