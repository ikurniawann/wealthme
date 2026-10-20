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

/** The anchor day a policy's schedule keeps (coverage start, else the due itself). */
export function scheduleOptionsFor(policy: {
  coverageStartDate: Date | null;
  premiumPaymentEndDate: Date | null;
}): ScheduleOptions {
  return {
    anchorDay: policy.coverageStartDate?.getUTCDate(),
    paymentEndDate: policy.premiumPaymentEndDate,
  };
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
