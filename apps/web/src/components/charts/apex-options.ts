import type { ApexOptions } from "apexcharts";
import type { DonutSegment } from "@/components/charts/donut";
import {
  baseChartOptions,
  cssVar,
  mergeChartOptions,
} from "@/components/charts/apex-base";
import { formatRupiah, formatRupiahCompact } from "@/lib/format";

/**
 * Pure ApexCharts option builders — EPIC-025 N3-A5. Extracted out of the
 * `apex-presets.tsx` components so the shape-building logic is testable
 * without mounting ApexCharts in jsdom (jsdom doesn't implement the SVG
 * geometry Apex measures on `render()`). Each builder ports the matching
 * factory in `docs/prototype/assets/charts.js:127-260`.
 *
 * Every builder merges shape-specific options over `baseChartOptions()` via
 * `mergeChartOptions`, mirroring the prototype's `mount(selector, options)`
 * call — `deepMerge(base(), options)`.
 */

export type ChartBuild = {
  options: ApexOptions;
  series: ApexOptions["series"];
};

/**
 * Money-formatter pair every money-axis/tooltip builder below accepts —
 * C5 (client revision round 2). Defaults to plain IDR `formatRupiah`/
 * `formatRupiahCompact` so every existing call site keeps its current
 * behaviour; pages under `(app)` that display converted amounts pass
 * `useMoney().format`/`formatCompact` instead so a chart never mixes
 * currencies with the rest of the screen.
 */
export type ChartMoneyFormatter = {
  format?: (v: number) => string;
  formatCompact?: (v: number) => string;
  /** Axis tick in the display currency ("€ 2,4 rb"); falls back to `formatCompact`. */
  formatAxis?: (v: number) => string;
};

/** CashflowChart — grouped income/expense bars. Ports `cashflow()`. */
export function buildCashflowOptions(
  months: string[],
  income: number[],
  expense: number[],
  money?: ChartMoneyFormatter,
): ChartBuild {
  const format = money?.format ?? formatRupiah;
  const formatCompact = money?.formatCompact ?? formatRupiahCompact;
  const formatAxis = money?.formatAxis ?? formatCompact;
  const options = mergeChartOptions(baseChartOptions(), {
    chart: { type: "bar", height: 260, stacked: false },
    colors: [cssVar("--viz-2"), cssVar("--destructive")],
    plotOptions: {
      bar: {
        borderRadius: 5,
        columnWidth: "52%",
        borderRadiusApplication: "end",
      },
    },
    xaxis: { categories: months },
    yaxis: { labels: { formatter: (v: number) => formatAxis(v) } },
    tooltip: { y: { formatter: (v: number) => format(v) } },
  });
  return {
    options,
    series: [
      { name: "Pemasukan", data: income },
      { name: "Pengeluaran", data: expense },
    ],
  };
}

export type TrendSeries = { name: string; data: number[] };

/** TrendChart — gradient-filled area trend. Ports `trend()`. */
export function buildTrendOptions(
  categories: string[],
  series: TrendSeries[],
  height = 250,
  money?: ChartMoneyFormatter,
): ChartBuild {
  const format = money?.format ?? formatRupiah;
  const formatCompact = money?.formatCompact ?? formatRupiahCompact;
  const formatAxis = money?.formatAxis ?? formatCompact;
  const options = mergeChartOptions(baseChartOptions(), {
    chart: { type: "area", height },
    xaxis: { categories },
    yaxis: { labels: { formatter: (v: number) => formatAxis(v) } },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 0.9,
        opacityFrom: 0.28,
        opacityTo: 0.02,
        stops: [0, 95],
      },
    },
    tooltip: { y: { formatter: (v: number) => format(v) } },
  });
  return { options, series };
}

/** DonutChart — accepts the EXISTING `DonutSegment[]` shape verbatim; never redefine it. */
export function buildDonutOptions(
  segments: DonutSegment[],
  centerLabel = "Total",
  height = 232,
  money?: ChartMoneyFormatter,
): ChartBuild {
  const format = money?.format ?? formatRupiah;
  const formatCompact = money?.formatCompact ?? formatRupiahCompact;
  const formatAxis = money?.formatAxis ?? formatCompact;
  const labels = segments.map((s) => s.label);
  const series = segments.map((s) => s.value);
  const colors = segments.map((s) => s.color);
  const options = mergeChartOptions(baseChartOptions(), {
    chart: { type: "pie", height },
    labels,
    colors,
    stroke: { width: 2, colors: [cssVar("--card")] },
    dataLabels: { enabled: false },
    tooltip: { y: { formatter: (v: number) => format(v) } },
  });
  return { options, series };
}

