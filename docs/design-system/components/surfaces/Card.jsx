import React from "react";

/**
 * WealthMe Card — the base surface. White (or tinted dark) panel with a soft
 * 1px foreground ring instead of a heavy shadow. 14px radius. Most app
 * surfaces are built on this.
 */
export function Card({ padding = 16, className, style, children, ...props }) {
  return (
    <div
      style={{
        background: "var(--card)",
        color: "var(--card-foreground)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--ring-card)",
        padding,
        fontFamily: "var(--font-sans)",
        fontSize: 13,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
