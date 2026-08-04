/**
 * EPIC-022 B4 — `buildNetWorthTrendPath` now plots a series of real,
 * point-in-time net worth values as-is, instead of a cumulative running sum
 * of income − expense starting at zero (which is cumulative cashflow, not
 * net worth). See `apps/web/src/app/(app)/ringkasan/page.tsx` for the caller
 * that now feeds it `/dashboard/net-worth/history` snapshots.
 *
 * (The legacy `apps/web/src/lib/__tests__/chart-utils.test.mjs` targets the
 * pre-fix income/expense signature via `node --test`, which is not part of
 * any gate script (`scripts/test.sh` runs `turbo run test`, i.e. Jest) — it
 * is intentionally left untouched here.)
 */

import { buildNetWorthTrendPath } from "./chart-utils";

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
