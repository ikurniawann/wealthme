/**
 * EPIC-022 B4 — `buildNetWorthTrendPath` now plots a series of real,
 * point-in-time net worth values as-is, instead of a cumulative running sum
 * of income − expense starting at zero (which is cumulative cashflow, not
 * net worth). See `apps/web/src/app/(app)/ringkasan/page.tsx` for the caller
 * that now feeds it `/dashboard/net-worth/history` snapshots.
 *
 * This file replaces the legacy `apps/web/src/lib/__tests__/chart-utils.
 * test.mjs` (pre-fix income/expense signature, `node --test` only, not part
 * of any gate script) and `.../donut-segments.test.mjs` (adversarial review
 * LOW finding — both imported the now-deleted `chart-utils.js` CJS mirror
 * and are removed rather than left as dead artifacts); `buildDonutSegments`
 * coverage below carries the same cases.
 */

import { buildDonutSegments, buildNetWorthTrendPath } from "./chart-utils";

describe("buildNetWorthTrendPath", () => {
  it("returns empty paths/points for an empty series", () => {
    const result = buildNetWorthTrendPath([], 320, 90);
    expect(result.linePath).toBe("");
    expect(result.areaPath).toBe("");
    expect(result.points).toEqual([]);
  });

  it("plots one point per input value, evenly spaced across the width", () => {
    const values = [1_000_000, 1_200_000, 900_000, 1_500_000];
    const result = buildNetWorthTrendPath(values, 320, 90);
    expect(result.points).toHaveLength(4);
    expect(result.points[0]!.x).toBe(0);
    expect(result.points[3]!.x).toBe(320);
  });

  it("does NOT cumulative-sum the input — the highest raw value maps to the lowest y", () => {
    // A strictly increasing net worth series: the last (highest) value must
    // sit at the top of the chart (smallest y), not at some larger
    // cumulative-sum height than the series itself ever reached.
    const values = [10_000_000, 10_000_000, 10_000_000];
    const result = buildNetWorthTrendPath(values, 320, 90, 8);
    // A flat (unchanging) series should render as a flat line — every point
    // at the same y. A cumulative-sum bug would instead show a rising line.
    const ys = result.points.map((p) => p.y);
    expect(new Set(ys).size).toBe(1);
  });

  it("a declining net-worth series produces an increasing y (chart trends downward)", () => {
    const values = [5_000_000, 3_000_000, 1_000_000];
    const result = buildNetWorthTrendPath(values, 320, 90);
    const [p0, p1, p2] = result.points;
    expect(p0!.y).toBeLessThan(p1!.y);
    expect(p1!.y).toBeLessThan(p2!.y);
  });

  it("handles a single point without dividing by zero", () => {
    const result = buildNetWorthTrendPath([2_000_000], 320, 90);
    expect(result.points).toHaveLength(1);
    expect(result.points[0]!.x).toBe(160);
    expect(Number.isFinite(result.points[0]!.y)).toBe(true);
  });

  it("a flat series (min === max) does not divide by zero", () => {
    const result = buildNetWorthTrendPath([1_000_000, 1_000_000], 320, 90);
    expect(result.points.every((p) => Number.isFinite(p.y))).toBe(true);
  });
});

describe("buildDonutSegments", () => {
  it("returns empty array for empty input", () => {
    expect(buildDonutSegments([])).toEqual([]);
  });

  it("returns empty array when all items have pct=0", () => {
    const items = [
      { label: "Rekening", pct: 0, color: "#06B6D4" },
      { label: "Tunai", pct: 0, color: "#6B7280" },
    ];
    expect(buildDonutSegments(items)).toEqual([]);
  });

  it("returns one segment for a single 100% item", () => {
    const items = [{ label: "Rekening", pct: 100, color: "#06B6D4" }];
    const result = buildDonutSegments(items);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ label: "Rekening", color: "#06B6D4" });
    expect(result[0]!.path.length).toBeGreaterThan(0);
  });

  it("returns two segments for a 50/50 split", () => {
    const items = [
      { label: "Rekening", pct: 50, color: "#06B6D4" },
      { label: "Investasi", pct: 50, color: "#4F46E5" },
    ];
    const result = buildDonutSegments(items);
    expect(result).toHaveLength(2);
    expect(result[0]!.label).toBe("Rekening");
    expect(result[1]!.label).toBe("Investasi");
    expect(result[0]!.pct).toBe(50);
    expect(result[1]!.pct).toBe(50);
  });

  it("preserves colors from input", () => {
    const colors = ["#06B6D4", "#4F46E5", "#10B981"];
    const items = colors.map((color, i) => ({
      label: `Item ${i}`,
      pct: 33,
      color,
    }));
    const result = buildDonutSegments(items);
    expect(result.map((s) => s.color)).toEqual(colors);
  });

  it("skips zero-pct items from a mixed list", () => {
    const items = [
      { label: "A", pct: 60, color: "#aaa" },
      { label: "B", pct: 0, color: "#bbb" },
      { label: "C", pct: 40, color: "#ccc" },
    ];
    const result = buildDonutSegments(items);
    expect(result.map((s) => s.label)).toEqual(["A", "C"]);
  });
});
