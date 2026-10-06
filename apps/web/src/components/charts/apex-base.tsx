"use client";

import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useEffect, useId, useState } from "react";

/**
 * ApexCharts foundation — EPIC-025 N3-A. Ported from the approved prototype's
 * `docs/prototype/assets/charts.js` factory: one shared base grid/tooltip/
 * legend/font config, colors read from CSS custom properties instead of
 * hardcoded, and an explicit theme-change re-render registry (colors are
 * baked into the SVG at build time — flipping `--chart-1` etc. on `:root`
 * does not retint an already-mounted chart on its own).
 *
 * `next/dynamic(..., { ssr: false })` lives HERE, not at each call site:
 * client components still pre-render on the server under Next 16's RSC
 * model, and ApexCharts touches `window` at module scope.
 */

/** react-apexcharts's React wrapper, loaded client-only. */
export const ApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden="true"
      className="min-h-[56px] animate-pulse rounded-md bg-muted"
    />
  ),
});

/** Read a CSS custom property off `:root`, trimmed. Empty string before mount / on the server. */
export function cssVar(name: string): string {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

/** The shared categorical data-viz palette (`--viz-1`..`--viz-6`: forest, lime, sand, clay, teal-forest, graphite), read live from `:root` so it follows the active theme. */
export function chartPalette(): string[] {
  return ["--viz-1", "--viz-2", "--viz-3", "--viz-4", "--viz-5", "--viz-6"].map(
    cssVar,
  );
}

function isDarkMode(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
  );
}

/**
 * Deep-merge two ApexOptions objects — plain objects merge key-by-key
 * (overrides win), arrays and primitives replace wholesale. Mirrors the
 * prototype's `deepMerge`; returns a new object, never mutates either input.
 */
export function mergeChartOptions(
  base: ApexOptions,
  overrides: ApexOptions,
): ApexOptions {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overrides ?? {})) {
    const existing = (base as Record<string, unknown>)[key];
    out[key] =
      value && typeof value === "object" && !Array.isArray(value)
        ? mergeChartOptions(
            (existing as ApexOptions) ?? {},
            value as ApexOptions,
          )
        : value;
  }
  return out as ApexOptions;
}

/**
 * Shared base options every preset in `apex-presets.tsx` merges its
 * shape-specific options over. Ported from `charts.js`'s `base()`.
 */
export function baseChartOptions(): ApexOptions {
  return {
    chart: {
      fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif",
      foreColor: cssVar("--muted-foreground"),
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: {
        enabled: false,
        animateGradually: { enabled: false },
        dynamicAnimation: { enabled: false },
      },
      background: "transparent",
    },
    colors: chartPalette(),
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
      markers: { size: 9 },
      itemMargin: { horizontal: 10, vertical: 3 },
    },
    tooltip: {
      theme: isDarkMode() ? "dark" : "light",
      style: { fontSize: "12px" },
    },
    xaxis: {
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { fontSize: "11px", fontWeight: 600 } },
    },
    yaxis: {
      labels: { style: { fontSize: "11px" } },
    },
    stroke: { curve: "smooth", width: 2.5, lineCap: "round" },
  };
}

// ── Theme-change re-render registry ─────────────────────────────────────
// Explicit port of charts.js:60-123's `registry.push({ chart, build })` +
// `document.addEventListener("wm:theme", ...)` pattern. next-themes changes
// do NOT automatically retint a mounted Apex chart, so every chart instance
// using `useApexOptions` below registers a rebuild callback here and this
// module explicitly re-runs every registered callback when the resolved
// theme flips.
//
// The flip itself is detected by a SINGLE module-level MutationObserver on
// `document.documentElement`'s `class` attribute (next-themes toggles the
// `dark` class there), not by each chart instance's own effect independently
// polling `resolvedTheme`. With N mounted charts, N independent theme-watching
// effects would each call `notifyThemeRebuild()` on a flip — that's N calls
// each looping the full registry, i.e. O(n²) rebuild work for one toggle.
// One observer calling `notifyThemeRebuild()` once keeps it O(n).
type RebuildFn = () => void;
const themeRegistry = new Map<string, RebuildFn>();

function registerThemeRebuild(id: string, rebuild: RebuildFn): void {
  themeRegistry.set(id, rebuild);
}

function unregisterThemeRebuild(id: string): void {
  themeRegistry.delete(id);
}

function notifyThemeRebuild(): void {
  themeRegistry.forEach((rebuild) => rebuild());
}

let themeObserver: MutationObserver | null = null;
let themeObserverRefCount = 0;
let lastIsDark = false;

/** Ref-counted so the observer is created once for the first mounted chart and torn down once the last unmounts. */
function acquireThemeObserver(): void {
  if (typeof document === "undefined") return;
  themeObserverRefCount += 1;
  if (themeObserver) return;
  lastIsDark = isDarkMode();
  themeObserver = new MutationObserver(() => {
    const nowDark = isDarkMode();
    if (nowDark === lastIsDark) return;
    lastIsDark = nowDark;
    notifyThemeRebuild();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
}

function releaseThemeObserver(): void {
  themeObserverRefCount = Math.max(0, themeObserverRefCount - 1);
  if (themeObserverRefCount === 0 && themeObserver) {
    themeObserver.disconnect();
    themeObserver = null;
  }
}

/**
 * Registers this chart instance in the theme-change registry and returns a
 * token that increments the moment the resolved theme flips (re-reading
 * `cssVar()` values requires a rebuild — colors are baked into the SVG at
 * build time). Each preset in `apex-presets.tsx` includes this token in its
 * own `useMemo` dependency array alongside the real reactive inputs
 * (`months`, `income`, `segments`, …), so `eslint-plugin-react-hooks` can
 * verify a literal dependency array at the `useMemo` call site while still
 * only recomputing when an input — or the theme — actually changes.
 */
export function useThemeRebuildToken(): number {
  const id = useId();
  const [rebuildToken, forceRebuild] = useState(0);

  useEffect(() => {
    registerThemeRebuild(id, () => forceRebuild((n) => n + 1));
    acquireThemeObserver();
    return () => {
      unregisterThemeRebuild(id);
      releaseThemeObserver();
    };
  }, [id]);

  return rebuildToken;
}
