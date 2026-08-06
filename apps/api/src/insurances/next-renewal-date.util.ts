import type { PremiumPeriod } from "@prisma/client";

const MONTHS_BY_PERIOD: Record<PremiumPeriod, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

/**
 * Advances `current` by exactly one premium period, clamping to the target
 * month's last day (Jan 31 monthly -> Feb 28/29, not Mar 2/3) — EPIC-023 E1.
 *
 * This intentionally mirrors, field-for-field, the already-tested web helper
 * at `apps/web/src/app/(app)/asuransi/page.tsx` (`nextRenewalDate`, covered
 * by `next-renewal-date.test.ts`) rather than the DIFFERENT algorithm in
 * `billing-cycle.processor.ts`'s `advanceUntilFuture`: that one loops
 * `date.setMonth()` (no month-end clamping) until the result is in the
 * future, because it is a catch-up job that may need to skip several missed
 * periods at once. A single `pay()` call only ever covers ONE premium
 * period, so the single-advance, clamped algorithm is the correct one to
 * port here — porting the OTHER algorithm would silently change the
 * clamping behavior this file's own tests pin. Operates on `Date` (not an
 * ISO string) since Prisma reads/writes `DateTime` columns as `Date`.
 */
export function nextRenewalDate(current: Date, period: PremiumPeriod): Date {
  const months = MONTHS_BY_PERIOD[period];
  const year = current.getUTCFullYear();
  const month = current.getUTCMonth() + months;
  const day = current.getUTCDate();
  const daysInTarget = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, daysInTarget)));
}
