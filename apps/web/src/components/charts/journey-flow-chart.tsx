"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

/**
 * "Arus Kas" journey-flow chart (2026-10-06) — a from-scratch, two-stage
 * Sankey-style flow: income sources converge into a single "Total" node,
 * which then fans out to expense categories plus a "Surplus" node.
 * Recreated locally instead of installing uiarc.dev's `journey-flow`
 * block, which is Pro-only (not in the free catalog this app is allowed
 * to use) — no new runtime dependency, same `--wm-lime`/`--wm-orange`/
 * `--ctext`/`--cgrid` CSS vars as `bento-charts.tsx`, same "measure the
 * real box, draw in real pixels" approach (own copy, not importing that
 * file's private helpers) so labels stay crisp at any card size.
 *
 * Bolder pass (2026-10-06): the first version drew every ribbon as a flat
 * same-hue fill at a single low opacity, so a column of same-side nodes
 * (every real category falls back to the same two brand tones — WealthMe
 * deliberately keeps "lime is the single brand accent") fused into one
 * undifferentiated blob instead of reading as distinct flows. This now
 * reuses the chart library's own signature device — the diagonal hatch
 * fill `bento-charts.tsx`'s `HatchedBarChart`/`HatchedAreaChart` already
 * use everywhere else in this app — plus a same-hue tonal ramp
 * (`color-mix` against the existing brand tokens, never a new color) so
 * each ribbon in a stack is visually distinct without leaving the
 * system's two-hue (income/expense) vocabulary.
 *
 * Hover/tap highlight + mobile compaction (2026-10-06): hovering (or, on
 * touch, tapping) a node dims every other flow so its own ribbon reads on
 * its own. Only that one ribbon highlights — never a source-to-destination
 * path — because this chart has no per-transaction attribution linking a
 * specific income category to a specific expense category; the API only
 * gives per-category totals (`ReportSummaryDto.topIncomeCategories`/
 * `topExpenseCategories`). Implying a traced path would fabricate data the
 * app doesn't have. Below ~420px the chart shrinks its label text and
 * tightens the declutter gap — the wrapping `.wm-chart` card also grows
 * taller under that same breakpoint (`bento.css`'s `.wm-chart--flow`) so
 * the extra vertical room, not a cramped one, is what absorbs several
 * categories on a phone-width viewport.
 */

export type FlowNode = {
  id: string;
  label: string;
  value: number;
  color: string;
};

type Box = { w: number; h: number };

function useBox() {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setBox({
        w: Math.max(280, el.clientWidth),
        h: Math.max(160, el.clientHeight),
      });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, box };
}

const LABEL: CSSProperties = { fill: "var(--ctext)", fontSize: 11 };
const STRONG: CSSProperties = {
  fill: "var(--cstrong, var(--ctext))",
  fontSize: 11,
  fontWeight: 600,
};

/**
 * Same diagonal-stripe recipe as `bento-charts.tsx`'s private `Hatch` —
 * duplicated rather than imported (that file's helpers aren't exported;
 * see the file header), one definition per node so each hatched ribbon
 * can carry its own tonal shade (see `shade` below).
 */
function Hatch({ id, color }: { id: string; color: string }) {
  return (
    <pattern
      id={id}
      width="8"
      height="8"
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <rect width="8" height="8" fill={color} />
      <rect width="2" height="8" fill="rgba(255,255,255,.26)" />
    </pattern>
  );
}

/**
 * A same-hue tonal ramp so a stack of nodes that all fall back to the same
 * brand color (the common case — most categories carry no COA color) still
 * reads as distinct bands. Mixes the existing token against the card
 * background via `color-mix`, never introduces a new hex value.
 */
function shade(color: string, index: number, count: number): string {
  if (count <= 1) return color;
  const pct = 100 - index * (45 / Math.max(1, count - 1));
  return `color-mix(in oklab, ${color} ${pct}%, var(--cbg))`;
}

