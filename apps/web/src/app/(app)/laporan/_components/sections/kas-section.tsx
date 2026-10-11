import { MoneyStat, SectionCard, StatusBadge } from "@/components/wm";
import {
  JourneyFlowChart,
  type FlowNode,
} from "@/components/charts/journey-flow-chart";
import { CategoryIcon } from "@/components/shell/tx-pickers";
import { EXPENSE_COLOR, INCOME_COLOR } from "@/lib/viz-colors";
import { useMoney } from "@/hooks/use-money";
import { useLocale } from "@/hooks/use-locale";
import type { ReportSummaryDto } from "@wealthme/contracts";
import { ActItem } from "../atoms";

/**
 * Map category colors through semantic ramp: all categories use
 * semantic income/expense colors, not hardcoded DB hex.
 */
function semanticCategoryColor(kind?: string): string {
  return kind === "income" ? INCOME_COLOR : EXPENSE_COLOR;
}

/* ───────────────────────── Section: Arus Kas ───────────────────────── */

export function KasSection({
  summary,
  isLoading,
}: {
  summary?: ReportSummaryDto;
  isLoading?: boolean;
}) {
  const { t } = useLocale();
  const money = useMoney();

  // Journey-flow chart (2026-10-06, see journey-flow-chart.tsx): income
  // categories converge into a single "Total" node, which fans out to
  // expense categories plus a Surplus/Defisit node. `buildCategoryBreakdown`
  // (reports.service.ts) returns every category, not a truncated top-N, so
  // `topIncomeCategories` always sums to `totalIncome` and
  // `topExpenseCategories` to `totalExpense` — the three columns stay
  // balanced without a separate scaling step.
  const totalIncome = summary?.totalIncome ?? 0;
  const netSavings = summary?.netSavings ?? 0;
  const sources: FlowNode[] = (summary?.topIncomeCategories ?? []).map(
    (cat) => ({
      id: cat.categoryName,
      label: cat.categoryName,
      value: cat.amount,
      color: semanticCategoryColor("income"),
    }),
  );
  const expenseNodes: FlowNode[] = (summary?.topExpenseCategories ?? []).map(
    (cat) => ({
      id: cat.categoryName,
      label: cat.categoryName,
      value: cat.amount,
      color: semanticCategoryColor("expense"),
    }),
  );
  // A deficit (expenses > income) would make the destination column bigger
  // than the source column — add the shortfall as an extra source instead
  // of a negative-value destination node, same balanced-columns contract.
  const destinations: FlowNode[] =
    netSavings >= 0
      ? [
          ...expenseNodes,
          {
            id: "__surplus",
            label: t.laporan.surplusLabel,
            value: netSavings,
            color: "var(--success)",
          },
        ]
      : expenseNodes;
  const flowSources: FlowNode[] =
    netSavings < 0
      ? [
          ...sources,
          {
            id: "__deficit",
            label: t.laporan.deficitLabel,
            value: -netSavings,
            color: EXPENSE_COLOR,
          },
        ]
      : sources;
  const flowTotal = flowSources.reduce((sum, n) => sum + n.value, 0);
  const hasFlowData = flowTotal > 0 && destinations.length > 0;
  const cashflowChartAriaLabel = summary
    ? `${t.laporan.kas.title}: ${t.common.income} ${money.format(totalIncome)}, ${t.common.expense} ${money.format(summary.totalExpense ?? 0)}, ${t.laporan.surplusLabel} ${money.format(netSavings)}`
    : t.laporan.kas.title;

  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <SectionCard
        title={t.laporan.kas.title}
        action={
          <div className="wm-legend">
            <span>
              <i style={{ background: INCOME_COLOR }} />
              {t.common.income}
            </span>
            <span>
              <i style={{ background: EXPENSE_COLOR }} />
              {t.common.expense}
            </span>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          <MoneyStat
            label={t.common.income}
            value={summary ? money.format(summary.totalIncome ?? 0) : "…"}
            valueClass="text-success"
          />
          <MoneyStat
            label={t.common.expense}
            value={
              summary ? (
                <span style={{ color: EXPENSE_COLOR }}>
                  {money.format(summary.totalExpense ?? 0)}
                </span>
              ) : (
                "…"
              )
            }
          />
          <MoneyStat
            label={t.laporan.surplusLabel}
            value={summary ? money.format(summary.netSavings ?? 0) : "…"}
            valueClass="text-success"
          />
          <MoneyStat
            label={
              summary && summary.points.length > 0
                ? `${t.laporan.savingsRateLabel} · ${t.laporan.windowMonthsTemplate.replace("{n}", String(summary.points.length))}`
                : t.laporan.savingsRateLabel
            }
            value={summary ? `${summary.savingsRate}%` : "—"}
            valueClass="text-primary"
          />
        </div>
        {hasFlowData && (
          <div className="wm-chart wm-chart--flow" style={{ marginTop: 16 }}>
            <JourneyFlowChart
              sources={flowSources}
              destinations={destinations}
              totalLabel={t.common.income}
              totalValue={flowTotal}
              formatFull={money.format}
              format={(v) => money.formatCompact(v)}
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
              icon={
                <span className="block size-[18px] [&>svg]:size-full">
                  <CategoryIcon name={cat.categoryName} />
                </span>
              }
              iconBg="var(--muted)"
              iconColor="var(--success)"
              name={cat.categoryName}
              right={
                <>
                  <div className="text-[13px] font-bold text-success">
                    {money.format(cat.amount)}
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
