import { BentoCard } from "@/components/wm";
import { HatchedBarChart } from "@/components/charts/bento-charts";
import { EXPENSE_COLOR, INCOME_COLOR } from "@/lib/viz-colors";
import { useMoney } from "@/hooks/use-money";
import { useLocale } from "@/hooks/use-locale";
import type { ReportSummaryDto } from "@wealthme/contracts";
import "./sections-a.css";

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
      {chartMonths.length > 0 && (
        <BentoCard
          title={t.laporan.bulanan.trendTitle}
          action={
            <span className="wm-legend">
              <span>
                <i style={{ background: INCOME_COLOR }} />
                {t.common.income}
              </span>
              <span>
                <i style={{ background: EXPENSE_COLOR }} />
                {t.common.expense}
              </span>
            </span>
          }
        >
          <div className="wm-chart" style={{ height: 240 }}>
            <HatchedBarChart
              labels={chartMonths}
              series={[
                {
                  name: t.common.income,
                  data: chartIncome,
                  color: INCOME_COLOR,
                },
                {
                  name: t.common.expense,
                  data: chartExpense,
                  color: EXPENSE_COLOR,
                },
              ]}
              format={(v) => money.formatCompact(v)}
              formatFull={money.format}
              wide
              ariaLabel={cashflowChartAriaLabel}
            />
          </div>
        </BentoCard>
      )}
      <BentoCard title={t.laporan.bulanan.recapTitle}>
        <div className="lap-a-table-wrap">
          <table className="lap-a-table">
            <thead>
              <tr>
                <th>{t.laporan.bulanan.colBulan}</th>
                <th data-num="true">{t.laporan.bulanan.colMasuk}</th>
                <th data-num="true">{t.laporan.bulanan.colKeluar}</th>
                <th data-num="true">{t.laporan.bulanan.colNet}</th>
              </tr>
            </thead>
            <tbody>
              {summary?.points && summary.points.length > 0 ? (
                summary.points.map((p) => (
                  <tr key={p.label}>
                    <td>{p.label}</td>
                    <td data-num="true" className="lap-a-pos">
                      {money.format(p.income)}
                    </td>
                    <td data-num="true" className="lap-a-exp">
                      {money.format(p.expense)}
                    </td>
                    <td
                      data-num="true"
                      className={p.net >= 0 ? "lap-a-pos" : "lap-a-neg"}
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
      </BentoCard>
    </div>
  );
}
