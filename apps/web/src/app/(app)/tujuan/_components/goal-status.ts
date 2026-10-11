import type { GoalDto, GoalStatus } from "@wealthme/contracts";

/** Whole months from `now` until `targetDate`, floored at 1. */
export function monthsUntil(
  targetDate: string,
  now: Date = new Date(),
): number {
  const target = new Date(targetDate);
  const months =
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth());
  return Math.max(months, 1);
}

/** Saving needed per month to close the gap by the target date, or null. */
export function monthlyNeeded(
  goal: Pick<GoalDto, "targetDate" | "remainingAmount">,
  now: Date = new Date(),
): number | null {
  if (!goal.targetDate || goal.remainingAmount <= 0) return null;
  return Math.ceil(goal.remainingAmount / monthsUntil(goal.targetDate, now));
}

/**
 * The server's status judges pace so far, so a goal with nothing saved yet
 * and no plan reads "on_track" (deliberately: a brand-new goal must not be
 * flagged at risk). The page also tells the user, in red, that such a goal
 * has no routine allocation — so for display, an "on_track" goal whose
 * scheduled auto-debit cannot reach the target by its date needs a boost.
 * Every count, chip and sheet on /tujuan reads this, so they agree.
 */
export function effectiveGoalStatus(
  goal: Pick<
    GoalDto,
    "status" | "targetDate" | "remainingAmount" | "autoDebitAmount"
  >,
  now: Date = new Date(),
): GoalStatus {
  if (goal.status !== "on_track") return goal.status;
  const needed = monthlyNeeded(goal, now);
  if (needed === null) return goal.status;
  return (goal.autoDebitAmount ?? 0) >= needed ? "on_track" : "needs_boost";
}