/** Stacked vertical positions for a column of nodes, each sized by value. */
function layoutColumn(
  nodes: FlowNode[],
  total: number,
  top: number,
  bottom: number,
  gap: number,
) {
  const usable = Math.max(
    1,
    bottom - top - gap * Math.max(0, nodes.length - 1),
  );
  let y = top;
  return nodes.map((node) => {
    const height = total > 0 ? (node.value / total) * usable : 0;
    const band = { ...node, y0: y, y1: y + height };
    y += height + gap;
    return band;
  });
}

/**
 * Pushes a sorted list of label centers apart so none sit closer than
 * `minGap`, then clamps the whole stack back inside [top, bottom]. Needed
 * because node *height* is proportional to value (a Rp 500rb expense next
 * to a Rp 57jt surplus draws a sliver), but a label needs a fixed minimum
 * amount of vertical room regardless — without this, three small nodes
 * stacked together render as overlapping, unreadable text.
 */
function declutter(
  centers: number[],
  minGap: number,
  top: number,
  bottom: number,
): number[] {
  const out = [...centers];
  for (let i = 1; i < out.length; i++) {
    if (out[i] - out[i - 1] < minGap) out[i] = out[i - 1] + minGap;
  }
  const overflow = out[out.length - 1] - bottom;
  if (overflow > 0) for (let i = 0; i < out.length; i++) out[i] -= overflow;
  for (let i = out.length - 2; i >= 0; i--) {
    if (out[i] > out[i + 1] - minGap) out[i] = out[i + 1] - minGap;
  }
  return out.map((y) => Math.max(top, y));
}

/** A smooth flowing band between two column edges (classic Sankey ribbon). */
function ribbonPath(
  x1: number,
  y1top: number,
  y1bot: number,
  x2: number,
  y2top: number,
  y2bot: number,
) {
  const midX = (x1 + x2) / 2;
  return `M${x1},${y1top} C${midX},${y1top} ${midX},${y2top} ${x2},${y2top} L${x2},${y2bot} C${midX},${y2bot} ${midX},${y1bot} ${x1},${y1bot} Z`;
}

