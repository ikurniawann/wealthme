import React from "react";

/**
 * WealthMe MoneyStat — label over an extrabold value. The atomic money
 * read-out used in cashflow rows, account headers, report KPIs.
 */
export function MoneyStat({
  label,
  value,
  valueColor = "var(--foreground)",
  size = 17,
  align = "left",
  style,
  ...props
}) {
  return (
    <div
      style={{ textAlign: align, fontFamily: "var(--font-sans)", ...style }}
      {...props}
    >
      <div
        style={{
          marginBottom: 3,
          fontSize: 11,
          color: "var(--muted-foreground)",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: size, fontWeight: 800, color: valueColor }}>
        {value}
      </div>
    </div>
  );
}
