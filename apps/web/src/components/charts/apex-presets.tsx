"use client";

import { useMemo } from "react";
import { ApexChart, useThemeRebuildToken } from "@/components/charts/apex-base";
import { ChartErrorBoundary } from "@/components/charts/chart-error";
import type { DonutSegment } from "@/components/charts/donut";
import {
  buildCashflowOptions,
  buildDonutOptions,
  buildHBarOptions,
  buildRadialOptions,
  buildSparklineOptions,
  buildTrendOptions,
  type TrendSeries,
} from "@/components/charts/apex-options";

/**
 * ApexCharts presets — EPIC-025 N3-A3. One component per recurring chart
 * shape in the app, ported from `docs/prototype/assets/charts.js:127-260`'s
 * named factories. Added ALONGSIDE the existing canvas/SVG chart components
 * (`bar-chart.tsx`, `sparkline.tsx`, `donut.tsx`) — nothing here is wired
 * into a page yet (that's N3-G).
 *
 * Every preset wraps its `<ApexChart />` in a `ChartErrorBoundary` (A4) so a
 * failed render degrades to a labeled fallback card instead of silent
 * blank space or an uncaught throw.
 *
 * Options/series are memoized with `useMemo`, keyed on the real reactive
 * inputs plus `useThemeRebuildToken()` (bumped once, module-wide, on an
 * actual theme flip — see `apex-base.tsx`) so a parent re-render does not
 * recompute the deep-merged options object or force an unnecessary redraw.
 *
 * Each preset accepts an optional `ariaLabel`, applied as `role="img"
 * aria-label={ariaLabel}` on the chart's wrapping container so screen readers
 * get a text alternative for the rendered SVG. `ariaLabel` defaults to the
 * same generic Indonesian label used for the error fallback — N3-G's
 * page-wiring MUST pass a real, data-specific label (e.g. "Arus kas 6 bulan
 * terakhir: pemasukan naik, pengeluaran turun") instead of relying on the
 * default.
 */

type CashflowChartProps = {
  months: string[];
  income: number[];
  expense: number[];
  height?: number;
  ariaLabel?: string;
};

/** Grouped income/expense bar chart. Ports `cashflow()`. */
export function CashflowChart({
  months,
  income,
  expense,
  height = 260,
  ariaLabel,
}: CashflowChartProps) {
  const rebuildToken = useThemeRebuildToken();
  const { options, series } = useMemo(
    () => buildCashflowOptions(months, income, expense),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuildToken forces a recompute on theme flip; the builder re-reads cssVar() internally rather than referencing it directly.
    [months, income, expense, rebuildToken],
  );
  return (
    <ChartErrorBoundary label="Grafik arus kas">
      <div role="img" aria-label={ariaLabel ?? "Grafik arus kas"}>
        <ApexChart
          type="bar"
          width="100%"
          height={height}
          options={options}
          series={series}
        />
      </div>
    </ChartErrorBoundary>
  );
}

type TrendChartProps = {
  categories: string[];
  series: TrendSeries[];
  height?: number;
  ariaLabel?: string;
};

/** Gradient-filled area trend chart. Ports `trend()`. */
export function TrendChart({
  categories,
  series,
  height = 250,
  ariaLabel,
}: TrendChartProps) {
  const rebuildToken = useThemeRebuildToken();
  const built = useMemo(
    () => buildTrendOptions(categories, series, height),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuildToken forces a recompute on theme flip; the builder re-reads cssVar() internally rather than referencing it directly.
    [categories, series, height, rebuildToken],
  );
  return (
    <ChartErrorBoundary label="Grafik tren">
      <div role="img" aria-label={ariaLabel ?? "Grafik tren"}>
        <ApexChart
          type="area"
          width="100%"
          height={height}
          options={built.options}
          series={built.series}
        />
      </div>
    </ChartErrorBoundary>
  );
}

type DonutChartProps = {
  /** The EXISTING `DonutSegment[]` shape from `components/charts/donut.tsx` — never redefined here. */
  segments: DonutSegment[];
  centerLabel?: string;
  height?: number;
  ariaLabel?: string;
};

