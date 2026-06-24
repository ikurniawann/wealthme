import React from "react";

/**
 * WealthMe BarChart — grouped income/expense bars per month. Green = income,
 * red = expense. Ported from the app's renderBar(). Pure CSS bars.
 */
export function BarChart({
  months = [],
  income = [],
  expense = [],
  max,
  height = 90,
  showLegend = true,
}) {
  const peak = max || Math.max(1, ...income, ...expense);
  return (
    <div style={{ fontFamily: "var(--font-sans)" }}>
      {showLegend && (
        <div
          style={{
            marginBottom: 8,
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: "var(--muted-foreground)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: "var(--success)",
              }}
            />{" "}
            Pemasukan
          </span>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: "var(--muted-foreground)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: "var(--destructive)",
              }}
            />{" "}
            Pengeluaran
          </span>
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          paddingTop: 8,
          height,
        }}
      >
        {months.map((_, i) => (
          <div
            key={i}
            style={{ display: "flex", flex: 1, alignItems: "flex-end", gap: 2 }}
          >
            <div
              style={{
                flex: 1,
                minHeight: 3,
                borderRadius: "3px 3px 0 0",
                background: "var(--success)",
                height: `${(income[i] / peak) * 100}%`,
              }}
            />
            <div
              style={{
                flex: 1,
                minHeight: 3,
                borderRadius: "3px 3px 0 0",
                background: "var(--destructive)",
                height: `${(expense[i] / peak) * 100}%`,
              }}
            />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
        {months.map((m, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 10,
              color: "var(--muted-foreground)",
              fontWeight: i === months.length - 1 ? 700 : 400,
            }}
          >
            {m}
          </div>
        ))}
      </div>
    </div>
  );
}