/** SparklineChart — edge-to-edge area sparkline, no axes/legend/tooltip. Ports `sparkline()`. */
export function buildSparklineOptions(
  data: number[],
  color?: string,
  height = 56,
): ChartBuild {
  const options = mergeChartOptions(baseChartOptions(), {
    chart: { type: "area", height, sparkline: { enabled: true } },
    colors: [color ?? cssVar("--chart-1")],
    stroke: { width: 2 },
    fill: { type: "gradient", gradient: { opacityFrom: 0.35, opacityTo: 0 } },
    tooltip: { enabled: false },
  });
  return { options, series: [{ name: "Nilai", data }] };
}

/** HBarChart — horizontal bars for category breakdowns. Ports `hbar()`. */
export type HBarOptionsConfig = {
  showXAxisLabels?: boolean;
  /** One color per category (same order as `categories`/`data`) — overrides `color`. */
  colors?: string[];
};

function compactCategoryLabel(value: unknown): string {
  const label = String(value);
  return label.length > 22 ? `${label.slice(0, 19)}...` : label;
}

export function buildHBarOptions(
  categories: string[],
  data: number[],
  color?: string,
  chartHeight?: number,
  config: HBarOptionsConfig = {},
  money?: ChartMoneyFormatter,
): ChartBuild {
  const format = money?.format ?? formatRupiah;
  const formatCompact = money?.formatCompact ?? formatRupiahCompact;
  const formatAxis = money?.formatAxis ?? formatCompact;
  const height = chartHeight ?? Math.max(190, categories.length * 38 + 34);
  const showXAxisLabels = config.showXAxisLabels ?? false;
  // `colors` (one per category) takes priority over the single `color` —
  // lets a caller mixing categorically different data in one hbar (e.g.
  // assets vs. liabilities) color each bar by what it actually is instead
  // of one flat hue that makes a debt look identical to a saving. Apex only
  // honors a per-point palette in `distributed` mode.
  const perBarColors = config.colors;
  const options = mergeChartOptions(baseChartOptions(), {
    chart: { type: "bar", height, parentHeightOffset: 0 },
    colors: perBarColors ?? [color ?? cssVar("--chart-1")],
    // The y-axis category labels already name every bar — Apex's own
    // legend would either repeat "Jumlah" once (uninformative) or, in
    // `distributed` mode, one entry per bar (redundant with the axis).
    legend: { show: false },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 5,
        barHeight: "56%",
        distributed: Boolean(perBarColors),
      },
    },
    // A horizontal Apex bar puts the numeric scale on x and category names
    // on y — the base yaxis formatter is currency, which would format
    // category names ("Belanja Harian") as "Rp NaN"; override both axes.
    xaxis: {
      categories,
      // Apex's default tick count packs ~7-9 ticks across the axis; with
      // full Rupiah labels ("Rp 1,90 M") that overruns the available width
      // and the labels overprint each other into an unreadable smear.
      // 4 ticks is the most that fits at this font size on a card-width
      // chart, and is plenty for reading a bar's rough magnitude — the
      // exact figure is one hover away in the tooltip.
      tickAmount: 4,
      labels: {
        show: showXAxisLabels,
        style: { fontSize: "11.5px", fontWeight: 500 },
        formatter: (v: number) => formatAxis(Number(v)),
      },
    },
    yaxis: {
      // The base yaxis formatter is currency (numbers); a horizontal bar's
      // yaxis carries category name strings instead, so override with a
      // widened (unknown) parameter type — Apex calls this with a string at
      // runtime despite the library's own numeric-only type signature.
      labels: {
        formatter: compactCategoryLabel,
        minWidth: 130,
        maxWidth: 150,
        style: { fontSize: "11.5px", fontWeight: 500 },
      },
    },
    grid: {
      xaxis: { lines: { show: showXAxisLabels } },
      yaxis: { lines: { show: false } },
      padding: { left: 0, right: 10, top: 0, bottom: showXAxisLabels ? 6 : -6 },
    },
    tooltip: { y: { formatter: (v: number) => format(v) } },
  });
  return { options, series: [{ name: "Jumlah", data }] };
}

/** RadialChart — single-value radial gauge. Ports `radial()`. */
export function buildRadialOptions(
  value: number,
  label: string,
  height = 210,
): ChartBuild {
  const options = mergeChartOptions(baseChartOptions(), {
    chart: { type: "radialBar", height },
    labels: [label],
    plotOptions: {
      radialBar: {
        hollow: { size: "62%" },
        track: { background: cssVar("--secondary") },
        dataLabels: {
          name: {
            fontSize: "12px",
            fontWeight: 600,
            color: cssVar("--muted-foreground"),
          },
          value: {
            fontSize: "22px",
            fontWeight: 800,
            color: cssVar("--foreground"),
          },
        },
      },
    },
  });
  return { options, series: [value] };
}
