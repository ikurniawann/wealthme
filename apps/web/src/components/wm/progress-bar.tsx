import { cn } from "@/lib/utils";

/**
 * EPIC-026 design-system migration — prototype `.progress` / `.progress__bar`.
 * `color` and `height` stay inline: they are per-call-site values the
 * prototype also sets with a style attribute, not modifier classes.
 */
export function ProgressBar({
  value,
  color = "var(--primary)",
  className,
  height = 7,
}: {
  value: number;
  color?: string;
  className?: string;
  height?: number;
}) {
  return (
    <div className={cn("progress", className)} style={{ height }}>
      <div
        className="progress__bar"
        style={{
          transform: `scaleX(${Math.min(100, Math.max(0, value)) / 100})`,
          background: color,
        }}
      />
    </div>
  );
}
