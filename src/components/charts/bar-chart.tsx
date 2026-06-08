"use client";

type BarChartProps = {
  months: string[];
  income: number[];
  expense: number[];
  max: number;
  height?: number;
  showLegend?: boolean;
};

/** Grouped income/expense bar chart, ported from the demo's renderBar(). */
export function BarChart({ months, income, expense, max, height = 90, showLegend = true }: BarChartProps) {
  return (
    <div>
      {showLegend && (
        <div className="mb-2 flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="size-2 rounded-[2px] bg-success" /> Pemasukan
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="size-2 rounded-[2px] bg-destructive" /> Pengeluaran
          </div>
        </div>
      )}
      <div className="flex items-end gap-2 pt-2" style={{ height }}>
        {months.map((_, i) => (
          <div key={i} className="flex flex-1 items-end gap-0.5">
            <div
              className="min-h-[3px] flex-1 cursor-pointer rounded-t bg-success transition-opacity hover:opacity-75"
              style={{ height: `${(income[i] / max) * 100}%` }}
              title={`Pemasukan ${months[i]}: ${income[i]} jt`}
            />
            <div
              className="min-h-[3px] flex-1 cursor-pointer rounded-t bg-destructive transition-opacity hover:opacity-75"
              style={{ height: `${(expense[i] / max) * 100}%` }}
              title={`Pengeluaran ${months[i]}: ${expense[i]} jt`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        {months.map((m, i) => (
          <div
            key={i}
            className="flex-1 text-center text-[10px] text-muted-foreground"
            style={{ fontWeight: i === months.length - 1 ? 700 : 400 }}
          >
            {m}
          </div>
        ))}
      </div>
    </div>
  );
}
