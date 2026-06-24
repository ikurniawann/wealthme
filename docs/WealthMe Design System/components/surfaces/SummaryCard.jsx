import React from "react";

/**
 * WealthMe SummaryCard — small KPI tile: tinted icon chip, label, extrabold
 * amount, and an optional up/down delta. The 5-across row on the dashboard.
 */
export function SummaryCard({
  icon,
  iconBg = "var(--secondary)",
  iconColor,
  label,
  amount,
  delta,
  deltaUp = true,
  style,
  ...props
}) {
  return (
    <div
      style={{
        background: "var(--card)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--ring-card)",
        padding: 16,
        fontFamily: "var(--font-sans)",
        ...style,
      }}
      {...props}
    >
      <div
        style={{
          width: 34,
          height: 34,
          marginBottom: 8,
          borderRadius: "var(--radius-md)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 15,
          background: iconBg,
          color: iconColor,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          marginBottom: 2,
          fontSize: 10.5,
          fontWeight: 500,
          color: "var(--muted-foreground)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginBottom: 3,
          fontSize: 15,
          fontWeight: 800,
          color: "var(--foreground)",
        }}
      >
        {amount}
      </div>
      {delta != null && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            fontSize: 10.5,
            fontWeight: 700,
            color: deltaUp ? "var(--success)" : "var(--destructive)",
          }}
        >
          <span>{deltaUp ? "▲" : "▼"}</span>
          {delta}
        </div>
      )}
    </div>
  );
}