/** Donut chart with a centered total. Accepts the existing `DonutSegment[]` shape. Ports `donut()`. */
export function DonutChart({
  segments,
  centerLabel = "Total",
  height = 232,
  ariaLabel,
}: DonutChartProps) {
  const rebuildToken = useThemeRebuildToken();
  const { options, series } = useMemo(
    () => buildDonutOptions(segments, centerLabel, height),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuildToken forces a recompute on theme flip; the builder re-reads cssVar() internally rather than referencing it directly.
    [segments, centerLabel, height, rebuildToken],
  );
  return (
    <ChartErrorBoundary label="Grafik donat">
      <div role="img" aria-label={ariaLabel ?? "Grafik donat"}>
        <ApexChart
          type="donut"
          width="100%"
          height={height}
          options={options}
          series={series}
        />
      </div>
    </ChartErrorBoundary>
  );
}

type SparklineChartProps = {
  data: number[];
  color?: string;
  height?: number;
  ariaLabel?: string;
};

/** Edge-to-edge area sparkline (`sparkline.enabled: true`). Ports `sparkline()`. */
export function SparklineChart({
  data,
  color,
  height = 56,
  ariaLabel,
}: SparklineChartProps) {
  const rebuildToken = useThemeRebuildToken();
  const { options, series } = useMemo(
    () => buildSparklineOptions(data, color, height),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuildToken forces a recompute on theme flip; the builder re-reads cssVar() internally rather than referencing it directly.
    [data, color, height, rebuildToken],
  );
  return (
    <ChartErrorBoundary label="Sparkline">
      <div role="img" aria-label={ariaLabel ?? "Sparkline"}>
        <ApexChart
          type="area"
          width="100%"
          height={height}
          options={options}
          series={series}
        />
      </div>
    </ChartErrorBoundary>
  );
}

type HBarChartProps = {
  categories: string[];
  data: number[];
  color?: string;
  /** One color per category (same order as `categories`/`data`) — overrides `color`. */
  colors?: string[];
  height?: number;
  showXAxisLabels?: boolean;
  ariaLabel?: string;
};

/** Horizontal bar chart for category breakdowns. Ports `hbar()`. */
export function HBarChart({
  categories,
  data,
  color,
  colors,
  height,
  showXAxisLabels,
  ariaLabel,
}: HBarChartProps) {
  const rebuildToken = useThemeRebuildToken();
  const chartHeight = height ?? Math.max(190, categories.length * 38 + 34);
  const built = useMemo(
    () =>
      buildHBarOptions(categories, data, color, height, {
        showXAxisLabels,
        colors,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuildToken forces a recompute on theme flip; the builder re-reads cssVar() internally rather than referencing it directly.
    [categories, data, color, colors, height, showXAxisLabels, rebuildToken],
  );
  return (
    <ChartErrorBoundary label="Grafik batang">
      <div role="img" aria-label={ariaLabel ?? "Grafik batang"}>
        <ApexChart
          type="bar"
          width="100%"
          height={chartHeight}
          options={built.options}
          series={built.series}
        />
      </div>
    </ChartErrorBoundary>
  );
}

type RadialChartProps = {
  value: number;
  label: string;
  height?: number;
  ariaLabel?: string;
};

/** Single-value radial gauge. Ports `radial()`. */
export function RadialChart({
  value,
  label,
  height = 210,
  ariaLabel,
}: RadialChartProps) {
  const rebuildToken = useThemeRebuildToken();
  const built = useMemo(
    () => buildRadialOptions(value, label, height),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuildToken forces a recompute on theme flip; the builder re-reads cssVar() internally rather than referencing it directly.
    [value, label, height, rebuildToken],
  );
  return (
    <ChartErrorBoundary label="Grafik radial">
      <div role="img" aria-label={ariaLabel ?? "Grafik radial"}>
        <ApexChart
          type="radialBar"
          width="100%"
          height={height}
          options={built.options}
          series={built.series}
        />
      </div>
    </ChartErrorBoundary>
  );
}
