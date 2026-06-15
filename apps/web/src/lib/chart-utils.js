"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDonutSegments = buildDonutSegments;
exports.buildNetWorthTrendPath = buildNetWorthTrendPath;
function polarToCart(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function donutArc(cx, cy, outerR, innerR, startDeg, endDeg) {
  const sweep = Math.min(endDeg - startDeg, 359.99);
  const end = startDeg + sweep;
  const oS = polarToCart(cx, cy, outerR, startDeg);
  const oE = polarToCart(cx, cy, outerR, end);
  const iS = polarToCart(cx, cy, innerR, end);
  const iE = polarToCart(cx, cy, innerR, startDeg);
  const large = sweep > 180 ? 1 : 0;
  return [
    `M ${oS.x} ${oS.y}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${oE.x} ${oE.y}`,
    `L ${iS.x} ${iS.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${iE.x} ${iE.y}`,
    "Z",
  ].join(" ");
}
/**
 * Builds SVG donut-chart path segments from a list of items with percentages.
 * Items with pct=0 are skipped. Angles start at 12 o'clock (−90°).
 */
function buildDonutSegments(items, cx = 60, cy = 60, outerR = 50, innerR = 30) {
  const active = items.filter((i) => i.pct > 0);
  if (active.length === 0) return [];
  const total = active.reduce((s, i) => s + i.pct, 0);
  const segments = [];
  let startDeg = -90;
  for (const item of active) {
    const sweep = (item.pct / total) * 360;
    const endDeg = startDeg + sweep;
    segments.push({
      path: donutArc(cx, cy, outerR, innerR, startDeg, endDeg),
      color: item.color,
      label: item.label,
      pct: item.pct,
    });
    startDeg = endDeg;
  }
  return segments;
}
/**
 * Converts 6-month income/expense cashflow arrays into SVG path data for a
 * cumulative net worth trend line.
 *
 * Algorithm:
 *  1. Compute monthly net = income[i] - expense[i]
 *  2. Accumulate cumulative net worth change
 *  3. Map to SVG coordinates (y-axis inverted: higher value = lower y)
 *  4. Emit smooth cubic-bezier path segments
 */
function buildNetWorthTrendPath(
  income,
  expense,
  svgWidth,
  svgHeight,
  padding = 8,
) {
  if (income.length === 0) {
    return { linePath: "", areaPath: "", points: [] };
  }
  const cumulative = [];
  let running = 0;
  for (let i = 0; i < income.length; i++) {
    running += (income[i] ?? 0) - (expense[i] ?? 0);
    cumulative.push(running);
  }
  const min = Math.min(...cumulative, 0);
  const max = Math.max(...cumulative, 0);
  const range = max - min || 1;
  const n = cumulative.length;
  const innerH = svgHeight - padding * 2;
  const points = cumulative.map((v, i) => ({
    x: n === 1 ? svgWidth / 2 : (i / (n - 1)) * svgWidth,
    y: padding + ((max - v) / range) * innerH,
  }));
  const linePath = points.reduce((path, pt, i) => {
    if (i === 0) return `M${pt.x},${pt.y}`;
    const prev = points[i - 1];
    const cpX = (prev.x + pt.x) / 2;
    return `${path} C${cpX},${prev.y} ${cpX},${pt.y} ${pt.x},${pt.y}`;
  }, "");
  const first = points[0];
  const last = points[points.length - 1];
  const areaPath = `${linePath} L${last.x},${svgHeight} L${first.x},${svgHeight} Z`;
  return { linePath, areaPath, points };
}
