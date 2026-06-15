export interface DonutSegment {
  path: string;
  color: string;
  label: string;
  pct: number;
}

function polarToCart(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutArc(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startDeg: number,
  endDeg: number,
): string {
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
export function buildDonutSegments(
  items: { label: string; pct: number; color: string }[],
  cx = 60,
  cy = 60,
  outerR = 50,
  innerR = 30,
): DonutSegment[] {
  const active = items.filter((i) => i.pct > 0);
  if (active.length === 0) return [];

  const total = active.reduce((s, i) => s + i.pct, 0);
  const segments: DonutSegment[] = [];
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

export interface TrendPathResult {
  linePath: string;
  areaPath: string;
  points: { x: number; y: number }[];
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
export function buildNetWorthTrendPath(
  income: number[],
  expense: number[],
  svgWidth: number,
  svgHeight: number,
  padding = 8,
): TrendPathResult {
  if (income.length === 0) {
    return { linePath: "", areaPath: "", points: [] };
  }

  const cumulative: number[] = [];
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
    const prev = points[i - 1]!;
    const cpX = (prev.x + pt.x) / 2;
    return `${path} C${cpX},${prev.y} ${cpX},${pt.y} ${pt.x},${pt.y}`;
  }, "");

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const areaPath = `${linePath} L${last.x},${svgHeight} L${first.x},${svgHeight} Z`;

  return { linePath, areaPath, points };
}
