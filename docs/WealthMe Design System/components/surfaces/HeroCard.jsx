import React from "react";

/**
 * WealthMe HeroCard — gradient "wealth" surface for net-worth / totals. White
 * text on an indigo gradient with a soft top-right glow ring. Pair with
 * gradient class names (gradient-wealth / gradient-profile / gradient-ai).
 */
export function HeroCard({
  gradient = "gradient-wealth",
  padding = 22,
  className,
  style,
  children,
  ...props
}) {
  return (
    <div
      className={gradient + (className ? " " + className : "")}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "var(--radius-lg)",
        padding,
        color: "#fff",
        fontFamily: "var(--font-sans)",
        ...style,
      }}
      {...props}
    >
      <div
        style={{
          position: "absolute",
          top: -48,
          right: -48,
          width: 220,
          height: 220,
          borderRadius: "50%",
          background: "rgba(255,255,255,.06)",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}
