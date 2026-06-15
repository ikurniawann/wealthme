import { test } from "node:test";
import assert from "node:assert/strict";

// RED gate: buildDonutSegments doesn't exist yet in chart-utils.js
const mod = await import("../chart-utils.js").catch(() => ({}));
const buildDonutSegments = mod.buildDonutSegments;

test("returns empty array for empty input", () => {
  assert.ok(
    typeof buildDonutSegments === "function",
    "buildDonutSegments must be exported from lib/chart-utils",
  );
  const result = buildDonutSegments([]);
  assert.deepStrictEqual(result, []);
});

test("returns empty array when all items have pct=0", () => {
  assert.ok(typeof buildDonutSegments === "function");
  const items = [
    { label: "Rekening", pct: 0, color: "#06B6D4" },
    { label: "Tunai", pct: 0, color: "#6B7280" },
  ];
  assert.deepStrictEqual(buildDonutSegments(items), []);
});

test("returns one segment for a single 100% item", () => {
  assert.ok(typeof buildDonutSegments === "function");
  const items = [{ label: "Rekening", pct: 100, color: "#06B6D4" }];
  const result = buildDonutSegments(items);
  assert.equal(result.length, 1);
  assert.equal(result[0].color, "#06B6D4");
  assert.equal(result[0].label, "Rekening");
  assert.equal(typeof result[0].path, "string");
  assert.ok(result[0].path.length > 0, "path must be non-empty");
});

test("returns two segments for 50/50 split", () => {
  assert.ok(typeof buildDonutSegments === "function");
  const items = [
    { label: "Rekening", pct: 50, color: "#06B6D4" },
    { label: "Investasi", pct: 50, color: "#4F46E5" },
  ];
  const result = buildDonutSegments(items);
  assert.equal(result.length, 2);
  assert.equal(result[0].label, "Rekening");
  assert.equal(result[1].label, "Investasi");
  assert.equal(result[0].pct, 50);
  assert.equal(result[1].pct, 50);
});

test("preserves colors from input", () => {
  assert.ok(typeof buildDonutSegments === "function");
  const colors = ["#06B6D4", "#4F46E5", "#10B981"];
  const items = colors.map((color, i) => ({
    label: `Item ${i}`,
    pct: 33,
    color,
  }));
  const result = buildDonutSegments(items);
  assert.equal(result.length, 3);
  result.forEach((seg, i) => assert.equal(seg.color, colors[i]));
});

test("skips zero-pct items from mixed list", () => {
  assert.ok(typeof buildDonutSegments === "function");
  const items = [
    { label: "A", pct: 60, color: "#aaa" },
    { label: "B", pct: 0, color: "#bbb" },
    { label: "C", pct: 40, color: "#ccc" },
  ];
  const result = buildDonutSegments(items);
  assert.equal(result.length, 2);
  assert.equal(result[0].label, "A");
  assert.equal(result[1].label, "C");
});
