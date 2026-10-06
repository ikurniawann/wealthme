#!/usr/bin/env node
// Compare two measure.mjs results and separate real changes from run-to-run noise.
// Usage: node compare.mjs <before-dir> <after-dir>      e.g. perf/before perf/after-1
// A metric only counts as changed when the after-median falls outside the before min–max
// AND moves at least 10% (CLS: 0.02 absolute; transfer sizes: 1%) AND clears a small absolute
// floor (10 ms, 2 frames, 2 points, 1 MB). Lower is better for every metric.
// Prints a markdown table and saves it next to the after results.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [beforeDir, afterDir] = process.argv.slice(2);
if (!beforeDir || !afterDir) {
  console.error("usage: node compare.mjs <before-dir> <after-dir>");
  process.exit(1);
}
const load = (d) => JSON.parse(readFileSync(join(d, "summary.json"), "utf8"));
const B = load(beforeDir),
  A = load(afterDir);

const ROWS = {
  lcpMs: "LCP ms",
  lcpTtfbMs: "LCP: TTFB",
  lcpLoadDelayMs: "LCP: load delay",
  lcpLoadDurationMs: "LCP: load duration",
  lcpRenderDelayMs: "LCP: render delay",
  cls: "CLS",
  inpMs: "INP ms",
  inpInputDelayMs: "INP: input delay",
  inpProcessingMs: "INP: processing",
  inpPresentationMs: "INP: presentation",
  loadBlockingMs: "Load blocking ms",
  flowLongFrames: "Flow long frames",
  flowBlockingMs: "Flow blocking ms",
  flowForcedLayoutMs: "Flow forced layout ms",
  flowDroppedFramePct: "Flow dropped frames %",
  flowFrameP95Ms: "Flow frame p95 ms",
  flowMainThreadMsPerSec: "Flow main thread ms/s",
  flowLayouts: "Flow layouts",
  flowStyleRecalcs: "Flow style recalcs",
  transferKB: "Transfer KB",
  scriptKB: "Script KB",
  imageKB: "Image KB",
  mediaKB: "Media KB",
  fontKB: "Font KB",
  cssKB: "CSS KB",
  jsHeapMB: "JS heap MB",
};
const kind = (k) =>
  k === "cls" ? "cls" : k.endsWith("KB") ? "bytes" : "other";
// Smallest absolute change worth reporting, so tiny values can't swing by 10% and count.
const floor = (k) =>
  k === "cls"
    ? 0.02
    : k.endsWith("KB")
      ? 1
      : k.endsWith("MB")
        ? 1
        : k.endsWith("Pct")
          ? 2
          : ["flowLongFrames", "flowLayouts", "flowStyleRecalcs"].includes(k)
            ? 2
            : 10;

function judge(k, b, a) {
  const delta = a.median - b.median;
  const rel = b.median
    ? delta / b.median
    : delta
      ? Math.sign(delta) * Infinity
      : 0;
  const outside = a.median < b.min || a.median > b.max;
  const big =
    Math.abs(delta) >= floor(k) &&
    (kind(k) === "cls" || Math.abs(rel) >= (kind(k) === "bytes" ? 0.01 : 0.1));
  const change =
    kind(k) === "cls"
      ? `${delta > 0 ? "+" : ""}${delta.toFixed(3)}`
      : Number.isFinite(rel)
        ? `${rel > 0 ? "+" : ""}${Math.round(rel * 100)}%`
        : `${delta > 0 ? "+" : ""}${delta}`;
  return {
    change,
    verdict: outside && big ? (delta < 0 ? "better" : "**WORSE**") : "noise",
  };
}

const notes = [];
for (const f of [
  "url",
  "profile",
  "cpu",
  "network",
  "reducedMotion",
  "headed",
]) {
  if (String(B[f]) !== String(A[f]))
    notes.push(`⚠ not comparable: ${f} differs (${B[f]} vs ${A[f]})`);
}
if (B.flow.join(" ") !== A.flow.join(" "))
  notes.push(
    `⚠ not comparable: flow differs (${B.flow.join(" ")} vs ${A.flow.join(" ")})`,
  );
if (B.chrome?.split(".")[0] !== A.chrome?.split(".")[0])
  notes.push(`⚠ Chrome version changed (${B.chrome} vs ${A.chrome})`);

const bi = B.inventory,
  ai = A.inventory;
if (bi.scrollTriggers !== ai.scrollTriggers)
  notes.push(
    `⚠ ScrollTrigger count changed: ${bi.scrollTriggers} → ${ai.scrollTriggers}. Confirm in the experience check that no scroll effect was lost.`,
  );
const lost = bi.cssAnimationNames.filter(
  (n) => !ai.cssAnimationNames.includes(n),
);
if (lost.length)
  notes.push(
    `⚠ CSS animations/transitions no longer seen: ${lost.join(", ")}. Confirm this was intended.`,
  );
if (B.attribution.lcpElement !== A.attribution.lcpElement)
  notes.push(
    `LCP element changed: ${B.attribution.lcpElement} → ${A.attribution.lcpElement}`,
  );

const lines = [
  `## ${B.label} → ${A.label}`,
  `${A.profile}, cpu ${A.cpu}x, network ${A.network}, runs ${B.runs}/${A.runs}, flow: ${A.flow.join(" ")}`,
  "",
  "| Metric | Before median (min–max) | After median (min–max) | Change | Verdict |",
  "|---|---|---|---|---|",
];
const tally = { better: 0, "**WORSE**": 0, noise: 0 };
for (const [k, name] of Object.entries(ROWS)) {
  const b = B.metrics[k],
    a = A.metrics[k];
  if (!b || !a) continue;
  if (b.median === 0 && a.median === 0 && b.max === 0 && a.max === 0) continue;
  const { change, verdict } = judge(k, b, a);
  tally[verdict]++;
  lines.push(
    `| ${name} | ${b.median} (${b.min}–${b.max}) | ${a.median} (${a.min}–${a.max}) | ${change} | ${verdict} |`,
  );
}
lines.push(
  "",
  `${tally.better} better, ${tally["**WORSE**"]} worse, ${tally.noise} within noise.`,
);
if (notes.length) lines.push("", ...notes.map((n) => `- ${n}`));
lines.push(
  "",
  "Keep the change only if the target metric is better, nothing important is worse, and the experience check passes. Neutral is a revert.",
);

const out = lines.join("\n");
console.log(out);
writeFileSync(join(afterDir, `compare-vs-${B.label}.md`), out + "\n");
