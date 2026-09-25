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
export function bucketHistoryPoints(
  points: NetWorthHistoryPointDto[],
  range: TrendRangeKey,
): NetWorthHistoryPointDto[] {
  const granularity = granularityForRange(range);
  const lastByKey = new Map<string, NetWorthHistoryPointDto>();
  for (const point of points) {
    lastByKey.set(bucketKey(new Date(point.capturedAt), granularity), point);
  }
  return [...lastByKey.values()];
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
