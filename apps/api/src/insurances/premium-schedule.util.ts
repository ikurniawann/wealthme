import type { Prisma, PremiumPeriod } from "@prisma/client";

/**
 * Asuransi Task 22 — the premium schedule. All dates here are DATE-ONLY
 * values carried as a `Date` at UTC midnight (Prisma `@db.Date`). "Today" is
 * the calendar day in the user's time zone; there is no per-user time-zone
 * column yet, so every caller uses DEFAULT_TIME_ZONE (Asia/Jakarta).
 *
 * Reminders, due status and the summary read ONLY nextPremiumDueDate (S1),
 * never coverageEndDate / policyRenewalDate.
 */
export const DEFAULT_TIME_ZONE = "Asia/Jakarta";

/** Months between dues; null = no recurring step (single / custom). */
export const MONTHS_PER_PERIOD: Record<PremiumPeriod, number | null> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
  single: null,
  custom: null,
};

/** Hard cap on schedule iterations — a schedule can never loop forever. */
const MAX_SCHEDULE_STEPS = 1200;
const DAY_MS = 86_400_000;

export function isRecurringPeriod(period: PremiumPeriod): boolean {
  return MONTHS_PER_PERIOD[period] !== null;
}

/** The calendar day of `now` in `timeZone`, as a UTC-midnight date. */
export function todayInTimeZone(
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** Parses "YYYY-MM-DD" (or an ISO string — only its date part) to a date-only value. */
export function parseDateOnly(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

/** The UTC calendar day of a stored date (date-only columns already are). */
export function toDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function ymd(date: Date | null | undefined): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

export function sameDay(a: Date, b: Date): boolean {
  return ymd(a) === ymd(b);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round(
    (toDateOnly(to).getTime() - toDateOnly(from).getTime()) / DAY_MS,
  );
}

/**
 * Adds whole months and clamps to the target month's last day. `anchorDay`
 * (the schedule's day of month, e.g. 31) keeps a clamped Feb 28 from
 * drifting the rest of the schedule to the 28th.
 */
export function addMonthsClamped(
  date: Date,
  months: number,
  anchorDay?: number,
): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const day = anchorDay ?? date.getUTCDate();
  const daysInTarget = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, daysInTarget)));
}

export interface ScheduleOptions {
  /** Day of month the schedule is anchored to (coverage start's day). */
  anchorDay?: number;
  /** Akhir masa pembayaran premi: no due after this date. */
  paymentEndDate?: Date | null;
}

/** The due after `current`, or null (single/custom, or past payment end). */
export function nextPremiumDue(
  current: Date,
  period: PremiumPeriod,
  opts: ScheduleOptions = {},
): Date | null {
  const months = MONTHS_PER_PERIOD[period];
  if (months === null) return null;
  const next = addMonthsClamped(current, months, opts.anchorDay);
  if (opts.paymentEndDate && next > toDateOnly(opts.paymentEndDate)) {
    return null;
  }
  return next;
}

/**
 * Advances `current` until it is on or after `today` (the billing worker's
 * catch-up for auto-advancing policies). Bounded; null when the schedule
 * ends or is not recurring.
 */
export function advanceToOnOrAfter(
  current: Date,
  period: PremiumPeriod,
  today: Date,
  opts: ScheduleOptions = {},
): Date | null {
  let due: Date | null = toDateOnly(current);
  for (let i = 0; due && due < today && i < MAX_SCHEDULE_STEPS; i++) {
    due = nextPremiumDue(due, period, opts);
  }
  return due && due >= today ? due : null;
}

/** Every scheduled due within [from, to], starting at `first` (bounded). */
export function duesInRange(
  first: Date | null,
  period: PremiumPeriod,
  from: Date,
  to: Date,
  opts: ScheduleOptions = {},
): Date[] {
  const out: Date[] = [];
  let due: Date | null = first ? toDateOnly(first) : null;
  for (let i = 0; due && due <= to && i < MAX_SCHEDULE_STEPS; i++) {
    if (due >= from) out.push(due);
    due = nextPremiumDue(due, period, opts);
  }
  return out;
}

