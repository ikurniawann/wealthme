/** Number of months in each premium/billing period. */
export const MONTHS_BY_PERIOD: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

/**
 * Advance a date by whole months, repeating until it's in the future.
 * Used by the auto-advance cron (`BillingCycleProcessor`) to catch an
 * overdue due/renewal date up to the next future cycle in one pass.
 */
export function advanceUntilFuture(
  date: Date,
  months: number,
  now: Date,
): Date {
  const next = new Date(date);
  while (next.getTime() <= now.getTime()) {
    next.setMonth(next.getMonth() + months);
  }
  return next;
}

/**
 * Advance a date by exactly one billing period — a single real payment.
 * Used by manual "pay now" flows (e.g. the `/asuransi` "Bayar" action),
 * where each click represents one payment recorded against the policy.
 */
export function advanceByOnePeriod(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}
