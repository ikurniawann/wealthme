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

/**
 * EPIC-023 Task B (B1) — date-range presets for the /laporan period filter
 * (US-RPT-12): This Month · Last Month · Last 3/6/12 Months · This Year ·
 * Last Year · Custom. See `resolvePreset` below for the exact contract each
 * preset pins (documented in full in `laporan-period.test.ts`, which was
 * authored before this implementation existed).
 */
export type ReportRangePreset =
  | "thisMonth"
  | "lastMonth"
  | "last3Months"
  | "last6Months"
  | "last12Months"
  | "thisYear"
  | "lastYear"
  | "custom";

/** One endpoint of an explicit `custom` preset range. */
export interface CustomPresetBound {
  year: number;
  month: number;
  day: number;
}

/** The explicit range a `custom` preset requires — there is no default. */
export interface CustomPresetRange {
  start: CustomPresetBound;
  end: CustomPresetBound;
}

/**
 * Reads the WIB (UTC+7) wall-clock year/month/day a UTC instant represents,
 * by shifting the instant forward by the fixed WIB offset and reading its
 * UTC components — never a local `Date` getter, so this is identical
 * regardless of `process.env.TZ` (mirrors `wibWallClockToIso`'s own
 * Date.UTC-only construction above).
 */
function wibCalendarParts(instant: Date): {
  year: number;
  month: number;
  day: number;
} {
  const shifted = new Date(instant.getTime() + WIB_UTC_OFFSET_MINUTES * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** Shifts a (year, 1-12 month) pair by `deltaMonths`, rolling the year over
 * in either direction (handles negative deltas crossing a January/December
 * boundary, including across multiple years for last12Months). */
function shiftMonth(
  year: number,
  month: number,
  deltaMonths: number,
): { year: number; month: number } {
  const total0 = year * 12 + (month - 1) + deltaMonths;
  const targetYear = Math.floor(total0 / 12);
  const targetMonthIndex0 = ((total0 % 12) + 12) % 12;
  return { year: targetYear, month: targetMonthIndex0 + 1 };
}

/**
 * Pure mapper: a date-range preset → ISO `startDate`/`endDate` bounds,
 * pinned to WIB exactly like `getPeriodDateRange`/`getYearDateRange` above
 * (Date.UTC arithmetic only — never the environment's local offset, so the
 * result is identical under any `process.env.TZ`).
 *
 * - `thisMonth`/`thisYear`/`last3/6/12Months` run **to date**: they end at
 *   TODAY's last WIB instant, not the end of the calendar month/year.
 * - `lastMonth`/`lastYear` are the full, completed prior period.
 * - `last3/6/12Months` start on `now`'s WIB day-of-month N months back,
 *   clamped into the target month via `clampDayToMonth` (leap-year aware).
 * - `custom` requires an explicit `{ start, end }` range — there is no
 *   default "custom" window, so a missing range throws rather than
 *   silently picking one.
 */
export function resolvePreset(
  preset: ReportRangePreset,
  now: Date = new Date(),
  customRange?: CustomPresetRange,
): { startDate: string; endDate: string } {
  const today = wibCalendarParts(now);

  switch (preset) {
    case "thisMonth": {
      return {
        startDate: wibWallClockToIso(
          today.year,
          today.month - 1,
          1,
          0,
          0,
          0,
          0,
        ),
        endDate: wibWallClockToIso(
          today.year,
          today.month - 1,
          today.day,
          23,
          59,
          59,
          999,
        ),
      };
    }
    case "lastMonth": {
      const target = shiftMonth(today.year, today.month, -1);
      const lastDay = daysInMonth(target.year, target.month);
      return {
        startDate: wibWallClockToIso(
          target.year,
          target.month - 1,
          1,
          0,
          0,
          0,
          0,
        ),
        endDate: wibWallClockToIso(
          target.year,
          target.month - 1,
          lastDay,
          23,
          59,
          59,
          999,
        ),
      };
    }
    case "last3Months":
    case "last6Months":
    case "last12Months": {
      const monthsBack =
        preset === "last3Months" ? 3 : preset === "last6Months" ? 6 : 12;
      const target = shiftMonth(today.year, today.month, -monthsBack);
      const startDay = clampDayToMonth(target.year, target.month, today.day);
      return {
        startDate: wibWallClockToIso(
          target.year,
          target.month - 1,
          startDay,
          0,
          0,
          0,
          0,
        ),
        endDate: wibWallClockToIso(
          today.year,
          today.month - 1,
          today.day,
          23,
          59,
          59,
          999,
        ),
      };
    }
    case "thisYear": {
      return {
        startDate: wibWallClockToIso(today.year, 0, 1, 0, 0, 0, 0),
        endDate: wibWallClockToIso(
          today.year,
          today.month - 1,
          today.day,
          23,
          59,
          59,
          999,
        ),
      };
    }
    case "lastYear": {
      return getYearDateRange(today.year - 1);
    }
    case "custom": {
      if (!customRange) {
        throw new Error(
          "A custom date range requires an explicit start and end date.",
        );
      }
      const { start, end } = customRange;
      const startDate = wibWallClockToIso(
        start.year,
        start.month - 1,
        clampDayToMonth(start.year, start.month, start.day),
        0,
        0,
        0,
        0,
      );
      const endDate = wibWallClockToIso(
        end.year,
        end.month - 1,
        clampDayToMonth(end.year, end.month, end.day),
        23,
        59,
        59,
        999,
      );
      // EPIC-023 Task B retry (MEDIUM) — an inverted range (end before
      // start) used to silently produce `startDate > endDate`, which every
      // downstream query (`occurredAt: { gte: startDate, lte: endDate }`)
      // treats as "match nothing" instead of a clear error. Fail loudly
      // instead of returning a range no caller can use correctly.
      if (new Date(endDate).getTime() < new Date(startDate).getTime()) {
        throw new Error(
          "A custom date range's end must be on or after its start.",
        );
      }
      return { startDate, endDate };
    }
    default: {
      const exhaustiveCheck: never = preset;
      throw new Error(
        `Unknown report range preset: ${String(exhaustiveCheck)}`,
      );
    }
  }
}
