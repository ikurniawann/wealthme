/**
 * Shared /laporan year/month(/day) period filter (EPIC-020 Task B).
 *
 * Pure, framework-free helpers that map a `{ year, month, day? }` selection
 * into ISO `startDate`/`endDate` bounds. Originally kept out of
 * `laporan-utils.ts` to dodge a stale hand-maintained `laporan-utils.js`
 * mirror that Jest's module resolution would silently prefer over the real
 * `.ts` source (EPIC-022 B1/B2 removed that mirror, and its dead
 * `node --test`-only suite, once it started actively hiding new exports).
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

/**
 * Indonesia Western Time — fixed UTC+7, no daylight saving. Reporting
 * boundaries are pinned to this offset (EPIC-022 B7) so a month/day boundary
 * is the same instant regardless of the browser's or server's local
 * timezone. Shown alongside the period filter so the pin is disclosed, not
 * silent.
 */
export const REPORT_TIMEZONE_LABEL = "WIB (UTC+7)";

const WIB_UTC_OFFSET_MINUTES = 7 * 60;

/**
 * Builds the UTC ISO instant for a WIB (Asia/Jakarta) wall-clock moment.
 * Uses `Date.UTC` — never the environment's local offset — so the result is
 * identical no matter what timezone the browser/server/CI runner is in.
 */
function wibWallClockToIso(
  year: number,
  monthIndex0: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number,
): string {
  const utcMs =
    Date.UTC(year, monthIndex0, day, hour, minute, second, ms) -
    WIB_UTC_OFFSET_MINUTES * 60_000;
  return new Date(utcMs).toISOString();
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
 * bounds, pinned to WIB (EPIC-022 B7 — never the browser/server's local
 * offset). When `day` is set the bounds cover just that calendar day;
 * otherwise they cover the whole month (first day 00:00:00.000 through the
 * last day 23:59:59.999 WIB), correctly rolling over December → January and
 * across leap Februaries because `daysInMonth` reads it from `Date` itself.
 */
export function getPeriodDateRange(selection: ReportPeriodSelection): {
  startDate: string;
  endDate: string;
} {
  const { year, month } = selection;
  if (selection.day) {
    const day = clampDayToMonth(year, month, selection.day);
    return {
      startDate: wibWallClockToIso(year, month - 1, day, 0, 0, 0, 0),
      endDate: wibWallClockToIso(year, month - 1, day, 23, 59, 59, 999),
    };
  }
  const lastDay = daysInMonth(year, month);
  return {
    startDate: wibWallClockToIso(year, month - 1, 1, 0, 0, 0, 0),
    endDate: wibWallClockToIso(year, month - 1, lastDay, 23, 59, 59, 999),
  };
}

/** ISO bounds for the full calendar year (Jan 1 – Dec 31 WIB), used to anchor
 * year-granularity trend queries (e.g. the "Tahunan" tab). */
export function getYearDateRange(year: number): {
  startDate: string;
  endDate: string;
} {
  return {
    startDate: wibWallClockToIso(year, 0, 1, 0, 0, 0, 0),
    endDate: wibWallClockToIso(year, 11, 31, 23, 59, 59, 999),
  };
}
