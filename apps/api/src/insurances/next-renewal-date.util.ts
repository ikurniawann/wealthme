import { MONTHS_PER_PERIOD, addMonthsClamped } from "./premium-schedule.util";

import type { InsuranceStatus, PremiumPeriod } from "@prisma/client";

/**
 * The frequencies the create/update DTOs accept during the rollback window.
 * The premium schedule (premium-schedule.util.ts) handles all six —
 * semiannual / single / custom never loop (single/custom have no recurring
 * step). They stay closed at the API edge for the same reason as the new
 * statuses below: a row saved with one would make the PREVIOUS image's
 * Prisma client throw on every insurance read for that family if we roll
 * back by image retag. Widen this ONE constant once the window closes.
 */
export const ACCEPTED_PREMIUM_PERIODS: readonly PremiumPeriod[] = [
  "monthly",
  "quarterly",
  "yearly",
];

/**
 * The policy statuses the create/update DTOs accept during the rollback
 * window. masa_tenggang / lapse / berakhir / dibatalkan exist in the schema,
 * but a row saved with one of them would make the PREVIOUS image's Prisma
 * client throw on every insurance read for that family if we roll back by
 * image retag. Widen this ONE constant once the rollback window closes.
 */
export const ACCEPTED_INSURANCE_STATUSES: readonly InsuranceStatus[] = [
  "aktif",
  "tidak_aktif",
  "kadaluarsa",
];

/**
 * LEGACY helper (kept for its existing spec): advances `current` by exactly
 * one premium period, clamped to the target month's last day. New code uses
 * `nextPremiumDue` (premium-schedule.util.ts), which also honours the anchor
 * day and the premium payment end date. A non-recurring period returns
 * `current` unchanged.
 */
export function nextRenewalDate(current: Date, period: PremiumPeriod): Date {
  const months = MONTHS_PER_PERIOD[period];
  return months === null ? current : addMonthsClamped(current, months);
}
