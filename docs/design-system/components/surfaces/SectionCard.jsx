import React from "react";

/**
 * WealthMe SectionCard — titled content card. Muted bold title on the left,
 * optional action (link / select) on the right, body below. The workhorse
 * dashboard panel.
 */
export function SectionCard({
  title,
  action,
  padding = 20,
  className,
  style,
  bodyStyle,
  children,
  ...props
}) {
  return (
    <div
      style={{
        background: "var(--card)",
        color: "var(--card-foreground)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--ring-card)",
        padding,
        fontFamily: "var(--font-sans)",
        ...style,
      }}
      {...props}
    >
      {(title || action) && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 14,
          }}
        >
          {title && (
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 700,
                color: "var(--muted-foreground)",
              }}
            >
              {title}
            </div>
          )}
          {action}
        </div>
      )}
      <div style={bodyStyle}>{children}</div>
    </div>
  );
}
