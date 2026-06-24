import React from "react";

/**
 * WealthMe StatusBadge — soft-fill status pill with an optional leading dot.
 * Used in tables, goal rows, account lists. Larger & friendlier than Badge.
 */
export function StatusBadge({
  variant = "gray",
  dot = false,
  className,
  style,
  children,
  ...props
}) {
  const variants = {
    success: { background: "var(--success-soft)", color: "#15803d" },
    danger: { background: "#fee2e2", color: "#b91c1c" },
    warning: { background: "var(--warning-soft)", color: "#b45309" },
    info: { background: "#dbeafe", color: "#1d4ed8" },
    purple: { background: "var(--brand-purple-soft)", color: "#6d28d9" },
    gray: {
      background: "var(--secondary)",
      color: "var(--secondary-foreground)",
    },
  };
  const v = variants[variant] || variants.gray;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        borderRadius: "var(--radius-pill)",
        padding: "3px 11px",
        fontFamily: "var(--font-sans)",
        fontSize: 11,
        fontWeight: 600,
        ...v,
        ...style,
      }}
      {...props}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: "currentColor",
          }}
        />
      )}
      {children}
    </span>
  );
}
