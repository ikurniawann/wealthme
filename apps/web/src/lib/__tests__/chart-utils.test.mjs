import { test } from "node:test";
import assert from "node:assert/strict";

// RED gate: import the function that doesn't exist yet.
// This will throw MODULE_NOT_FOUND until chart-utils.ts is created and compiled.
const { buildNetWorthTrendPath } = await import("../chart-utils.js").catch(
  () => ({ buildNetWorthTrendPath: undefined }),
);

test("returns empty paths when income array is empty", () => {
  assert.ok(
    buildNetWorthTrendPath !== undefined,
    "buildNetWorthTrendPath must be exported from lib/chart-utils",
  );
  const result = buildNetWorthTrendPath([], [], 320, 90);
  assert.equal(result.linePath, "");
  assert.deepStrictEqual(result.points, []);
});

test("generates one SVG point per month", () => {
  assert.ok(buildNetWorthTrendPath !== undefined);
  const income = [1000, 1200, 1100, 1300, 1400, 1500];
  const expense = [800, 900, 1000, 1100, 900, 1000];
  const result = buildNetWorthTrendPath(income, expense, 320, 90);
  assert.equal(result.points.length, 6);
});

test("y decreases as cumulative net worth grows (SVG y-axis is inverted)", () => {
  assert.ok(buildNetWorthTrendPath !== undefined);
  const income = [1000, 1000, 1000];
  const expense = [500, 500, 500]; // net +500 every month
  const result = buildNetWorthTrendPath(income, expense, 320, 90);
  const ys = result.points.map((p) => p.y);
  assert.ok(ys[0] > ys[1], `y[0]=${ys[0]} should be > y[1]=${ys[1]}`);
  assert.ok(ys[1] > ys[2], `y[1]=${ys[1]} should be > y[2]=${ys[2]}`);
});

test("first x=0 and last x=svgWidth", () => {
  assert.ok(buildNetWorthTrendPath !== undefined);
  const income = [1000, 1200];
  const expense = [800, 900];
  const result = buildNetWorthTrendPath(income, expense, 320, 90);
  assert.equal(result.points[0].x, 0);
  assert.equal(result.points[result.points.length - 1].x, 320);
});

test("handles all-zero cashflow with a flat line at mid-height", () => {
  assert.ok(buildNetWorthTrendPath !== undefined);
  const zeros = [0, 0, 0, 0, 0, 0];
  const result = buildNetWorthTrendPath(zeros, zeros, 320, 90);
  const ys = result.points.map((p) => p.y);
  const allSame = ys.every((y) => y === ys[0]);
  assert.ok(allSame, "all y values should be equal for flat cashflow");
});
