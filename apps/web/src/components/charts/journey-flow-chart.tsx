"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

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

  if (sources.length === 0 && destinations.length === 0) return null;

  return (
    <div ref={ref} className={className} style={{ position: "relative" }}>
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
              // Room for each side's longest label (Sora 11px ≈ 6.4px per
              // char, same measurement `bento-charts.tsx` uses for its
              // axis-tick width) — a fixed gap either clips long category
              // names ("Lainnya Pemasukan") or wastes space on short ones.
              const charW = 6.4;
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

              const LABEL_MIN_GAP = 26;
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

              return (
                <>
                  {left.map((node) => {
                    const height = node.y1 - node.y0;
                    const y0 = cursorLeft;
                    const y1 = cursorLeft + height;
                    cursorLeft = y1;
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
                        fill={node.color}
                        opacity={0.35}
                      />
                    );
                  })}
                  {right.map((node) => {
                    const height = node.y1 - node.y0;
                    const y0 = cursorRight;
                    const y1 = cursorRight + height;
                    cursorRight = y1;
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
                        fill={node.color}
                        opacity={0.35}
                      />
                    );
                  })}

                  {left.map((node, i) => {
                    const nodeCenter = (node.y0 + node.y1) / 2;
                    const labelCenter = leftLabelY[i];
                    return (
                      <g key={`ln-${node.id}`}>
                        <rect
                          x={leftX}
                          y={node.y0}
                          width={nodeW}
                          height={Math.max(1, node.y1 - node.y0)}
                          fill={node.color}
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
                          style={STRONG}
                        >
                          {node.label}
                        </text>
                        <text
                          x={leftX - 8}
                          y={labelCenter + 11}
                          textAnchor="end"
                          style={LABEL}
                        >
                          {format(node.value)}
                        </text>
                      </g>
                    );
                  })}

                  <rect
                    x={midX - nodeW}
                    y={midTop}
                    width={nodeW * 2}
                    height={Math.max(1, midBottom - midTop)}
                    fill={totalColor}
                    rx={2}
                  />
                  <text
                    x={midX}
                    y={midTop - 10}
                    textAnchor="middle"
                    style={STRONG}
                  >
                    {totalLabel}
                  </text>
                  <text
                    x={midX}
                    y={midTop - 10 + 13}
                    textAnchor="middle"
                    style={LABEL}
                  >
                    {format(totalValue)}
                  </text>

                  {right.map((node, i) => {
                    const nodeCenter = (node.y0 + node.y1) / 2;
                    const labelCenter = rightLabelY[i];
                    return (
                      <g key={`rn-${node.id}`}>
                        <rect
                          x={rightX - nodeW}
                          y={node.y0}
                          width={nodeW}
                          height={Math.max(1, node.y1 - node.y0)}
                          fill={node.color}
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
                          style={STRONG}
                        >
                          {node.label}
                        </text>
                        <text
                          x={rightX + 8}
                          y={labelCenter + 11}
                          textAnchor="start"
                          style={LABEL}
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
