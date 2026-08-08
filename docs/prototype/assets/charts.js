/*
 * WealthMe prototype — ApexCharts presets
 *
 * EPIC-024 D18 picks ApexCharts for the revamp. Every chart in the prototype
 * goes through a factory here so the whole set shares one palette, one grid
 * weight, one tooltip, and one type scale — and so the eventual React port has
 * exactly one place to translate.
 *
 * Colours are read from the CSS custom properties in tokens.css rather than
 * hardcoded, so charts retint with the theme instead of drifting from it.
 * Charts re-render on the wm:theme event for the same reason.
 */

const WMCharts = (() => {
  const cssVar = (name) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  const palette = () => [
    cssVar("--chart-1"),
    cssVar("--chart-2"),
    cssVar("--chart-3"),
    cssVar("--chart-4"),
    cssVar("--chart-5"),
  ];

  const registry = [];

  // Keep charts deterministic in dense financial cards.
  // screenshots of this prototype are captured — an animating chart caught
  // mid-flight looks like wrong data.
  // The portable build renders every page inside an `iframe[srcdoc]`. In that
  // context ApexCharts can leave area/line charts at their animation `pathFrom`
  // position (outside the clipping rect), so the card looks empty even though
  // the SVG canvas exists. Keep the standalone deterministic and immediately
  // readable; normal prototype pages can still use the short entrance motion.
  const animate = false;
  // Intentionally false for every prototype page; stability beats motion here.

  const base = () => ({
    chart: {
      fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif",
      foreColor: cssVar("--muted-foreground"),
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: {
        enabled: animate,
        animateGradually: { enabled: false },
        dynamicAnimation: { enabled: false },
      },
      background: "transparent",
    },
    colors: palette(),
    grid: {
      borderColor: cssVar("--border"),
      strokeDashArray: 4,
      padding: { left: 4, right: 4, top: 0 },
    },
    dataLabels: { enabled: false },
    legend: {
      position: "bottom",
      horizontalAlign: "left",
      fontSize: "12px",
      fontWeight: 600,
      markers: { width: 9, height: 9, radius: 3 },
      itemMargin: { horizontal: 10, vertical: 3 },
    },
    tooltip: {
      theme: document.documentElement.classList.contains("dark")
        ? "dark"
        : "light",
      style: { fontSize: "12px" },
      y: { formatter: (v) => WM.formatRupiah(v) },
    },
    xaxis: {
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { fontSize: "11px", fontWeight: 600 } },
    },
    yaxis: {
      labels: {
        style: { fontSize: "11px" },
        formatter: (v) => WM.formatCompact(v),
      },
    },
    stroke: { curve: "smooth", width: 2.5, lineCap: "round" },
  });

  const deepMerge = (a, b) => {
    const out = { ...a };
    for (const [k, v] of Object.entries(b ?? {})) {
      out[k] =
        v && typeof v === "object" && !Array.isArray(v)
          ? deepMerge(a[k] ?? {}, v)
          : v;
    }
    return out;
  };

  /**
   * Mount a chart and keep it in the theme-aware registry.
   * @param {string} selector  CSS selector of the mount node
   * @param {object} options   ApexCharts options merged over the shared base
   */
  const mount = (selector, options) => {
    const el = document.querySelector(selector);
    if (!el || !window.ApexCharts) return null;
    const build = () => deepMerge(base(), options);
    const chart = new ApexCharts(el, build());
    const renderResult = chart.render();

    // Never fail as silent whitespace. This is intentionally delayed until
    // Apex has had a chance to build its SVG, and only replaces genuinely
    // failed mounts—not valid empty datasets.
    Promise.resolve(renderResult).catch(() => {
      el.innerHTML = `
        <div class="chart-error" role="alert">
          <strong>Grafik belum dapat ditampilkan.</strong>
          <span>Muat ulang halaman untuk mencoba lagi.</span>
        </div>`;
    });
    registry.push({ chart, build });
    return chart;
  };

  /* ── Named presets, one per recurring shape in the app ── */

  const cashflow = (selector, months, income, expense) =>
    mount(selector, {
      chart: { type: "bar", height: 260, stacked: false },
      series: [
        { name: "Pemasukan", data: income },
        { name: "Pengeluaran", data: expense },
      ],
      colors: [cssVar("--chart-2"), cssVar("--destructive")],
      plotOptions: {
        bar: {
          borderRadius: 5,
          columnWidth: "52%",
          borderRadiusApplication: "end",
        },
      },
      xaxis: { categories: months },
    });

  const trend = (selector, categories, series, opts = {}) =>
    mount(selector, {
      chart: { type: "area", height: opts.height ?? 250 },
      series,
      xaxis: { categories },
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 0.9,
          opacityFrom: 0.28,
          opacityTo: 0.02,
          stops: [0, 95],
        },
      },
      ...opts.options,
    });

  const donut = (
    selector,
    labels,
    values,
    centerLabel = "Total",
    height = 268,
  ) =>
    mount(selector, {
      chart: { type: "donut", height },
      series: values,
      labels,
      stroke: { width: 0 },
      plotOptions: {
        pie: {
          donut: {
            size: "72%",
            labels: {
              show: true,
              name: { fontSize: "12px", fontWeight: 600 },
              value: {
                fontSize: "18px",
                fontWeight: 800,
                color: cssVar("--foreground"),
                formatter: (v) => WM.formatCompact(Number(v)),
              },
              total: {
                show: true,
                label: centerLabel,
                fontSize: "12px",
                fontWeight: 600,
                color: cssVar("--muted-foreground"),
                formatter: (w) =>
                  WM.formatCompact(
                    w.globals.seriesTotals.reduce((a, b) => a + b, 0),
                  ),
              },
            },
          },
        },
      },
      tooltip: { y: { formatter: (v) => WM.formatRupiah(v) } },
    });

  const sparkline = (selector, data, color) =>
    mount(selector, {
      chart: { type: "area", height: 56, sparkline: { enabled: true } },
      series: [{ name: "Nilai", data }],
      colors: [color ?? cssVar("--chart-1")],
      stroke: { width: 2 },
      fill: { type: "gradient", gradient: { opacityFrom: 0.35, opacityTo: 0 } },
      tooltip: { enabled: false },
    });

  const hbar = (selector, categories, data, color) =>
    mount(selector, {
      chart: { type: "bar", height: Math.max(180, categories.length * 38) },
      series: [{ name: "Jumlah", data }],
      colors: [color ?? cssVar("--chart-1")],
      plotOptions: {
        bar: { horizontal: true, borderRadius: 5, barHeight: "58%" },
      },
      /* In a horizontal Apex bar the x axis is the numeric scale and the
         y axis carries category names. The previous y-axis formatter tried
         to format names such as "Belanja Harian" as currency → "Rp NaN". */
      xaxis: {
        categories,
        labels: {
          style: { fontSize: "11.5px", fontWeight: 600 },
          formatter: (v) => WM.formatCompact(Number(v)),
        },
      },
      yaxis: {
        labels: {
          // Override the base currency formatter: here these are category
          // labels, not numeric values.
          formatter: (value) => String(value),
          style: { fontSize: "11.5px", fontWeight: 600 },
        },
      },
      grid: {
        xaxis: { lines: { show: true } },
        yaxis: { lines: { show: false } },
      },
    });

  const radial = (selector, value, label, height = 210) =>
    mount(selector, {
      chart: { type: "radialBar", height },
      series: [value],
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

  // Retint every mounted chart when the theme flips — a chart still showing
  // light-mode axis text on a dark page is the giveaway that a prototype was
  // never actually looked at in both modes.
  document.addEventListener("wm:theme", () => {
    registry.forEach(({ chart, build }) =>
      chart.updateOptions(build(), false, false),
    );
  });

  return {
    mount,
    cashflow,
    trend,
    donut,
    sparkline,
    hbar,
    radial,
    palette,
    cssVar,
  };
})();

window.WMCharts = WMCharts;
