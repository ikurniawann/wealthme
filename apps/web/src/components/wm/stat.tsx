import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * EPIC-026 design-system migration — prototype `.card.stat` block
 * (`.stat__icon` / `.stat__label` / `.stat__value` / `.stat__delta`), matching
 * the markup in `docs/prototype/pages/beranda.html`.
 */
export function SummaryCard({
  icon,
  iconBg,
  iconColor,
  label,
  amount,
  delta,
  deltaUp,
  caption,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor?: string;
  label: React.ReactNode;
  amount: React.ReactNode;
  delta?: React.ReactNode;
  deltaUp?: boolean;
  /** A neutral fact (e.g. a count), not a trend — renders without the
   *  success/danger color `delta` always gets. Ignored when `delta` is set. */
  caption?: React.ReactNode;
}) {
  return (
    <article className="card stat">
      <div
        className="stat__icon"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div>
        <div className="stat__label">{label}</div>
        <div className="stat__value wm-amt">{amount}</div>
      </div>
      {delta ? (
        <div
          className={cn(
            "stat__delta tabular-nums",
            deltaUp ? "t-success" : "t-danger",
          )}
        >
          {delta}
        </div>
      ) : (
        caption && (
          <div className="stat__delta stat__delta--neutral tabular-nums">
            {caption}
          </div>
        )
      )}
    </article>
  );
}

/** Bare label/value pair — the prototype's `.stat__label` + `.stat__value`
 *  typography without the surrounding `.card.stat` shell. */
export function MoneyStat({
  label,
  value,
  valueClass,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  valueClass?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="stat__label">{label}</div>
      <div className={cn("stat__value wm-amt", valueClass)}>{value}</div>
    </div>
  );
}
