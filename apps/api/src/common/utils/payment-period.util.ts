/**
 * EPIC-023 group E retry (CRITICAL 1) — the recurring-obligation "period"
 * both `LiabilitiesService` (always monthly — its FIXED budget line is
 * always `period: "monthly"`) and `InsurancesService` (`premiumPeriod`:
 * monthly/quarterly/yearly) need to compute "has this already been paid for
 * the CURRENT period" correctly. Replaces the previous hardcoded
 * calendar-month window, which read a yearly policy paid in January as
 * unpaid again from February onward.
 */
export type PaymentPeriod = "monthly" | "quarterly" | "yearly";

/**
 * Returns the [start, end] bounds of the CURRENT period, anchored to
 * calendar boundaries (calendar month / calendar quarter / calendar year) —
 * not to the obligation's own `dueDate`/`renewalDate` anniversary. This is a
 * deliberate simplification (documented, not silent): without a reliable
 * period-anchor date on every row (a liability has none at all;
 * `renewalDate` on an insurance can be null), a calendar-aligned window is
 * the only option that is always computable and never mis-detects a payment
 * make just before/after an anniversary as belonging to the wrong period.
 */
export function currentPaymentPeriodBounds(
  period: PaymentPeriod,
  now: Date = new Date(),
): { periodStart: Date; periodEnd: Date } {
  const year = now.getFullYear();
  const month = now.getMonth();

  if (period === "yearly") {
    return {
      periodStart: new Date(year, 0, 1),
      periodEnd: new Date(year, 12, 0, 23, 59, 59, 999),
    };
  }

  if (period === "quarterly") {
    const quarterStartMonth = month - (month % 3);
    return {
      periodStart: new Date(year, quarterStartMonth, 1),
      periodEnd: new Date(year, quarterStartMonth + 3, 0, 23, 59, 59, 999),
    };
  }

  return {
    periodStart: new Date(year, month, 1),
    periodEnd: new Date(year, month + 1, 0, 23, 59, 59, 999),
  };
}
