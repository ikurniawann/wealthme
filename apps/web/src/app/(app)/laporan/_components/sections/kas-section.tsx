import { MoneyStat, SectionCard, StatusBadge } from "@/components/wm";
import { CashflowChart } from "@/components/charts/apex-presets";
import { formatRupiah } from "@/lib/format";
import { useLocale } from "@/hooks/use-locale";
import type { ReportSummaryDto } from "@wealthme/contracts";
import { ActItem } from "../atoms";

/* ───────────────────────── Section: Arus Kas ───────────────────────── */

export function KasSection({
  summary,
  isLoading,
}: {
  summary?: ReportSummaryDto;
  isLoading?: boolean;
}) {
  const { t } = useLocale();
  const chartMonths = summary?.points.map((p) => p.label) ?? [];
  // EPIC-025 N3-G2 — raw Rupiah series, same reasoning as `RingkasanSection`
  // above (the old /1_000_000 was a pixel-scale factor, not a data change).
  const chartIncome = summary?.points.map((p) => p.income) ?? [];
  const chartExpense = summary?.points.map((p) => p.expense) ?? [];
  const cashflowChartAriaLabel =
    summary && chartMonths.length > 0
      ? `${t.laporan.kas.title} ${chartMonths[chartMonths.length - 1]}: ${t.common.income} ${formatRupiah(chartIncome[chartIncome.length - 1] ?? 0)}, ${t.common.expense} ${formatRupiah(chartExpense[chartExpense.length - 1] ?? 0)}`
      : t.laporan.kas.title;

  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <SectionCard title={t.laporan.kas.title}>
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          <MoneyStat
            label={t.common.income}
            value={summary ? formatRupiah(summary.totalIncome) : "Rp —"}
            valueClass="text-success"
          />
          <MoneyStat
            label={t.common.expense}
            value={summary ? formatRupiah(summary.totalExpense) : "Rp —"}
            valueClass="text-destructive"
          />
          <MoneyStat
            label={t.laporan.surplusLabel}
            value={summary ? formatRupiah(summary.netSavings) : "Rp —"}
            valueClass="text-success"
          />
          <MoneyStat
            label={t.laporan.savingsRateLabel}
            value={summary ? `${summary.savingsRate}%` : "—"}
            valueClass="text-primary"
          />
        </div>
        {chartMonths.length > 0 && (
          <div className="mt-4">
            {/* EPIC-025 N3-G2 — BarChart → CashflowChart (Apex). */}
            <CashflowChart
              months={chartMonths}
              income={chartIncome}
              expense={chartExpense}
              height={110}
              ariaLabel={cashflowChartAriaLabel}
            />
          </div>
        )}
      </SectionCard>
      <SectionCard title={t.laporan.kas.incomeSourcesTitle}>
        {summary?.topIncomeCategories &&
        summary.topIncomeCategories.length > 0 ? (
          summary.topIncomeCategories.map((cat, i) => (
            <ActItem
              key={cat.categoryName}
              icon="💼"
              iconBg="#DCFCE7"
              name={cat.categoryName}
              right={
                <>
                  <div className="text-[13px] font-bold text-success">
                    {formatRupiah(cat.amount)}
                  </div>
                  <StatusBadge variant="success">{cat.percentage}%</StatusBadge>
                </>
              }
              last={i === summary.topIncomeCategories.length - 1}
            />
          ))
        ) : (
          <div className="py-4 text-center text-[12px] text-muted-foreground">
            {t.laporan.kas.emptyIncome}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
