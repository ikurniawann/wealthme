import React from "react";

/**
 * WealthMe Donut — SVG ring chart with a centered label. Segments accept CSS
 * vars or hex. Used for wealth allocation. Pair with DonutLegend.
 */
export function Donut({
  segments = [],
  size = 120,
  thickness = 17,
  centerValue,
  centerLabel,
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circ = 2 * Math.PI * radius;
  let acc = 0;
  const arcs = segments.map((seg) => {
    const len = (seg.value / total) * circ;
    const offset = acc;
    acc += len;
    return { seg, len, offset };
  });
  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={thickness}
        />
        {arcs.map(({ seg, len, offset }, i) => (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={thickness}
            strokeDasharray={`${len} ${circ - len}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      {(centerValue || centerLabel) && (
        <div
          style={{
            position: "absolute",
            textAlign: "center",
            pointerEvents: "none",
            fontFamily: "var(--font-sans)",
          }}
        >
          {centerValue && (
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                lineHeight: 1.1,
                color: "var(--foreground)",
              }}
            >
              {centerValue}
            </div>
          )}
          {centerLabel && (
            <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
              {centerLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Legend rows for a Donut, sharing the same segment shape. */
export function DonutLegend({ segments = [], total }) {
  const sum = total ?? (segments.reduce((s, x) => s + x.value, 0) || 1);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        fontFamily: "var(--font-sans)",
      }}
    >
      {segments.map((seg, i) => (
        <div key={i}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                flexShrink: 0,
                borderRadius: 999,
                background: seg.color,
              }}
            />
            <span style={{ flex: 1, color: "var(--muted-foreground)" }}>
              {seg.label}
            </span>
            <span style={{ fontWeight: 700, color: "var(--foreground)" }}>
              {Math.round((seg.value / sum) * 100)}%
            </span>
          </div>
          {seg.sub && (
            <div
              style={{
                marginLeft: 16,
                marginTop: -2,
                fontSize: 10.5,
                color: "var(--muted-foreground)",
              }}
            >
              {seg.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
