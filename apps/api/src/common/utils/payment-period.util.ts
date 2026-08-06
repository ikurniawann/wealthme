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

// H7 (group E retry round 4) — WIB (UTC+7, fixed, no DST), mirroring
// `reports.controller.ts`'s `defaultMonthStartWib` / task H1's
// shift-then-`Date.UTC` pattern. The bounds below used to be built with the
// SERVER-LOCAL `new Date(y, m, d)` constructor and no `TZ` is set anywhere
// in this repo (no Dockerfile/compose/env) — so on a server whose local
// clock is UTC (the common default for a hosted Node process) while every
// real user is in WIB, a payment at 03:00 WIB on the 1st of the month
// (= 20:00 UTC the day before) fell BEFORE `periodStart`, letting the same
// obligation be paid twice within the first 7 hours of every period. Using
// `Date.getTime()` (an absolute instant) plus a fixed WIB offset — instead
// of `Date`'s local getters — makes every bound correct regardless of the
// HOST machine's own timezone.
const WIB_UTC_OFFSET_MS = 7 * 60 * 60_000;

/** `now`'s wall-clock instant shifted so UTC getters read as WIB would. */
function toWibShifted(now: Date): Date {
  return new Date(now.getTime() + WIB_UTC_OFFSET_MS);
}

/** Builds the real UTC instant for a WIB wall-clock date/time. */
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
 * Returns the [start, end] bounds of the CURRENT period, anchored to
 * calendar boundaries (calendar month / calendar quarter / calendar year) —
 * not to the obligation's own `dueDate`/`renewalDate` anniversary. This is a
 * deliberate simplification (documented, not silent): without a reliable
 * period-anchor date on every row (a liability has none at all;
 * `renewalDate` on an insurance can be null), a calendar-aligned window is
 * the only option that is always computable and never mis-detects a payment
 * make just before/after an anniversary as belonging to the wrong period.
 *
 * The calendar boundaries themselves are anchored to WIB (see the doc
 * comment above `WIB_UTC_OFFSET_MS`), not to the host machine's local
 * timezone.
 */
export function currentPaymentPeriodBounds(
  period: PaymentPeriod,
  now: Date = new Date(),
): { periodStart: Date; periodEnd: Date } {
  const wibNow = toWibShifted(now);
  const year = wibNow.getUTCFullYear();
  const month = wibNow.getUTCMonth();

  if (period === "yearly") {
    return {
      periodStart: wibToUtc(year, 0, 1),
      periodEnd: new Date(wibToUtc(year + 1, 0, 1).getTime() - 1),
    };
  }

  if (period === "quarterly") {
    const quarterStartMonth = month - (month % 3);
    return {
      periodStart: wibToUtc(year, quarterStartMonth, 1),
      periodEnd: new Date(
        wibToUtc(year, quarterStartMonth + 3, 1).getTime() - 1,
      ),
    };
  }

  return {
    periodStart: wibToUtc(year, month, 1),
    periodEnd: new Date(wibToUtc(year, month + 1, 1).getTime() - 1),
  };
}
