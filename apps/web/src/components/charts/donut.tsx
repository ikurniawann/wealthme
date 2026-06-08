"use client";

export type DonutSegment = { label: string; value: number; color: string; sub?: string };

type DonutProps = {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerValue?: string;
  centerLabel?: string;
};

/** SVG donut chart with a centered label. Colors accept CSS vars or hex. */
export function Donut({
  segments,
  size = 150,
  thickness = 18,
  centerValue,
  centerLabel,
}: DonutProps) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  // Precompute each segment's arc length and its starting offset (no mutation in render).
  const arcs = segments.reduce<{ seg: DonutSegment; len: number; offset: number }[]>((acc, seg) => {
    const len = (seg.value / total) * circumference;
    const offset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].len : 0;
    acc.push({ seg, len, offset });
    return acc;
  }, []);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
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
            strokeDasharray={`${len} ${circumference - len}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      {(centerValue || centerLabel) && (
        <div className="pointer-events-none absolute text-center">
          {centerValue && <div className="text-sm font-extrabold leading-tight">{centerValue}</div>}
          {centerLabel && <div className="text-[10px] text-muted-foreground">{centerLabel}</div>}
        </div>
      )}
    </div>
  );
}

/** Legend rows for a donut, sharing the same segment shape. */
export function DonutLegend({ segments, total }: { segments: DonutSegment[]; total?: number }) {
  const sum = total ?? (segments.reduce((s, x) => s + x.value, 0) || 1);
  return (
    <div className="space-y-1.5">
      {segments.map((seg, i) => (
        <div key={i}>
          <div className="flex items-center gap-2 text-xs">
            <span className="size-2 shrink-0 rounded-full" style={{ background: seg.color }} />
            <span className="flex-1 text-muted-foreground">{seg.label}</span>
            <span className="font-bold">{Math.round((seg.value / sum) * 100)}%</span>
          </div>
          {seg.sub && <div className="ml-[15px] mt-[-2px] text-[10.5px] text-muted-foreground">{seg.sub}</div>}
        </div>
      ))}
    </div>
  );
}
