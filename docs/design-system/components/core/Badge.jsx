import React from "react";

/**
 * WealthMe Badge — small pill label. Solid for counts/primary, soft-fill for
 * semantic states, outline/ghost for low emphasis. Fully rounded.
 */
export function Badge({
  variant = "default",
  className,
  style,
  children,
  ...props
}) {
  const variants = {
    default: {
      background: "var(--primary)",
      color: "var(--primary-foreground)",
    },
    secondary: {
      background: "var(--secondary)",
      color: "var(--secondary-foreground)",
    },
    destructive: {
      background: "color-mix(in oklab, var(--destructive) 12%, transparent)",
      color: "var(--destructive)",
    },
    success: { background: "var(--success-soft)", color: "#15803d" },
    warning: { background: "var(--warning-soft)", color: "#b45309" },
    purple: { background: "var(--brand-purple-soft)", color: "#6d28d9" },
    outline: {
      background: "transparent",
      color: "var(--foreground)",
      boxShadow: "inset 0 0 0 1px var(--border)",
    },
  };
  const v = variants[variant] || variants.default;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        height: 20,
        padding: "0 8px",
        borderRadius: "var(--radius-pill)",
        fontFamily: "var(--font-sans)",
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: "nowrap",
        ...v,
        ...style,
      }}
      {...props}
    >
      {children}
    </span>
  );
}
