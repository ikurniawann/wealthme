import type { NetWorthHistoryPointDto } from "@wealthme/contracts";

export type TrendRangeKey =
  | "1m"
  | "3m"
  | "6m"
  | "12m"
  | "ytd"
  | "all"
  | "custom";

export type HistoryGranularity = "day" | "week" | "month";

export function granularityForRange(range: TrendRangeKey): HistoryGranularity {
  if (range === "1m" || range === "3m") return "day";
  if (range === "6m") return "week";
  return "month";
}

function bucketKey(date: Date, granularity: HistoryGranularity): string {
  if (granularity === "month") {
    return `${date.getFullYear()}-${date.getMonth()}`;
  }
  if (granularity === "day") {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }
  // An ISO week is identified by its Monday's calendar date.
  const monday = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() - ((date.getDay() + 6) % 7),
  );
  return `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
}

/** Keeps the last (closing) point per bucket; `points` must be ascending. */
function bucketByGranularity(
  points: NetWorthHistoryPointDto[],
  granularity: HistoryGranularity,
): NetWorthHistoryPointDto[] {
  const lastByKey = new Map<string, NetWorthHistoryPointDto>();
  for (const point of points) {
    lastByKey.set(bucketKey(new Date(point.capturedAt), granularity), point);
  }
  return [...lastByKey.values()];
}

/**
 * The granularity `bucketHistoryPoints` actually ends up using for `range`.
 * A new family's history can sit entirely inside one calendar month (or one
 * ISO week), so the range's nominal granularity (`granularityForRange`)
 * would collapse it to a single bucket and trip the "not enough points"
 * empty state even though there IS a real trend to show. Fall back to a
 * finer granularity — week, then day — until there are at least 2 buckets,
 * or until there is nothing finer left to try.
 */
export function effectiveGranularity(
  points: NetWorthHistoryPointDto[],
  range: TrendRangeKey,
): HistoryGranularity {
  const nominal = granularityForRange(range);
  if (points.length < 2) return nominal;
  if (bucketByGranularity(points, nominal).length >= 2) return nominal;
  if (bucketByGranularity(points, "week").length >= 2) return "week";
  return "day";
}

/** Keeps the last (closing) point per bucket; `points` must be ascending. */
export function bucketHistoryPoints(
  points: NetWorthHistoryPointDto[],
  range: TrendRangeKey,
): NetWorthHistoryPointDto[] {
  return bucketByGranularity(points, effectiveGranularity(points, range));
}

export function trendCategoryLabel(
  capturedAt: string,
  granularity: HistoryGranularity,
  dateLocale: string,
): string {
  return new Date(capturedAt).toLocaleDateString(
    dateLocale,
    granularity === "month"
      ? { month: "short", year: "2-digit" }
      : { day: "numeric", month: "short" },
  );
}
