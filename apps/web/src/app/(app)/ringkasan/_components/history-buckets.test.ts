/**
 * Revisi E — the trend used to bucket every range by calendar month, so `1m`
 * collapsed to one point and hit the "< 2 points" empty state. Jest runs in
 * Asia/Jakarta (jest.config.ts); points sit at 05:00Z = 12:00 WIB, the same day.
 */

import type { NetWorthHistoryPointDto } from "@wealthme/contracts";

import {
  bucketHistoryPoints,
  effectiveGranularity,
  granularityForRange,
  trendCategoryLabel,
} from "./history-buckets";

function point(isoDate: string, netWorth: string): NetWorthHistoryPointDto {
  return {
    capturedAt: `${isoDate}T05:00:00.000Z`,
    totalCash: netWorth,
    totalInvestments: "0",
    totalAssets: "0",
    totalLiabilities: "0",
    netWorth,
  };
}

function dailyPoints(
  startIso: string,
  count: number,
): NetWorthHistoryPointDto[] {
  const start = Date.parse(`${startIso}T05:00:00.000Z`);
  return Array.from({ length: count }, (_, i) =>
    point(
      new Date(start + i * 86_400_000).toISOString().slice(0, 10),
      String(1000 + i),
    ),
  );
}

const dayOf = (p: NetWorthHistoryPointDto) => p.capturedAt.slice(0, 10);

describe("granularityForRange", () => {
  it.each([
    ["1m", "day"],
    ["3m", "day"],
    ["6m", "week"],
    ["12m", "month"],
    ["ytd", "month"],
    ["all", "month"],
    ["custom", "month"],
  ] as const)("%s → %s", (range, expected) => {
    expect(granularityForRange(range)).toBe(expected);
  });
});

describe("bucketHistoryPoints", () => {
  it("returns [] for no points", () => {
    expect(bucketHistoryPoints([], "1m")).toEqual([]);
  });

  it("1m keeps one point per day, even across a month boundary", () => {
    const points = dailyPoints("2026-08-27", 30); // 27 Aug → 25 Sep
    const out = bucketHistoryPoints(points, "1m");
    expect(out).toHaveLength(30);
    expect(dayOf(out[0]!)).toBe("2026-08-27");
    expect(dayOf(out[29]!)).toBe("2026-09-25");
  });

  it("daily buckets keep the later point when a day has two (snapshot + live point)", () => {
    const snapshot = point("2026-09-25", "500");
    const live = {
      ...point("2026-09-25", "600"),
      capturedAt: "2026-09-25T09:00:00.000Z", // 16:00 WIB, same day
    };
    expect(bucketHistoryPoints([snapshot, live], "3m")).toEqual([live]);
  });

  it("6m keeps the last point of each ISO (Monday-start) week", () => {
    const points = dailyPoints("2026-09-07", 14); // Mon 7 Sep → Sun 20 Sep
    const out = bucketHistoryPoints(points, "6m");
    expect(out.map(dayOf)).toEqual(["2026-09-13", "2026-09-20"]);
  });

  it("6m keeps an ISO week that spans New Year as one bucket", () => {
    const points = dailyPoints("2026-12-28", 8); // Mon 28 Dec → Mon 4 Jan
    const out = bucketHistoryPoints(points, "6m");
    expect(out.map(dayOf)).toEqual(["2027-01-03", "2027-01-04"]);
  });

  it.each(["12m", "ytd", "all", "custom"] as const)(
    "%s keeps the closing point of each calendar month",
    (range) => {
      const points = dailyPoints("2026-07-21", 54); // 21 Jul → 12 Sep (live evidence)
      const out = bucketHistoryPoints(points, range);
      expect(out.map(dayOf)).toEqual([
        "2026-07-31",
        "2026-08-31",
        "2026-09-12",
      ]);
    },
  );

  // A brand-new family's history can sit entirely inside one calendar month
  // (or one ISO week). Monthly bucketing would then collapse it to a single
  // point and trip the "not enough points" empty state, even though there
  // is a real day-to-day trend to show.
  it("12m falls back all the way to daily buckets when every point falls in one ISO week", () => {
    const points = dailyPoints("2026-09-07", 5); // Mon–Fri, one week, one month
    const out = bucketHistoryPoints(points, "12m");
    expect(out.map(dayOf)).toEqual([
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
    ]);
    expect(effectiveGranularity(points, "12m")).toBe("day");
  });

  it("12m falls back to weekly buckets when the month's points span 3 ISO weeks", () => {
    const points = dailyPoints("2026-09-06", 10); // Sun 6 Sep → Tue 15 Sep, one month
    const out = bucketHistoryPoints(points, "12m");
    expect(out.map(dayOf)).toEqual(["2026-09-06", "2026-09-13", "2026-09-15"]);
    expect(effectiveGranularity(points, "12m")).toBe("week");
  });
});

describe("trendCategoryLabel", () => {
  const capturedAt = "2026-07-21T05:00:00.000Z";

  it("day and week labels carry the day of month so daily ticks are distinct", () => {
    expect(trendCategoryLabel(capturedAt, "day", "id-ID")).toMatch(/21/);
    expect(trendCategoryLabel(capturedAt, "week", "id-ID")).toMatch(/21/);
  });

  it("month labels stay month + 2-digit year", () => {
    const label = trendCategoryLabel(capturedAt, "month", "id-ID");
    expect(label).toMatch(/Jul/);
    expect(label).toMatch(/26/);
    expect(label).not.toMatch(/21/);
  });
});
