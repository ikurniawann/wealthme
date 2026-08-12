import type { ApexOptions } from "apexcharts";
import type { DonutSegment } from "@/components/charts/donut";
import {
  buildCashflowOptions,
  buildDonutOptions,
  buildHBarOptions,
  buildRadialOptions,
  buildSparklineOptions,
  buildTrendOptions,
} from "@/components/charts/apex-options";
import { mergeChartOptions } from "@/components/charts/apex-base";

// These test the pure option/series builders only — no ApexCharts mount,
// since jsdom doesn't implement the SVG geometry Apex measures on render()
// (EPIC-025 N3-A5 / risk notes).

describe("mergeChartOptions", () => {
  it("overrides scalar values and merges nested objects without mutating either input", () => {
    const base: ApexOptions = {
      chart: { type: "bar", height: 100 },
      colors: ["#111"],
    };
    const overrides: ApexOptions = { chart: { height: 260 }, colors: ["#222"] };

    const merged = mergeChartOptions(base, overrides);

    expect(merged.chart).toEqual({ type: "bar", height: 260 });
    expect(merged.colors).toEqual(["#222"]);
    // originals untouched
    expect(base.chart).toEqual({ type: "bar", height: 100 });
    expect(base.colors).toEqual(["#111"]);
  });
});

describe("buildCashflowOptions", () => {
  it("returns grouped income/expense series with matching month categories", () => {
    const months = ["Jan", "Feb", "Mar"];
    const income = [100, 200, 150];
    const expense = [50, 80, 60];

    const { options, series } = buildCashflowOptions(months, income, expense);

    expect(options.chart).toMatchObject({
      type: "bar",
      height: 260,
      stacked: false,
    });
    expect(options.xaxis?.categories).toEqual(months);
    expect(series).toEqual([
      { name: "Pemasukan", data: income },
      { name: "Pengeluaran", data: expense },
    ]);
  });
});

describe("buildTrendOptions", () => {
  it("wraps the given series and categories with a gradient area chart", () => {
    const categories = ["W1", "W2"];
    const series = [{ name: "Net worth", data: [1000, 1200] }];

    const { options, series: builtSeries } = buildTrendOptions(
      categories,
      series,
    );

    expect(options.chart).toMatchObject({ type: "area" });
    expect(options.xaxis?.categories).toEqual(categories);
    expect(options.fill?.type).toBe("gradient");
    expect(builtSeries).toBe(series);
  });

  it("respects a custom height", () => {
    const { options } = buildTrendOptions(
      ["W1"],
      [{ name: "s", data: [1] }],
      320,
    );
    expect(options.chart?.height).toBe(320);
  });
});

describe("buildDonutOptions", () => {
  const segments: DonutSegment[] = [
    { label: "Tabungan", value: 60, color: "#4f46e5" },
    { label: "Investasi", value: 40, color: "#10b981" },
  ];

  it("derives labels, series values, and colors from the DonutSegment[] verbatim", () => {
    const { options, series } = buildDonutOptions(segments);

    expect(options.labels).toEqual(["Tabungan", "Investasi"]);
    expect(series).toEqual([60, 40]);
    expect(options.colors).toEqual(["#4f46e5", "#10b981"]);
    expect(options.chart).toMatchObject({ type: "donut", height: 268 });
  });

  it("applies a custom center label and height", () => {
    const { options } = buildDonutOptions(segments, "Sisa Saldo", 300);
    const donutLabels = options.plotOptions?.pie?.donut?.labels;
    expect(donutLabels?.total?.label).toBe("Sisa Saldo");
    expect(options.chart?.height).toBe(300);
  });

  it("handles an empty segment list without throwing", () => {
    const { options, series } = buildDonutOptions([]);
    expect(options.labels).toEqual([]);
    expect(series).toEqual([]);
  });
});

describe("buildSparklineOptions", () => {
  it("enables sparkline mode and wraps the raw data as a single series", () => {
    const data = [1, 5, 3, 8];
    const { options, series } = buildSparklineOptions(data);

    expect(options.chart).toMatchObject({
      type: "area",
      height: 56,
      sparkline: { enabled: true },
    });
    expect(series).toEqual([{ name: "Nilai", data }]);
    expect(options.tooltip?.enabled).toBe(false);
  });

  it("uses the given color override", () => {
    const { options } = buildSparklineOptions([1, 2], "#ff0000");
    expect(options.colors).toEqual(["#ff0000"]);
  });
});

describe("buildHBarOptions", () => {
  it("scales height by category count with a floor of 180", () => {
    const short = buildHBarOptions(["A", "B"], [10, 20]);
    expect(short.options.chart?.height).toBe(180);

    const long = buildHBarOptions(
      ["A", "B", "C", "D", "E", "F", "G", "H"],
      [1, 2, 3, 4, 5, 6, 7, 8],
    );
    expect(long.options.chart?.height).toBe(8 * 38);
  });

  it("makes the bar horizontal and puts categories on the x axis", () => {
    const { options, series } = buildHBarOptions(
      ["Belanja Harian", "Transport"],
      [500, 200],
    );
    expect(options.plotOptions?.bar?.horizontal).toBe(true);
    expect(options.xaxis?.categories).toEqual(["Belanja Harian", "Transport"]);
    expect(series).toEqual([{ name: "Jumlah", data: [500, 200] }]);
  });

  it("formats y-axis category labels as plain strings, not currency", () => {
    const { options } = buildHBarOptions(["Belanja Harian"], [500]);
    const formatter =
      options.yaxis && !Array.isArray(options.yaxis)
        ? options.yaxis.labels?.formatter
        : undefined;
    const asStringFormatter = formatter as unknown as
      | ((value: string) => string)
      | undefined;
    expect(asStringFormatter?.("Belanja Harian")).toBe("Belanja Harian");
  });
});

describe("buildRadialOptions", () => {
  it("wraps a single numeric value as the series and sets the label", () => {
    const { options, series } = buildRadialOptions(72, "Tercapai");
    expect(options.chart).toMatchObject({ type: "radialBar", height: 210 });
    expect(options.labels).toEqual(["Tercapai"]);
    expect(series).toEqual([72]);
  });
});
