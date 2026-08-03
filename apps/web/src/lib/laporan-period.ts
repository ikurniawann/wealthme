/**
 * Shared /laporan year/month(/day) period filter (EPIC-020 Task B).
 *
 * Pure, framework-free helpers that map a `{ year, month, day? }` selection
 * into ISO `startDate`/`endDate` bounds. Kept in its own module (rather than
 * `laporan-utils.ts`) because `laporan-utils.ts` has a hand-maintained
 * `laporan-utils.js` mirror for a legacy `node:test` suite — co-locating new
 * exports there would risk Jest's module resolution picking up the stale
 * `.js` mirror instead of the `.ts` source for any new import.
 */

/** The shared year/month(/day) selection driving every report section. */
export interface ReportPeriodSelection {
  /** Full calendar year, e.g. 2026. */
  year: number;
  /** 1-12 (January = 1). */
  month: number;
  /** 1-31, or `null`/`undefined` for "whole month" (no specific day pinned). */
  day?: number | null;
}

/** Number of days in the given (year, 1-12 month), leap-year aware. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Clamp `day` into the valid [1, daysInMonth] range for (year, month). */
export function clampDayToMonth(
  year: number,
  month: number,
  day: number,
): number {
  return Math.min(Math.max(Math.trunc(day), 1), daysInMonth(year, month));
}

/**
 * Pure mapper: a year/month(/day) selection → ISO `startDate`/`endDate`
 * bounds. When `day` is set the bounds cover just that calendar day;
 * otherwise they cover the whole month (first day 00:00:00.000 through the
 * last day 23:59:59.999), correctly rolling over December → January and
 * across leap Februaries because `daysInMonth` reads it from `Date` itself.
 */
export function getPeriodDateRange(selection: ReportPeriodSelection): {
  startDate: string;
  endDate: string;
} {
  const { year, month } = selection;
  if (selection.day) {
    const day = clampDayToMonth(year, month, selection.day);
    const start = new Date(year, month - 1, day, 0, 0, 0, 0);
    const end = new Date(year, month - 1, day, 23, 59, 59, 999);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

/** ISO bounds for the full calendar year (Jan 1 – Dec 31), used to anchor
 * year-granularity trend queries (e.g. the "Tahunan" tab). */
export function getYearDateRange(year: number): {
  startDate: string;
  endDate: string;
} {
  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}
