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

/** CashflowChart — grouped income/expense bars. Ports `cashflow()`. */
export function buildCashflowOptions(
  months: string[],
  income: number[],
  expense: number[],
): ChartBuild {
  const options = mergeChartOptions(baseChartOptions(), {
    chart: { type: "bar", height: 260, stacked: false },
    colors: [cssVar("--chart-2"), cssVar("--destructive")],
    plotOptions: {
      bar: {
        borderRadius: 5,
        columnWidth: "52%",
        borderRadiusApplication: "end",
      },
    },
    xaxis: { categories: months },
    yaxis: { labels: { formatter: (v: number) => formatRupiahCompact(v) } },
    tooltip: { y: { formatter: (v: number) => formatRupiah(v) } },
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
): ChartBuild {
  const options = mergeChartOptions(baseChartOptions(), {
    chart: { type: "area", height },
    xaxis: { categories },
    yaxis: { labels: { formatter: (v: number) => formatRupiahCompact(v) } },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 0.9,
        opacityFrom: 0.28,
        opacityTo: 0.02,
        stops: [0, 95],
      },
    },
    tooltip: { y: { formatter: (v: number) => formatRupiah(v) } },
  });
  return { options, series };
}

/** DonutChart — accepts the EXISTING `DonutSegment[]` shape verbatim; never redefine it. */
export function buildDonutOptions(
  segments: DonutSegment[],
  centerLabel = "Total",
  height = 232,
): ChartBuild {
  const labels = segments.map((s) => s.label);
  const series = segments.map((s) => s.value);
  const colors = segments.map((s) => s.color);
  const options = mergeChartOptions(baseChartOptions(), {
    chart: { type: "donut", height },
    labels,
    colors,
    stroke: { width: 0 },
    plotOptions: {
      pie: {
        donut: {
          size: "72%",
          labels: {
            show: true,
            name: {
              fontSize: "12px",
              fontWeight: 500,
              color: cssVar("--muted-foreground"),
            },
            value: {
              fontSize: "18px",
              fontWeight: 650,
              color: cssVar("--foreground"),
              formatter: (v: string) => formatRupiahCompact(Number(v)),
            },
            total: {
              show: true,
              label: centerLabel,
              fontSize: "12px",
              fontWeight: 500,
              color: cssVar("--muted-foreground"),
              formatter: (w: { globals: { seriesTotals: number[] } }) =>
                formatRupiahCompact(
                  w.globals.seriesTotals.reduce((a, b) => a + b, 0),
                ),
            },
          },
        },
      },
    },
    tooltip: { y: { formatter: (v: number) => formatRupiah(v) } },
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
): ChartBuild {
  const height = chartHeight ?? Math.max(190, categories.length * 38 + 34);
  const showXAxisLabels = config.showXAxisLabels ?? false;
  const options = mergeChartOptions(baseChartOptions(), {
    chart: { type: "bar", height, parentHeightOffset: 0 },
    colors: [color ?? cssVar("--chart-1")],
    plotOptions: {
      bar: { horizontal: true, borderRadius: 5, barHeight: "56%" },
    },
    // A horizontal Apex bar puts the numeric scale on x and category names
    // on y — the base yaxis formatter is currency, which would format
    // category names ("Belanja Harian") as "Rp NaN"; override both axes.
    xaxis: {
      categories,
      labels: {
        show: showXAxisLabels,
        style: { fontSize: "11.5px", fontWeight: 500 },
        formatter: (v: number) => formatRupiahCompact(Number(v)),
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
    tooltip: { y: { formatter: (v: number) => formatRupiah(v) } },
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
