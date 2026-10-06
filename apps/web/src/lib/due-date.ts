// One definition of "due soon" for every surface that talks about an upcoming
// installment (Liabilitas pills + summary tip, Beranda attention banner).
// Without it each screen invented its own window and the same KPR read as
// "no due date soon" on one page and "due" on another.

/** An installment due within this many calendar days (or already late) is "soon". */
export const DUE_SOON_DAYS = 7;

/**
 * A policy renewing within this many calendar days is "soon" (Asuransi
 * banner/tip). Mirrors `INSURANCE_RENEWAL_WINDOW_DAYS` in
 * apps/api/src/common/utils/due-window.util.ts, which gates the renewal
 * notification — keep both in step.
 */
export const INSURANCE_RENEWAL_WINDOW_DAYS = 30;

const DAY_MS = 86_400_000;

export type DueState = "overdue" | "soon" | "later";

export type DueFields = {
  nextDueDate?: string | null;
  dueDate?: string | null;
  /** The API's own late flag; authoritative when the row has a `nextDueDate`. */
  currentInstallmentLate?: boolean | null;
};

/** The date an item is actually due: the real `nextDueDate`, else the legacy manual `dueDate`. */
export function effectiveDueDate(item: DueFields): string | null {
  return item.nextDueDate ?? item.dueDate ?? null;
}

/**
 * Whole calendar days from `now` (local calendar day) to the due date (its
 * ISO calendar day). Negative once the due day has passed. Day-based rather
 * than instant-based so a due date stored at UTC midnight is "today" all
 * day, not "late" after 07:00 WIB.
 */
export function daysUntilDue(dueIso: string, now: Date = new Date()): number {
  const due = new Date(dueIso);
  const dueDay = Date.UTC(
    due.getUTCFullYear(),
    due.getUTCMonth(),
    due.getUTCDate(),
  );
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((dueDay - today) / DAY_MS);
}

/** Classify a due date: overdue, due within `withinDays`, or later. */
export function dueState(
  dueIso: string,
  options: { now?: Date; isLate?: boolean | null; withinDays?: number } = {},
): { state: DueState; days: number } {
  const days = daysUntilDue(dueIso, options.now);
  const late = options.isLate ?? days < 0;
  if (late) return { state: "overdue", days };
  return {
    state: days <= (options.withinDays ?? DUE_SOON_DAYS) ? "soon" : "later",
    days,
  };
}

/**
 * The item whose installment is overdue or due within `days` days (default
 * `DUE_SOON_DAYS`), earliest first; undefined when nothing qualifies.
 */
export function nextDueWithin<T extends DueFields>(
  items: readonly T[],
  days: number = DUE_SOON_DAYS,
  now: Date = new Date(),
): T | undefined {
  return items
    .flatMap((item) => {
      const due = effectiveDueDate(item);
      if (!due) return [];
      const status = dueState(due, {
        now,
        withinDays: days,
        isLate: item.nextDueDate ? item.currentInstallmentLate : null,
      });
      return status.state === "later" ? [] : [{ item, due }];
    })
    .sort((a, b) => a.due.localeCompare(b.due))[0]?.item;
}
