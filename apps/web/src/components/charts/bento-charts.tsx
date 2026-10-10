"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { EXPENSE_COLOR } from "@/lib/viz-colors";
import arcStyles from "./arc/arc-bridge.module.css";
import { GroupedBars } from "./grouped-bars";
import { BarChart, type BarChartDatum } from "./arc/bar-chart/bar-chart";
import {
  LineChart,
  type LineChartDatum,
  type LineChartSeries,
} from "./arc/line-chart/line-chart";
import { Gauge } from "./arc/gauge/gauge";

/**
 * Bento v2 charts, ported from docs/design/proto/wm.js (`WM.chart.bars`,
 * `.area`, `.waterfall`). Hatched fills, dashed grid, Sora 11px labels.
 *
 * They draw in real pixels (the box is measured), not a scaled viewBox, so
 * labels stay 11px at any card size. Colours are CSS vars read from the
 * surrounding card (`--ctext`, `--cgrid`, `--cghost`, `--cstrong`, `--cbg`),
 * which is how the same chart renders on a white card and on the dark hero.
 * Place a chart inside `.wm-chart-wrap` (hero) or `.wm-chart` (cards).
 */

type Box = { w: number; h: number };

function useBox() {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setBox({
        w: Math.max(240, el.clientWidth),
        h: Math.max(140, el.clientHeight),
      });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, box };
}

/** 1 / 2 / 2.5 / 5 / 10 × 10^n: the tick top the prototype rounds to. */
export function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

const fill = (color: string): CSSProperties => ({ fill: color });
const LABEL: CSSProperties = {
  fill: "var(--ctext)",
  fontSize: 11,
  fontVariantNumeric: "tabular-nums",
};
const STRONG: CSSProperties = {
  fill: "var(--cstrong)",
  fontSize: 11,
  fontWeight: 500,
  fontVariantNumeric: "tabular-nums",
};

/**
 * The Beranda hero's two bar series. Single source for the bars and the legend
 * swatches so the two can never disagree: income lime, expense the shared
 * Pengeluaran ink (`EXPENSE_COLOR`, the same tone on every page). The net
 * ("Selisih") is read from the tooltip only: it is income - expense, not a
 * third stacked amount.
 */
export const FLOW_COLORS = {
  income: "var(--wm-lime)",
  expense: EXPENSE_COLOR,
} as const;

/** Stripe for the (light) ink expense fill: the card's own background, so it reads on both surfaces. */
const EXPENSE_STRIPE = "color-mix(in srgb, var(--cbg) 38%, transparent)";

/** Lime-family fills (income lime, `--viz-2`): their stripe is darkened in dark surfaces (see `.wm-hatch-stripe[data-base]` in bento.css). */
const LIME_FILL = /lime|--viz-2\b/;

/**
 * 8px hatch tile. The light stripe is lifted in dark mode (`.wm-hatch-stripe`
 * in bento.css) so muted series keep >=3:1 against the near-black card. Fills
 * that are themselves light get another stripe: ink (expense) takes the card
 * background, lime a darker lime (`data-base="lime"`); a `stripe` colour
 * overrides both.
 */
function Hatch({
  id,
  color,
  stripe,
}: {
  id: string;
  color: string;
  stripe?: string;
}) {
  const stripeFill =
    stripe ?? (color === FLOW_COLORS.expense ? EXPENSE_STRIPE : undefined);
  return (
    <pattern
      id={id}
      width="8"
      height="8"
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <rect width="8" height="8" style={fill(color)} />
      <rect
        className="wm-hatch-stripe"
        data-base={!stripeFill && LIME_FILL.test(color) ? "lime" : undefined}
        width="2"
        height="8"
        fill="rgba(255,255,255,.26)"
        style={stripeFill ? fill(stripeFill) : undefined}
      />
    </pattern>
  );
}