/**
 * The anchor day a policy's schedule keeps. The due's OWN day wins (a user
 * who pays on the 5th keeps paying on the 5th even when coverage started on
 * the 1st). Only a due sitting on a CLAMPED month end (28 Feb for a 31st
 * schedule) takes the coverage-start day back, so the schedule returns to
 * the 31st instead of drifting to the 28th. Without a due, coverage start.
 */
export function scheduleOptionsFor(
  policy: {
    coverageStartDate: Date | null;
    premiumPaymentEndDate: Date | null;
  },
  due?: Date | null,
): ScheduleOptions {
  return {
    anchorDay: anchorDayFor(policy.coverageStartDate, due ?? null),
    paymentEndDate: policy.premiumPaymentEndDate,
  };
}

function anchorDayFor(
  coverageStart: Date | null,
  due: Date | null,
): number | undefined {
  const startDay = coverageStart?.getUTCDate();
  if (!due) return startDay;
  const day = due.getUTCDate();
  const monthEnd = new Date(
    Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0),
  ).getUTCDate();
  if (startDay !== undefined && day === monthEnd && startDay > day) {
    return startDay;
  }
  return day;
}

/**
 * Monthly-equivalent premium — a NORMALIZATION for comparison, not an actual
 * bill. Decimal, never truncated. null for single/custom (no fixed cadence).
 */
export function monthlyEquivalent(
  amount: Prisma.Decimal,
  period: PremiumPeriod,
): Prisma.Decimal | null {
  const months = MONTHS_PER_PERIOD[period];
  if (months === null) return null;
  return amount.dividedBy(months);
}

/** Payment status of the next due (S2): overdue once its day has passed. */
export function premiumDueStatus(
  nextDue: Date | null,
  today: Date,
): "scheduled" | "overdue" | null {
  if (!nextDue) return null;
  return toDateOnly(nextDue) < today ? "overdue" : "scheduled";
}

/**
 * The current premium period window (calendar month / quarter / half-year /
 * year in the user's time zone) for a policy WITHOUT a due date — the only
 * double-payment guard such a policy can have. null for single (any prior
 * payment counts) and custom (no cadence; the idempotency key still guards
 * retries).
 */
export function currentPremiumWindow(
  period: PremiumPeriod,
  today: Date,
): { start: Date; end: Date } | null {
  const months = MONTHS_PER_PERIOD[period];
  if (months === null) return null;
  const year = today.getUTCFullYear();
  const startMonth = today.getUTCMonth() - (today.getUTCMonth() % months);
  return {
    start: new Date(Date.UTC(year, startMonth, 1)),
    end: new Date(Date.UTC(year, startMonth + months, 1)),
  };
}

/** Reminder lead time: a week for monthly premiums, 30 days otherwise. */
export function reminderWindowDays(period: PremiumPeriod): number {
  return period === "monthly" ? 7 : 30;
}

/** Single/custom premiums have no cadence: a due beyond this is suspect. */
export const NON_RECURRING_CONFIRM_MONTHS = 13;

/**
 * Legacy policies had ONE overloaded `renewalDate`, which the S1 migration
 * copied into nextPremiumDueDate. When it was really a coverage end (e.g.
 * 2036 on a monthly policy) it must not be presented, totalled or reminded
 * as a premium due. A due further out than one full premium period after
 * today (Asia/Jakarta) — plus the reminder lead, so a premium paid early
 * whose schedule just stepped forward is not flagged — needs the user's
 * confirmation; single/custom periods use 13 months. There is no "schedule
 * confirmed since migration" marker, so the period rule alone decides:
 * editing the due to a plausible date clears the flag. Derived, never stored.
 */
export function dueNeedsConfirmation(
  policy: { nextPremiumDueDate: Date | null; premiumPeriod: PremiumPeriod },
  today: Date,
): boolean {
  const due = policy.nextPremiumDueDate;
  if (!due) return false;
  const months = MONTHS_PER_PERIOD[policy.premiumPeriod];
  const limit =
    months === null
      ? addMonthsClamped(today, NON_RECURRING_CONFIRM_MONTHS)
      : new Date(
          addMonthsClamped(today, months).getTime() +
            reminderWindowDays(policy.premiumPeriod) * DAY_MS,
        );
  return toDateOnly(due) > limit;
}

/** Asia/Jakarta is a fixed UTC+07:00 zone (no DST). */
const JAKARTA_OFFSET_MS = 7 * 3_600_000;