export function JourneyFlowChart({
  sources,
  destinations,
  totalLabel,
  totalValue,
  totalColor = "var(--wm-lime)",
  format,
  ariaLabel,
  className,
}: {
  /** Left column — e.g. income categories. */
  sources: FlowNode[];
  /** Right column — e.g. expense categories plus a "Surplus" node. */
  destinations: FlowNode[];
  totalLabel: string;
  totalValue: number;
  totalColor?: string;
  format: (value: number) => string;
  ariaLabel: string;
  className?: string;
}) {
  const { ref, box } = useBox();
  const uid = useId().replaceAll(":", "");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (sources.length === 0 && destinations.length === 0) return null;

  return (
    <div
      ref={ref}
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
          <g aria-hidden="true">
            {(() => {
              const nodeW = 10;
              // Below ~420px, fold the amount onto the label line and
              // tighten spacing — the two-line-per-node layout was the
              // main contributor to label crowding on a phone-width card.
              const compact = box.w < 420;
              const fontSize = compact ? 10 : 11;
              // Room for each side's longest label (Sora 11px ≈ 6.4px per
              // char, same measurement `bento-charts.tsx` uses for its
              // axis-tick width) — a fixed gap either clips long category
              // names ("Lainnya Pemasukan") or wastes space on short ones.
              const charW = compact ? 5.7 : 6.4;
              const labelGapFor = (nodes: FlowNode[]) =>
                Math.max(
                  60,
                  Math.min(
                    160,
                    Math.max(0, ...nodes.map((n) => n.label.length)) * charW +
                      16,
                  ),
                );
              const leftGap = labelGapFor(sources);
              const rightGap = labelGapFor(destinations);
              const leftX = leftGap;
              const midX = box.w / 2;
              const rightX = box.w - rightGap;
              const top = 28;
              const bottom = box.h - 20;
              const gap = 6;

              const left = layoutColumn(sources, totalValue, top, bottom, gap);
              const right = layoutColumn(
                destinations,
                totalValue,
                top,
                bottom,
                gap,
              );
              // The single "Total" node spans the same vertical range as
              // the stacked columns — sources and destinations both sum to
              // `totalValue` by construction (surplus is itself a
              // destination node), so the three columns stay the same
              // total height with no separate scaling.
              const midTop = top;
              const midBottom = bottom;

              const LABEL_MIN_GAP = compact ? 22 : 26;
              const leftLabelY = declutter(
                left.map((n) => (n.y0 + n.y1) / 2),
                LABEL_MIN_GAP,
                top,
                bottom,
              );
              const rightLabelY = declutter(
                right.map((n) => (n.y0 + n.y1) / 2),
                LABEL_MIN_GAP,
                top,
                bottom,
              );

              let cursorLeft = midTop;
              let cursorRight = midTop;

              // Same-hue tonal ramp per column — the fix for the flat,
              // undifferentiated-blob look: every real category falls back
              // to the same two brand tones, so without this every ribbon
              // on a side rendered as one indistinguishable mass.
              const leftShades = left.map((n, i) =>
                shade(n.color, i, left.length),
              );
              const rightShades = right.map((n, i) =>
                shade(n.color, i, right.length),
              );

              return (
                <>
                  <defs>
                    {left.map((node, i) => (
                      <Hatch
                        key={`hl-${node.id}`}
                        id={`${uid}-l${i}`}
                        color={leftShades[i]}
                      />
                    ))}
                    {right.map((node, i) => (
                      <Hatch
                        key={`hr-${node.id}`}
                        id={`${uid}-r${i}`}
                        color={rightShades[i]}
                      />
                    ))}
                    <Hatch id={`${uid}-total`} color={totalColor} />
                  </defs>

                  {left.map((node, i) => {
                    const height = node.y1 - node.y0;
                    const y0 = cursorLeft;
                    const y1 = cursorLeft + height;
                    cursorLeft = y1;
                    const isOther = hoveredId !== null && hoveredId !== node.id;
                    const isActive = hoveredId === node.id;
                    return (
                      <path
                        key={`l-${node.id}`}
                        d={ribbonPath(
                          leftX + nodeW,
                          node.y0,
                          node.y1,
                          midX - nodeW,
                          y0,
                          y1,
                        )}
                        fill={leftShades[i]}
                        opacity={isOther ? 0.1 : isActive ? 0.9 : 0.55}
                        stroke={leftShades[i]}
                        strokeWidth={isActive ? 1.5 : 1}
                        style={{
                          transition: "opacity 120ms ease-out",
                          cursor: "pointer",
                        }}
                        onPointerEnter={() => setHoveredId(node.id)}
                        onPointerLeave={() => setHoveredId(null)}
                        onClick={() =>
                          setHoveredId((cur) =>
                            cur === node.id ? null : node.id,
                          )
                        }
                      />
                    );
                  })}
                  {right.map((node, i) => {
                    const height = node.y1 - node.y0;
                    const y0 = cursorRight;
                    const y1 = cursorRight + height;
                    cursorRight = y1;
                    const isOther = hoveredId !== null && hoveredId !== node.id;
                    const isActive = hoveredId === node.id;
                    return (
                      <path
                        key={`r-${node.id}`}
                        d={ribbonPath(
                          midX + nodeW,
                          y0,
                          y1,
                          rightX - nodeW,
                          node.y0,
                          node.y1,
                        )}
                        fill={rightShades[i]}
                        opacity={isOther ? 0.1 : isActive ? 0.9 : 0.55}
                        stroke={rightShades[i]}
                        strokeWidth={isActive ? 1.5 : 1}
                        style={{
                          transition: "opacity 120ms ease-out",
                          cursor: "pointer",
                        }}
                        onPointerEnter={() => setHoveredId(node.id)}
                        onPointerLeave={() => setHoveredId(null)}
                        onClick={() =>
                          setHoveredId((cur) =>
                            cur === node.id ? null : node.id,
                          )
                        }
                      />
                    );
                  })}

                  {left.map((node, i) => {
                    const nodeCenter = (node.y0 + node.y1) / 2;
                    const labelCenter = leftLabelY[i];
                    const isOther = hoveredId !== null && hoveredId !== node.id;
                    return (
                      <g
                        key={`ln-${node.id}`}
                        style={{
                          cursor: "pointer",
                          opacity: isOther ? 0.4 : 1,
                          transition: "opacity 120ms ease-out",
                        }}
                        onPointerEnter={() => setHoveredId(node.id)}
                        onPointerLeave={() => setHoveredId(null)}
                        onClick={() =>
                          setHoveredId((cur) =>
                            cur === node.id ? null : node.id,
                          )
                        }
                      >
                        <rect
                          x={leftX}
                          y={node.y0}
                          width={nodeW + 2}
                          height={Math.max(1, node.y1 - node.y0)}
                          fill={`url(#${uid}-l${i})`}
                          rx={2}
                        />
                        {Math.abs(labelCenter - nodeCenter) > 1 && (
                          <line
                            x1={leftX}
                            y1={nodeCenter}
                            x2={leftX - 6}
                            y2={labelCenter}
                            stroke="var(--cgrid)"
                            strokeWidth={1}
                          />
                        )}
                        <text
                          x={leftX - 8}
                          y={labelCenter - 2}
                          textAnchor="end"
                          style={{ ...STRONG, fontSize }}
                        >
                          {node.label}
                        </text>
                        <text
                          x={leftX - 8}
                          y={labelCenter + (compact ? 10 : 11)}
                          textAnchor="end"
                          style={{ ...LABEL, fontSize: fontSize - 1 }}
                        >
                          {format(node.value)}
                        </text>
                      </g>
                    );
                  })}

                  <rect
                    x={midX - nodeW - 1}
                    y={midTop}
                    width={nodeW * 2 + 2}
                    height={Math.max(1, midBottom - midTop)}
                    fill={`url(#${uid}-total)`}
                    rx={2}
                    opacity={hoveredId !== null ? 0.9 : 1}
                    style={{ transition: "opacity 120ms ease-out" }}
                  />
                  <text
                    x={midX}
                    y={midTop - 10}
                    textAnchor="middle"
                    style={{ ...STRONG, fontSize }}
                  >
                    {totalLabel}
                  </text>
                  <text
                    x={midX}
                    y={midTop - 10 + 13}
                    textAnchor="middle"
                    style={{ ...LABEL, fontSize: fontSize - 1 }}
                  >
                    {format(totalValue)}
                  </text>

                  {right.map((node, i) => {
                    const nodeCenter = (node.y0 + node.y1) / 2;
                    const labelCenter = rightLabelY[i];
                    const isOther = hoveredId !== null && hoveredId !== node.id;
                    return (
                      <g
                        key={`rn-${node.id}`}
                        style={{
                          cursor: "pointer",
                          opacity: isOther ? 0.4 : 1,
                          transition: "opacity 120ms ease-out",
                        }}
                        onPointerEnter={() => setHoveredId(node.id)}
                        onPointerLeave={() => setHoveredId(null)}
                        onClick={() =>
                          setHoveredId((cur) =>
                            cur === node.id ? null : node.id,
                          )
                        }
                      >
                        <rect
                          x={rightX - nodeW - 2}
                          y={node.y0}
                          width={nodeW + 2}
                          height={Math.max(1, node.y1 - node.y0)}
                          fill={`url(#${uid}-r${i})`}
                          rx={2}
                        />
                        {Math.abs(labelCenter - nodeCenter) > 1 && (
                          <line
                            x1={rightX}
                            y1={nodeCenter}
                            x2={rightX + 6}
                            y2={labelCenter}
                            stroke="var(--cgrid)"
                            strokeWidth={1}
                          />
                        )}
                        <text
                          x={rightX + 8}
                          y={labelCenter - 2}
                          textAnchor="start"
                          style={{ ...STRONG, fontSize }}
                        >
                          {node.label}
                        </text>
                        <text
                          x={rightX + 8}
                          y={labelCenter + (compact ? 10 : 11)}
                          textAnchor="start"
                          style={{ ...LABEL, fontSize: fontSize - 1 }}
                        >
                          {format(node.value)}
                        </text>
                      </g>
                    );
                  })}
                </>
              );
            })()}
          </g>
        </svg>
      )}
    </div>
  );
}
