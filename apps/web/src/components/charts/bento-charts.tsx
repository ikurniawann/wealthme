"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

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
const LABEL: CSSProperties = { fill: "var(--ctext)", fontSize: 11 };
const STRONG: CSSProperties = {
  fill: "var(--cstrong)",
  fontSize: 11,
  fontWeight: 500,
};

function Hatch({ id, color }: { id: string; color: string }) {
  return (
    <pattern
      id={id}
      width="8"
      height="8"
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <rect width="8" height="8" style={fill(color)} />
      <rect width="2" height="8" fill="rgba(255,255,255,.26)" />
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

/** The dark value pill above a highlighted bar or the last area point. */
function ValuePill({
  cx,
  y,
  text,
  width,
}: {
  cx: number;
  y: number;
  text: string;
  width: number;
}) {
  const w = Math.max(58, text.length * 6.6 + 18);
  const x = Math.max(0, Math.min(width - w, cx - w / 2));
  return (
    <g aria-hidden="true">
      <rect
        x={x}
        y={y - 26}
        width={w}
        height={22}
        rx={11}
        style={fill("var(--cstrong)")}
      />
      <text
        x={x + w / 2}
        y={y - 11}
        textAnchor="middle"
        style={{ fill: "var(--cbg)", fontSize: 11, fontWeight: 600 }}
      >
        {text}
      </text>
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
 * Grouped hatched bars. `highlight` greys every other column and puts a value
 * pill over the highlighted one (the "this week" look of the Beranda hero).
 */
export function HatchedBarChart({
  labels,
  series,
  highlight,
  format,
  axis,
  wide = false,
  ariaLabel,
  className,
}: {
  labels: string[];
  series: BarSeries[];
  highlight?: number;
  format?: (value: number) => string;
  axis?: (value: number) => string;
  wide?: boolean;
  ariaLabel: string;
  className?: string;
}) {
  const { ref, box } = useBox();
  const uid = useId().replaceAll(":", "");
  return (
    <Frame box={box} boxRef={ref} ariaLabel={ariaLabel} className={className}>
      {({ w, h }) => {
        const compact = w < 480;
        const tickSample = (axis ?? format ?? String)(
          niceCeil(Math.max(1, ...series.flatMap((s) => s.data))),
        );
        // room for the longest tick label (Sora 11px ≈ 6.4px per char)
        const left = compact
          ? 2
          : Math.max(44, Math.round(String(tickSample).length * 6.4) + 14);
        const right = 4;
        const topPad = format && highlight != null ? 36 : 12;
        const bottomPad = 24;
        const all = series.flatMap((s) => s.data);
        const top = niceCeil(Math.max(1, ...all));
        const rawBottom = Math.min(0, ...all);
        const bottom = rawBottom < 0 ? -niceCeil(-rawBottom) : 0;
        const y = (v: number) =>
          topPad + ((top - v) / (top - bottom)) * (h - topPad - bottomPad);
        const band = (w - left - right) / Math.max(1, labels.length);
        const count = series.length;
        const barW = Math.min(wide ? 64 : 32, (band * 0.72) / count);
        const gap = count > 1 ? 4 : 0;
        const tick = axis ?? format ?? ((v: number) => String(Math.round(v)));
        const peak =
          highlight != null
            ? Math.max(...series.map((s) => s.data[highlight] ?? 0))
            : 0;
        return (
          <>
            <defs>
              {series.map((s, j) => (
                <Hatch key={s.name} id={`${uid}-s${j}`} color={s.color} />
              ))}
              <Hatch id={`${uid}-ghost`} color="var(--cghost)" />
            </defs>
            {!compact && (
              <Grid
                y={y}
                top={top}
                bottom={bottom}
                left={left}
                right={right}
                width={w}
                axis={tick}
              />
            )}
            {labels.map((label, i) => {
              const on = highlight == null || i === highlight;
              const x0 =
                left +
                band * i +
                band / 2 -
                (barW * count + gap * (count - 1)) / 2;
              return (
                <g key={`${label}-${i}`}>
                  {series.map((s, j) => {
                    const v = s.data[i] ?? 0;
                    const yTop = Math.min(y(v), y(0));
                    return (
                      <rect
                        key={s.name}
                        className="wm-chart-bar"
                        x={x0 + j * (barW + gap)}
                        y={yTop}
                        width={barW}
                        height={Math.max(3, Math.abs(y(v) - y(0)))}
                        rx={Math.min(8, barW / 3)}
                        fill={`url(#${uid}-${on ? `s${j}` : "ghost"})`}
                        style={{ animationDelay: `${i * 35}ms` }}
                      >
                        <title>{`${label} · ${s.name}: ${format ? format(v) : v}`}</title>
                      </rect>
                    );
                  })}
                  {label !== "" && (
                    <text
                      x={left + band * i + band / 2}
                      y={h - 6}
                      textAnchor="middle"
                      style={on && highlight != null ? STRONG : LABEL}
                    >
                      {label}
                    </text>
                  )}
                </g>
              );
            })}
            {highlight != null && format && (
              <ValuePill
                cx={left + band * highlight + band / 2}
                y={y(peak) - 4}
                text={format(series[0]?.data[highlight] ?? 0)}
                width={w}
              />
            )}
          </>
        );
      }}
    </Frame>
  );
}

/** Hatched area with a lime line, dots, an optional dashed comparison line and a pill on the last point. */
export function HatchedAreaChart({
  labels,
  values,
  compare,
  format,
  axis,
  floor = 0,
  ariaLabel,
  className,
}: {
  labels: string[];
  values: number[];
  compare?: number[];
  format?: (value: number) => string;
  axis?: (value: number) => string;
  floor?: number;
  ariaLabel: string;
  className?: string;
}) {
  const { ref, box } = useBox();
  const uid = useId().replaceAll(":", "");
  return (
    <Frame box={box} boxRef={ref} ariaLabel={ariaLabel} className={className}>
      {({ w, h }) => {
        if (values.length === 0) return null;
        const compact = w < 480;
        const left = compact ? 2 : 48;
        const right = compact ? 2 : 12;
        const topPad = 36;
        const bottomPad = 24;
        const top = niceCeil(Math.max(1, ...values, ...(compare ?? [])) * 1.05);
        const y = (v: number) =>
          topPad + ((top - v) / (top - floor)) * (h - topPad - bottomPad);
        const n = values.length;
        const x = (i: number) =>
          left + (w - left - right) * (n === 1 ? 0.5 : i / (n - 1));
        const line = values
          .map((v, i) => `${i ? "L" : "M"}${x(i)} ${y(v)}`)
          .join(" ");
        const tick = axis ?? format ?? ((v: number) => String(Math.round(v)));
        return (
          <>
            <defs>
              <Hatch id={`${uid}-a`} color="var(--wm-lime)" />
            </defs>
            {!compact && (
              <Grid
                y={y}
                top={top}
                bottom={floor}
                left={left}
                right={right}
                width={w}
                axis={tick}
              />
            )}
            <path
              d={`${line} L${x(n - 1)} ${y(floor)} L${x(0)} ${y(floor)}Z`}
              fill={`url(#${uid}-a)`}
              opacity={0.45}
            />
            {compare && (
              <path
                d={compare
                  .map((v, i) => `${i ? "L" : "M"}${x(i)} ${y(v)}`)
                  .join(" ")}
                fill="none"
                style={{ stroke: "var(--ctext)" }}
                strokeWidth={1.5}
                strokeDasharray="5 5"
              />
            )}
            <path
              d={line}
              fill="none"
              style={{ stroke: "var(--wm-lime)" }}
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
            {labels.map((label, i) => (
              <g key={`${label}-${i}`}>
                <text
                  x={x(i)}
                  y={h - 6}
                  textAnchor={
                    compact && i === 0
                      ? "start"
                      : compact && i === n - 1
                        ? "end"
                        : "middle"
                  }
                  style={LABEL}
                >
                  {label}
                </text>
                <circle
                  cx={x(i)}
                  cy={y(values[i] ?? 0)}
                  r={i === n - 1 ? 5 : 3}
                  style={{
                    fill: i === n - 1 ? "var(--wm-lime)" : "var(--cbg)",
                    stroke: "var(--wm-lime)",
                  }}
                  strokeWidth={2}
                >
                  <title>{`${label}: ${format ? format(values[i] ?? 0) : values[i]}`}</title>
                </circle>
              </g>
            ))}
            {format && (
              <ValuePill
                cx={x(n - 1)}
                y={y(values[n - 1]) - 6}
                text={format(values[n - 1])}
                width={w}
              />
            )}
          </>
        );
      }}
    </Frame>
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
                      format(p.value).replace("Rp ", "")}
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

function tipX(width: number, count: number, index: number) {
  const left = width < 480 ? 2 : 44;
  return left + ((width - left - 4) / Math.max(1, count)) * (index + 0.5);
}

export type FlowDay = {
  label: string;
  savings: number;
  income: number;
  expense: number;
};

/**
 * Diverging stacked bars (prototype Beranda hero): savings stacked on income
 * above zero, expense below. `highlight` keeps one column in colour and greys
 * the rest; hovering or focusing a column shows its breakdown.
 */
export function FlowStackChart({
  days,
  highlight,
  format,
  axis,
  labels,
  ariaLabel,
  className,
}: {
  days: FlowDay[];
  highlight?: number;
  format: (value: number) => string;
  axis?: (value: number) => string;
  labels: { savings: string; income: string; expense: string };
  ariaLabel: string;
  className?: string;
}) {
  const { ref, box } = useBox();
  const uid = useId().replaceAll(":", "");
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? highlight ?? null;
  return (
    <>
      <Frame box={box} boxRef={ref} ariaLabel={ariaLabel} className={className}>
        {({ w, h }) => {
          const compact = w < 480;
          const left = compact ? 2 : 44;
          const right = 4;
          const topPad = 12;
          const bottomPad = 24;
          // Keep both halves readable: neither side shrinks below half the other.
          const up = Math.max(0, ...days.map((d) => d.income + d.savings));
          const low = Math.max(0, ...days.map((d) => d.expense));
          const top = niceCeil(Math.max(1, up, low / 2));
          const bottom = low > 0 ? -niceCeil(Math.max(low, up / 2)) : 0;
          const y = (v: number) =>
            topPad + ((top - v) / (top - bottom)) * (h - topPad - bottomPad);
          const band = (w - left - right) / Math.max(1, days.length);
          const barW = Math.min(64, band * 0.62);
          const seg = (
            key: string,
            x: number,
            from: number,
            to: number,
            fillId: string,
            i: number,
          ) =>
            Math.abs(y(from) - y(to)) < 0.5 ? null : (
              <rect
                key={key}
                className="wm-chart-bar"
                x={x}
                y={Math.min(y(from), y(to)) + 1}
                width={barW}
                height={Math.max(2, Math.abs(y(from) - y(to)) - 2)}
                rx={Math.min(8, barW / 4)}
                fill={`url(#${uid}-${fillId})`}
                style={{ animationDelay: `${i * 35}ms` }}
              />
            );
          return (
            <>
              <defs>
                <Hatch id={`${uid}-sav`} color="var(--wm-yellow)" />
                <Hatch id={`${uid}-inc`} color="var(--wm-lime)" />
                <Hatch id={`${uid}-exp`} color="var(--wm-orange)" />
                <Hatch id={`${uid}-ghost`} color="var(--cghost)" />
              </defs>
              {!compact && (
                <Grid
                  y={y}
                  top={top}
                  bottom={bottom}
                  left={left}
                  right={right}
                  width={w}
                  axis={axis ?? format}
                />
              )}
              {days.map((d, i) => {
                const on = shown == null || i === shown;
                const x = left + band * i + band / 2 - barW / 2;
                return (
                  <g
                    key={`${d.label}-${i}`}
                    tabIndex={0}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    style={{ outline: "none" }}
                  >
                    <rect
                      x={left + band * i}
                      y={0}
                      width={band}
                      height={h}
                      fill="transparent"
                    />
                    {seg("i", x, 0, d.income, on ? "inc" : "ghost", i)}
                    {seg(
                      "s",
                      x,
                      d.income,
                      d.income + d.savings,
                      on ? "sav" : "ghost",
                      i,
                    )}
                    {seg("e", x, 0, -d.expense, on ? "exp" : "ghost", i)}
                    {d.label !== "" && (
                      <text
                        x={x + barW / 2}
                        y={h - 6}
                        textAnchor="middle"
                        style={i === shown ? STRONG : LABEL}
                      >
                        {d.label}
                      </text>
                    )}
                    <title>{`${d.label} · ${labels.savings} ${format(d.savings)} · ${labels.income} ${format(d.income)} · ${labels.expense} ${format(d.expense)}`}</title>
                  </g>
                );
              })}
            </>
          );
        }}
      </Frame>
      {shown != null && days[shown] && box && (
        <div
          className="wm-chart-tip"
          aria-hidden="true"
          style={{
            left: Math.min(
              box.w - 190,
              Math.max(0, tipX(box.w, days.length, shown) - 95),
            ),
          }}
        >
          <b>{days[shown].label}</b>
          <div>
            <span>{labels.savings}</span>
            <span>{format(days[shown].savings)}</span>
          </div>
          <div>
            <span>{labels.income}</span>
            <span>{format(days[shown].income)}</span>
          </div>
          <div>
            <span>{labels.expense}</span>
            <span>{format(days[shown].expense)}</span>
          </div>
        </div>
      )}
    </>
  );
}

/** Semicircle tick gauge (prototype "Kesehatan finansial"): `value` 0..100 lights ticks yellow → lime. */
export function TickGauge({
  value,
  ariaLabel,
  children,
}: {
  value: number;
  ariaLabel: string;
  children?: ReactNode;
}) {
  const ticks = 36;
  const lit = Math.round((Math.max(0, Math.min(100, value)) / 100) * ticks);
  return (
    <div className="wm-gauge" role="img" aria-label={ariaLabel}>
      <svg viewBox="0 0 240 130" aria-hidden="true">
        {Array.from({ length: ticks }, (_, i) => {
          const a = Math.PI - (i / (ticks - 1)) * Math.PI;
          const cx = 120 + Math.cos(a) * 92;
          const cy = 120 - Math.sin(a) * 92;
          const on = i < lit;
          const t = i / (ticks - 1);
          return (
            <rect
              key={i}
              x={cx - 3.5}
              y={cy - 14}
              width={7}
              height={28}
              rx={3}
              transform={`rotate(${90 - (a * 180) / Math.PI} ${cx} ${cy})`}
              style={{
                fill: on
                  ? `color-mix(in srgb, var(--wm-lime) ${Math.round(t * 100)}%, var(--wm-yellow))`
                  : "var(--wm-ghost)",
              }}
            />
          );
        })}
      </svg>
      <div className="wm-gauge-center">{children}</div>
    </div>
  );
}
