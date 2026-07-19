import React from "react";

/**
 * WealthMe ProgressBar — thin rounded track + fill. Color is free-form so it
 * can reflect goal status (primary / success / warning / brand-purple).
 */
export function ProgressBar({
  value = 0,
  color = "var(--primary)",
  height = 7,
  className,
  style,
  ...props
}) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      style={{
        overflow: "hidden",
        borderRadius: "var(--radius-pill)",
        background: "var(--muted)",
        height,
        ...style,
      }}
      {...props}
    >
      <div
        style={{
          height: "100%",
          width: pct + "%",
          borderRadius: "var(--radius-pill)",
          background: color,
          transition: "width .7s cubic-bezier(.4,0,.2,1)",
        }}
      />
    </div>
  );
}
