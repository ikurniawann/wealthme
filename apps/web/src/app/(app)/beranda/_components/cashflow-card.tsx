"use client";

import type { DashboardSummaryDto } from "@wealthme/contracts";
import { CashflowChart } from "@/components/charts/apex-presets";
import { MoneyStat, SectionCard } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";
import type { MoneyFormatters } from "./use-beranda-data";

/**
 * EPIC-026 Wave 8 — prototype's `.card.bento-chart` ("Arus Kas 6 Bulan") with
 * `summary.cashflow` is a fixed six-month backend rollup.
 */
export function CashflowCard({
  isLoading,
  cashflow,
  currentMonth,
  fmt,
}: {
  isLoading: boolean;
  cashflow: DashboardSummaryDto["cashflow"] | undefined;
  currentMonth: DashboardSummaryDto["currentMonth"] | undefined;
  fmt: MoneyFormatters;
}) {
  const { t } = useLocale();
  const { money, moneyCompact } = fmt;

  // EPIC-025 N3-G1 — chart-parity aria label, read from the same series.
  const cashflowAriaLabel = cashflow
    ? `${t.common.cashFlow} ${cashflow.months[cashflow.months.length - 1] ?? ""}: ${t.common.income} ${money(currentMonth?.income ?? 0)}, ${t.common.expense} ${money(currentMonth?.expense ?? 0)}`
    : t.common.cashFlow;

  return (
    <SectionCard className="bento-chart" title={t.beranda.cashflowTitle6}>
      <div className="row row--wrap mb-2.5 gap-4">
        <MoneyStat
          label={t.common.income}
          value={isLoading ? "…" : money(currentMonth?.income ?? 0)}
          valueClass="t-success"
        />
        <MoneyStat
          label={t.common.expense}
          value={isLoading ? "…" : money(currentMonth?.expense ?? 0)}
          valueClass="t-danger"
        />
      </div>
      <div className="t-xs t-muted mb-2">
        {t.common.surplus}{" "}
        <span className="t-bold t-success">
          {isLoading ? "…" : money(currentMonth?.net ?? 0)}
        </span>
      </div>

      {/* EPIC-025 N3-G1 — BarChart → CashflowChart (Apex). Prototype parity:
          `charts.js`'s `cashflow()` mounts at height 260. */}
      {cashflow ? (
        <div className="chart">
          <CashflowChart
            months={cashflow.months}
            income={cashflow.income}
            expense={cashflow.expense}
            height={260}
            ariaLabel={cashflowAriaLabel}
            money={{ format: money, formatCompact: moneyCompact }}
          />
        </div>
      ) : (
        <div className="t-md t-muted flex h-[260px] items-center justify-center">
          {isLoading ? t.common.loading : t.common.noData}
        </div>
      )}
    </SectionCard>
  );
}