function Grid({
  y,
  top,
  bottom,
  left,
  right,
  width,
  axis,
}: {
  y: (v: number) => number;
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  axis: (v: number) => string;
}) {
  return (
    <g aria-hidden="true">
      {(bottom < 0
        ? [bottom, 0, top / 2, top]
        : [bottom, (top + bottom) / 2, top]
      ).map((tick) => (
        <g key={tick}>
          <line
            x1={left}
            x2={width - right}
            y1={y(tick)}
            y2={y(tick)}
            style={{ stroke: "var(--cgrid)" }}
            strokeDasharray={tick === 0 ? undefined : "3 5"}
          />
          {!(tick < 0 && Math.abs(y(tick) - y(0)) < 14) && (
            <text x={left - 8} y={y(tick) + 3.5} textAnchor="end" style={LABEL}>
              {axis(tick)}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}

function Frame({
  box,
  ariaLabel,
  children,
  boxRef,
  className,
}: {
  box: Box | null;
  ariaLabel: string;
  children: (box: Box) => ReactNode;
  boxRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
}) {
  return (
    <div
      ref={boxRef}
      className={className}
      style={{ position: "absolute", inset: 0 }}
    >
      {box && (
        <svg
          viewBox={`0 0 ${box.w} ${box.h}`}
          width={box.w}
          height={box.h}
          role="img"
          aria-label={ariaLabel}
        >
          {/* The chart speaks through aria-label; its drawn labels stay out of the text tree. */}
          <g aria-hidden="true">{children(box)}</g>
        </svg>
      )}
    </div>
  );
}

export type BarSeries = { name: string; data: number[]; color: string };

/**
 * Single series renders Arc's `BarChart`; two or more series render
 * `GroupedBars` (side-by-side, or stacked when `stacked`). The multi-series
 * branch used Arc's `Streamgraph`, whose overlapping bands read as
 * unlabeled blobs, so it was replaced with real bars.
 * Tokens bridged to WealthMe's own via `arc-bridge.module.css` — see that
 * file's header comment.
 *
 * `highlight` is accepted for prop-compatibility with every existing call
 * site but intentionally not reproduced: Arc's charts replace a static
 * "pinned" bar with live hover/scrub on every bar, which is a strict
 * upgrade over the old single pinned highlight (and directly answers the
 * "no drill-through on category rows" critique finding). `wide` has no
 * Arc equivalent (bar width is intrinsic to the component) and is ignored.
 */
export function HatchedBarChart({
  labels,
  series,
  format,
  formatFull,
  stacked,
  legend = true,
  ariaLabel,
  className,
}: {
  labels: string[];
  series: BarSeries[];
  highlight?: number;
  format?: (value: number) => string;
  /** Full-precision formatter for the bar tooltips; defaults to `format`. */
  formatFull?: (value: number) => string;
  axis?: (value: number) => string;
  wide?: boolean;
  /** Stack the series into one column per label instead of grouping them side by side (non-negative values). */
  stacked?: boolean;
  /** Multi-series only: draw the series legend. Off where the page renders its own. */
  legend?: boolean;
  ariaLabel: string;
  className?: string;
}) {
  const tipFormat = formatFull ?? format ?? String;
  const period =
    labels.length > 1
      ? `${labels[0]} – ${labels[labels.length - 1]}`
      : (labels[0] ?? "");
  const wrapClass = [arcStyles.bridge, className].filter(Boolean).join(" ");

  if (series.length <= 1) {
    const data: BarChartDatum[] = labels.map((label, i) => ({
      key: String(i),
      label,
      axisLabel: label,
      value: series[0]?.data[i] ?? 0,
    }));
    return (
      <div className={wrapClass}>
        <BarChart
          data={data}
          label={ariaLabel}
          period={period}
          formatValue={tipFormat}
          categoryLabel={period ? undefined : "Category"}
        />
      </div>
    );
  }

  return (
    // Fill the caller's chart box: percentages only, nothing measured.
    <div className={wrapClass} style={{ height: "100%" }}>
      <GroupedBars
        labels={labels}
        series={series}
        stacked={stacked}
        legend={legend}
        format={format ?? String}
        formatFull={tipFormat}
        ariaLabel={ariaLabel}
      />
    </div>
  );
}

/** Hatched area with a lime line, dots, an optional dashed comparison line and a pill on the last point. */
export function HatchedAreaChart({
  labels,
  values,
  compare,
  format,
  formatFull,
  ariaLabel,
  className,
}: {
  labels: string[];
  values: number[];
  compare?: number[];
  format?: (value: number) => string;
  /** Full-precision formatter for the point tooltips; defaults to `format`. */
  formatFull?: (value: number) => string;
  axis?: (value: number) => string;
  floor?: number;
  ariaLabel: string;
  className?: string;
}) {
  const tipFormat = formatFull ?? format ?? String;
  const wrapClass = [arcStyles.bridge, className].filter(Boolean).join(" ");
  if (values.length === 0) return null;

  const series: LineChartSeries[] = compare
    ? [
        { key: "main", label: ariaLabel, color: "var(--viz-1)", area: true },
        {
          key: "compare",
          label: "Sebelumnya",
          color: "var(--text-muted)",
          dashed: true,
          area: false,
        },
      ]
    : [{ key: "main", label: ariaLabel, color: "var(--viz-1)", area: true }];
  const data: LineChartDatum[] = labels.map((label, i) => ({
    key: String(i),
    label,
    axisLabel: label,
    values: {
      main: values[i] ?? 0,
      ...(compare ? { compare: compare[i] ?? 0 } : {}),
    },
  }));
  return (
    <div className={wrapClass}>
      <LineChart
        data={data}
        series={series}
        label={ariaLabel}
        formatValue={(value) => tipFormat(value)}
        legend={false}
      />
    </div>
  );
}

export type WaterfallStep = {
  label: string;
  value: number;
  /** A total column resets the running sum and draws solid. */
  total?: boolean;
  /** Label used on narrow screens. */
  short?: string;
};

/** Waterfall: lime hatched rises, orange hatched falls, solid totals, dashed connectors. */
export function WaterfallChart({
  steps,
  format,
  axis,
  ariaLabel,
  className,
}: {
  steps: WaterfallStep[];
  format: (value: number) => string;
  axis?: (value: number) => string;
  ariaLabel: string;
  className?: string;
}) {
  const { ref, box } = useBox();
  const uid = useId().replaceAll(":", "");
  return (
    <Frame box={box} boxRef={ref} ariaLabel={ariaLabel} className={className}>
      {({ w, h }) => {
        const compact = w < 480;
        const left = compact ? 2 : 48;
        const right = 4;
        const topPad = 34;
        const bottomPad = 24;
        let run = 0;
        const points = steps.map((step) => {
          const from = step.total ? 0 : run;
          const to = step.total ? step.value : run + step.value;
          run = to;
          return { ...step, from, to };
        });
        const top = niceCeil(
          Math.max(1, ...points.map((p) => Math.max(p.from, p.to))),
        );
        const y = (v: number) =>
          topPad + ((top - v) / top) * (h - topPad - bottomPad);
        const band = (w - left - right) / Math.max(1, points.length);
        const barW = Math.min(58, band * 0.62);
        return (
          <>
            <defs>
              <Hatch id={`${uid}-up`} color="var(--wm-lime)" />
              <Hatch id={`${uid}-down`} color="var(--wm-orange)" />
            </defs>
            {!compact && (
              <Grid
                y={y}
                top={top}
                bottom={0}
                left={left}
                right={right}
                width={w}
                axis={axis ?? format}
              />
            )}
            {points.map((p, i) => {
              const x = left + band * i + band / 2 - barW / 2;
              const yTop = y(Math.max(p.from, p.to));
              return (
                <g key={`${p.label}-${i}`}>
                  <rect
                    className="wm-chart-bar"
                    x={x}
                    y={yTop}
                    width={barW}
                    height={Math.max(3, Math.abs(y(p.from) - y(p.to)))}
                    rx={7}
                    fill={
                      p.total
                        ? undefined
                        : `url(#${uid}-${p.value >= 0 ? "up" : "down"})`
                    }
                    style={{
                      ...(p.total ? fill("var(--cstrong)") : {}),
                      animationDelay: `${i * 60}ms`,
                    }}
                  >
                    <title>{`${p.label}: ${format(p.value)}`}</title>
                  </rect>
                  {i < points.length - 1 && (
                    <line
                      x1={x + barW}
                      x2={x + band}
                      y1={y(p.to)}
                      y2={y(p.to)}
                      style={{ stroke: "var(--ctext)" }}
                      strokeDasharray="2 3"
                    />
                  )}
                  <text
                    x={x + barW / 2}
                    y={yTop - 8}
                    textAnchor="middle"
                    style={STRONG}
                  >
                    {(p.total ? "" : p.value >= 0 ? "+" : "") +
                      format(p.value).replace(/Rp\s/, "")}
                  </text>
                  <text
                    x={x + barW / 2}
                    y={h - 6}
                    textAnchor="middle"
                    style={LABEL}
                  >
                    {compact ? (p.short ?? p.label) : p.label}
                  </text>
                </g>
              );
            })}
          </>
        );
      }}
    </Frame>
  );
}

export type FlowDay = {
  label: string;
  /** income - expense of the bucket (tooltip only). */
  net: number;
  income: number;
  expense: number;
};

/**
 * UIArc chart swap — Arc's `Gauge` (arc semicircle, animated digit readout
 * built in). It renders its own `value%` readout and `label`/`detail`
 * caption, so the three call sites moved from a JSX-children composition
 * (`<b>{value}%</b><small>{label}</small>`) to passing `label` as a plain
 * string — the one call-site change this swap required (Arc's Gauge has no
 * children slot to compose into).
 */
export function TickGauge({
  value,
  label,
  detail,
}: {
  value: number;
  /** Visible caption under the digit readout (was the `<small>` child) —
   * Arc's Gauge builds its own aria-label from this, so the old separate
   * `ariaLabel` prop is no longer needed. */
  label: string;
  detail?: string;
}) {
  return (
    <div className={arcStyles.bridge}>
      <Gauge value={value} min={0} max={100} label={label} detail={detail} />
    </div>
  );
}
