/**
 * The ONE definition of "due soon" on the API side, mirrored from the web's
 * `apps/web/src/lib/due-date.ts` so a notification and the banner on
 * Beranda / Liabilitas / Asuransi can never disagree about the same due date.
 * Change a window here AND there.
 */

/** An installment due within this many calendar days (or already late) is "soon". */
export const INSTALLMENT_DUE_SOON_DAYS = 7;

/** An insurance policy renewing within this many calendar days is "soon". */
export const INSURANCE_RENEWAL_WINDOW_DAYS = 30;

const DAY_MS = 86_400_000;

/**
 * Whole calendar days from `now` to `due`, comparing UTC calendar days (a due
 * date stored at UTC midnight is "today" all day, not "late" after midnight
 * UTC+7). Negative once the due day has passed — mirrors the web's
 * `daysUntilDue`.
 */
export function calendarDaysUntil(due: Date, now: Date = new Date()): number {
  const dueDay = Date.UTC(
    due.getUTCFullYear(),
    due.getUTCMonth(),
    due.getUTCDate(),
  );
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return Math.round((dueDay - today) / DAY_MS);
}

/** True when an installment is overdue or due within `INSTALLMENT_DUE_SOON_DAYS`. */
export function isInstallmentDueSoon(
  due: Date,
  now: Date = new Date(),
): boolean {
  return calendarDaysUntil(due, now) <= INSTALLMENT_DUE_SOON_DAYS;
}

/** True when a renewal is today or within `INSURANCE_RENEWAL_WINDOW_DAYS` (not yet lapsed). */
export function isInsuranceRenewalSoon(
  renewal: Date,
  now: Date = new Date(),
): boolean {
  const days = calendarDaysUntil(renewal, now);
  return days >= 0 && days <= INSURANCE_RENEWAL_WINDOW_DAYS;
}
