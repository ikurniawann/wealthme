import { SectionCard } from "@/components/wm";
import { CashflowChart } from "@/components/charts/apex-presets";
import { useMoney } from "@/hooks/use-money";
import { useLocale } from "@/hooks/use-locale";
import type { ReportSummaryDto } from "@wealthme/contracts";

/* ───────────────────────── Section: Bulanan ───────────────────────── */

export function BulananSection({
  summary,
  isLoading,
}: {
  summary?: ReportSummaryDto;
  isLoading?: boolean;
}) {
  const { t } = useLocale();
  const money = useMoney();
  const chartMonths = summary?.points.map((p) => p.label) ?? [];
  // EPIC-025 N3-G2 — raw Rupiah series, same reasoning as `RingkasanSection`
  // above (the old /1_000_000 was a pixel-scale factor, not a data change).
  const chartIncome = summary?.points.map((p) => p.income) ?? [];
  const chartExpense = summary?.points.map((p) => p.expense) ?? [];
  const cashflowChartAriaLabel =
    summary && chartMonths.length > 0
      ? `${t.laporan.bulanan.trendTitle} ${chartMonths[chartMonths.length - 1]}: ${t.common.income} ${money.format(chartIncome[chartIncome.length - 1] ?? 0)}, ${t.common.expense} ${money.format(chartExpense[chartExpense.length - 1] ?? 0)}`
      : t.laporan.bulanan.trendTitle;

  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[15px] font-bold">{t.laporan.bulanan.title}</div>
      </div>
      {chartMonths.length > 0 && (
        <SectionCard title={t.laporan.bulanan.trendTitle}>
          {/* EPIC-025 N3-G2 — BarChart → CashflowChart (Apex). Height 260
                matches docs/prototype/assets/charts.js's `cashflow()`; the
                previous 110 left too little plot area once the bottom
                legend took its share. */}
          <CashflowChart
            months={chartMonths}
            income={chartIncome}
            expense={chartExpense}
            height={260}
            ariaLabel={cashflowChartAriaLabel}
            money={money}
          />
        </SectionCard>
      )}
      <SectionCard title={t.laporan.bulanan.recapTitle}>
        <div className="w-full overflow-x-auto [mask-image:linear-gradient(to_left,transparent,black_24px)]">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 font-semibold">
                  {t.laporan.bulanan.colBulan}
                </th>
                <th className="py-2 font-semibold">
                  {t.laporan.bulanan.colMasuk}
                </th>
                <th className="py-2 font-semibold">
                  {t.laporan.bulanan.colKeluar}
                </th>
                <th className="py-2 font-semibold">
                  {t.laporan.bulanan.colNet}
                </th>
              </tr>
            </thead>
            <tbody>
              {summary?.points && summary.points.length > 0 ? (
                summary.points.map((p) => (
                  <tr key={p.label} className="border-b last:border-0">
                    <td className="py-2.5 font-semibold">{p.label}</td>
                    <td className="mono py-2.5 text-success">
                      {money.format(p.income)}
                    </td>
                    <td className="mono py-2.5 text-destructive">
                      {money.format(p.expense)}
                    </td>
                    <td
                      className={
                        "mono py-2.5 " +
                        (p.net >= 0 ? "text-success" : "text-destructive")
                      }
                    >
                      {p.net >= 0 ? "+" : ""}
                      {money.format(p.net)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="py-6 text-center text-[12px] text-muted-foreground"
                  >
                    {t.laporan.emptyMonthTransactions}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
