import type { BudgetPeriod } from "@wealthme/contracts";

/**
 * EPIC-022 group C (C1/C3/C4, Open Design Decision #2, DECIDED 2026-08-04:
 * implement) — the spend window a `Budget` is measured against must follow
 * `budget.period` (weekly / monthly / yearly), not the hardcoded calendar
 * month `budgets.service.ts` and `transaction-alerts.util.ts` both used
 * before this. Documented defaults from the epic's Open Design Decisions:
 * week starts Monday, no pro-rata on a mid-period create, current period
 * only (no retained history).
 *
 * Mirrors `payment-period.util.ts`'s WIB (UTC+7, fixed, no DST) pinning —
 * same reasoning: no `TZ` is set anywhere in this repo, so a calendar
 * boundary built from the SERVER's own local clock would disagree with the
 * WIB wall-clock every real user is on.
 */
const WIB_UTC_OFFSET_MS = 7 * 60 * 60_000;

function toWibShifted(now: Date): Date {
  return new Date(now.getTime() + WIB_UTC_OFFSET_MS);
}

function wibToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
): Date {
  return new Date(
    Date.UTC(year, month, day, hour, minute, second, ms) - WIB_UTC_OFFSET_MS,
  );
}

/**
 * Returns the [start, end] bounds (inclusive) of the CURRENT budget period,
 * anchored to calendar boundaries in WIB. `weekly` starts Monday (the
 * documented default) — JS `getUTCDay()` is 0=Sunday..6=Saturday, so the
 * offset back to the most recent Monday is `(day + 6) % 7`.
 */
export function currentBudgetPeriodBounds(
  period: BudgetPeriod,
  now: Date = new Date(),
): { periodStart: Date; periodEnd: Date } {
  const wibNow = toWibShifted(now);
  const year = wibNow.getUTCFullYear();
  const month = wibNow.getUTCMonth();
  const date = wibNow.getUTCDate();

  if (period === "yearly") {
    return {
      periodStart: wibToUtc(year, 0, 1),
      periodEnd: new Date(wibToUtc(year + 1, 0, 1).getTime() - 1),
    };
  }

  if (period === "weekly") {
    const daysSinceMonday = (wibNow.getUTCDay() + 6) % 7;
    const mondayStart = wibToUtc(year, month, date - daysSinceMonday);
    return {
      periodStart: mondayStart,
      periodEnd: new Date(mondayStart.getTime() + 7 * 24 * 60 * 60_000 - 1),
    };
  }

  return {
    periodStart: wibToUtc(year, month, 1),
    periodEnd: new Date(wibToUtc(year, month + 1, 1).getTime() - 1),
  };
}

/**
 * C3 — a budget created mid-period must not read spend from before it
 * existed: the query START is clamped to `max(periodStart, createdAt)`.
 * `periodEnd` is never clamped — "current period only" (no rollover/
 * history, per the documented default) means the window always runs to the
 * end of the current period regardless of when the budget was created.
 */
export function budgetSpendWindow(
  period: BudgetPeriod,
  createdAt: Date,
  now: Date = new Date(),
): { start: Date; end: Date } {
  const { periodStart, periodEnd } = currentBudgetPeriodBounds(period, now);
  return {
    start: createdAt > periodStart ? createdAt : periodStart,
    end: periodEnd,
  };
}