/** The instant a Jakarta calendar day (date-only value) starts. */
export function jakartaDayStartInstant(day: Date): Date {
  return new Date(toDateOnly(day).getTime() - JAKARTA_OFFSET_MS);
}

/**
 * The monthly-normalised premium a policy's FIXED budget line carries, in
 * whole rupiah — rounded ONCE (half-up), never truncated per period.
 * single/custom have no monthly cadence → 0 (no budget line).
 */
export function monthlyBudgetContribution(
  premiumAmount: bigint,
  premiumPeriod: PremiumPeriod,
): bigint {
  const months = MONTHS_PER_PERIOD[premiumPeriod];
  if (months === null || premiumAmount <= 0n) return 0n;
  const m = BigInt(months);
  return (premiumAmount * 2n + m) / (2n * m);
}

/**
 * True when `due` is a real due of the policy's premium schedule: the
 * current next due, a later due walked forward from it, an earlier
 * (missed) due walked backward from it on the same anchor, or a due walked
 * forward from the coverage start. Anything else (e.g. a typo'd 06 Nov when
 * the schedule is the 5th) is not a due and must not be paid against.
 */
export function isScheduledDue(
  policy: {
    nextPremiumDueDate: Date | null;
    premiumPeriod: PremiumPeriod;
    coverageStartDate: Date | null;
    premiumPaymentEndDate: Date | null;
  },
  due: Date,
): boolean {
  const target = toDateOnly(due);
  const next = policy.nextPremiumDueDate
    ? toDateOnly(policy.nextPremiumDueDate)
    : null;
  if (next && sameDay(next, target)) return true;
  const months = MONTHS_PER_PERIOD[policy.premiumPeriod];
  if (months === null) return false;
  const start = policy.coverageStartDate
    ? toDateOnly(policy.coverageStartDate)
    : null;
  if (start && target < start) return false;

  if (next) {
    const opts = scheduleOptionsFor(policy, next);
    if (target > next) {
      return (
        duesInRange(next, policy.premiumPeriod, target, target, opts).length > 0
      );
    }
    for (let k = 1; k <= MAX_SCHEDULE_STEPS; k++) {
      const d = addMonthsClamped(next, -k * months, opts.anchorDay);
      if (sameDay(d, target)) return true;
      if (d < target) break;
    }
  }
  if (start) {
    return (
      duesInRange(
        start,
        policy.premiumPeriod,
        target,
        target,
        scheduleOptionsFor(policy, start),
      ).length > 0
    );
  }
  return false;
}

/**
 * Walks the schedule from `start` over every PAID due and stops at the first
 * unpaid one (or, with `before`, at the first due on/after that day). A
 * payment counts for a due when its dueDate is that due; a payment without a
 * due (legacy/reconciled) counts once, for the due whose window
 * [due, next due) its paidAt falls in. Shared by pay() (inside its
 * transaction) and the billing worker, so neither ever leaves the next due
 * on a due that is already paid, nor skips an unpaid one.
 * Returns the new next due (null when the schedule ended) and whether it moved.
 */
export function walkPastPaidDues(
  start: Date,
  period: PremiumPeriod,
  opts: ScheduleOptions,
  payments: { dueDate: Date | null; paidAt: Date }[],
  before?: Date,
): { next: Date | null; moved: boolean } {
  const paidDues = new Set(
    payments.filter((p) => p.dueDate).map((p) => ymd(p.dueDate)),
  );
  const undated = payments
    .filter((p) => !p.dueDate)
    .map((p) => p.paidAt.getTime());
  let due: Date | null = toDateOnly(start);
  let moved = false;
  for (
    let i = 0;
    due && (!before || due < before) && i < MAX_SCHEDULE_STEPS;
    i++
  ) {
    const following: Date | null = nextPremiumDue(due, period, opts);
    let paid = paidDues.has(ymd(due));
    if (!paid) {
      const from = jakartaDayStartInstant(due).getTime();
      const to = following
        ? jakartaDayStartInstant(following).getTime()
        : Number.POSITIVE_INFINITY;
      const idx = undated.findIndex((t) => t >= from && t < to);
      if (idx >= 0) {
        undated.splice(idx, 1);
        paid = true;
      }
    }
    if (!paid) break;
    due = following;
    moved = true;
  }
  return { next: due, moved };
}
