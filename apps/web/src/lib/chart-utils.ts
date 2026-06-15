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
