/**
 * Like-for-like month comparison shared by Beranda (hero KPIs, mobile tile)
 * and Laporan: while the current month is still running, its month-to-date
 * total is compared with the SAME day-of-month window of the prior month
 * (1–6 Okt vs 1–6 Sep), never with a full prior month — a 6-day spend
 * against a 30-day spend would read as false good news.
 *
 * Pure and framework-free; the prior window's totals come from
 * `usePriorWindowTotals`.
 */

import {
  likeForLikeWindow,
  wibDateOf,
  type LikeForLikeWindow,
} from "./laporan-period";

export type MonthMetric = "income" | "expense" | "net";

export interface PriorWindowTotals {
  income: number;
  expense: number;
  net: number;
}

/** What a surface needs to compare the running month like-for-like. */
export interface MonthCompareBase {
  /** The day-aligned window, or null once the month is complete. */
  window: LikeForLikeWindow | null;
  /** Prior window totals, or undefined while loading / on error. */
  prior: PriorWindowTotals | undefined;
}

/**
 * - `window`: running month vs the same days of the prior month (honest).
 * - `window-pending`: running month, but the prior window is not available
 *   (loading / failed) so the full prior month is the only base left.
 * - `full`: the month is complete — full vs full is already like-for-like.
 */
export type MonthCompareBasis = "window" | "window-pending" | "full";

export interface MonthComparison {
  current: number;
  previous: number;
  basis: MonthCompareBasis;
  window: LikeForLikeWindow | null;
}

/** The window for the month `now` falls in (WIB), null on its last day. */
export function currentMonthWindow(now: Date): LikeForLikeWindow | null {
  return likeForLikeWindow({
    anchorEnd: now.toISOString(),
    pointCount: 1,
    pointIndex: 0,
    now,
  });
}

/**
 * Picks the base for the latest month of a monthly `series`: the prior
 * day-aligned window when the month is running and its totals are loaded,
 * otherwise the full previous month. `null` when there is nothing to compare.
 */
export function selectMonthComparison(
  series: readonly number[] | undefined,
  metric: MonthMetric,
  base?: MonthCompareBase,
): MonthComparison | null {
  if (!series || series.length === 0) return null;
  const current = series[series.length - 1]!;
  const window = base?.window ?? null;
  if (window && base?.prior) {
    return {
      current,
      previous: base.prior[metric],
      basis: "window",
      window,
    };
  }
  if (series.length < 2) return null;
  return {
    current,
    previous: series[series.length - 2]!,
    basis: window ? "window-pending" : "full",
    window,
  };
}

/** Short month name of a (year, 1-12 month) pair in `locale`. */
function shortMonth(year: number, month: number, locale: string): string {
  return new Date(year, month - 1, 1).toLocaleDateString(locale, {
    month: "short",
  });
}

export interface MonthCaptionLabels {
  /** "{current} vs {previous}" */
  window: string;
  /** "{month} penuh" — a whole month, named. */
  fullMonth: string;
  /** Caption when both sides are whole months ("dari bulan lalu"). */
  lastMonth: string;
}

/**
 * Short caption naming the compared window: "1–6 Okt vs 1–6 Sep" (window),
 * "1–6 Okt vs Sep penuh" (prior window unavailable), or the plain
 * `lastMonth` caption when both months are complete.
 */
export function monthCompareCaption(
  comparison: Pick<MonthComparison, "basis" | "window">,
  labels: MonthCaptionLabels,
  locale: string,
): string {
  const { basis, window } = comparison;
  if (basis === "full" || !window) return labels.lastMonth;
  // The prior window starts on the 1st of the prior month (WIB).
  const [py, pm] = wibDateOf(window.priorStartDate).split("-").map(Number);
  const prior = shortMonth(py!, pm!, locale);
  const current = shortMonth(
    pm === 12 ? py! + 1 : py!,
    pm === 12 ? 1 : pm! + 1,
    locale,
  );
  const currentTag = `1–${window.cutoffDay} ${current}`;
  const previousTag =
    basis === "window"
      ? `1–${window.priorCutoffDay} ${prior}`
      : labels.fullMonth.replace("{month}", prior);
  return labels.window
    .replace("{current}", currentTag)
    .replace("{previous}", previousTag);
}
