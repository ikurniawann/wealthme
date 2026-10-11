import { BentoCard, BentoTile, BentoTiles } from "@/components/wm";
import { HatchedAreaChart } from "@/components/charts/bento-charts";
import { EXPENSE_COLOR } from "@/lib/viz-colors";
import { useMoney } from "@/hooks/use-money";
import { useLocale } from "@/hooks/use-locale";
import type { ReportSummaryDto } from "@wealthme/contracts";
import "./sections-a.css";

/* ───────────────────────── Section: Tahunan ───────────────────────── */

export function TahunanSection({
  yearly,
  isLoading,
}: {
  yearly?: ReportSummaryDto;
  isLoading?: boolean;
}) {
  const { t } = useLocale();
  const money = useMoney();
  const points = yearly?.points ?? [];
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";

  const latest = points[points.length - 1];

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      {latest ? (
        <BentoTiles>
          <BentoTile
            title={`${t.laporan.totalIncomeLabel} ${latest.label}`}
            value={
              <span
                className="lap-a-kpi-value"
                style={{ color: "var(--wm-good)" }}
              >
                {money.format(latest.income)}
              </span>
            }
          />
          <BentoTile
            title={t.laporan.totalExpenseLabel}
            value={
              <span
                className="lap-a-kpi-value"
                style={{ color: EXPENSE_COLOR }}
              >
                {money.format(latest.expense)}
              </span>
            }
          />
          <BentoTile
            title={t.laporan.tahunan.netYearLabel}
            value={
              <span
                className="lap-a-kpi-value"
                style={{
                  color: latest.net >= 0 ? "var(--wm-good)" : "var(--wm-bad)",
                }}
              >
                {(latest.net >= 0 ? "+" : "") + money.format(latest.net)}
              </span>
            }
          />
          <BentoTile
            title={`${t.laporan.savingsRateLabel} · ${latest.label}`}
            value={
              <span className="lap-a-kpi-value">
                {latest.income > 0
                  ? `${Math.round(((latest.income - latest.expense) / latest.income) * 100)}%`
                  : "—"}
              </span>
            }
          />
        </BentoTiles>
      ) : (
        <div className="lap-a-empty">
          <b>{t.laporan.tahunan.emptyYear}</b>
        </div>
      )}
      {points.length > 0 && (
        <BentoCard title={t.laporan.tahunan.trendTitle}>
          {/* EPIC-026 Wave 3 — prototype's `#c-tahunan` mount is the trend
              area; same yearly income series the hand-rolled progress bars
              rendered before this rebuild. The prototype's own series (net
              worth per year) needs historical snapshots the schema does not
              persist — income per year is what this section's data
              actually carries (its existing title already says so). */}
          <div className="wm-chart" style={{ height: 240 }}>
            <HatchedAreaChart
              labels={points.map((p) => p.label)}
              values={points.map((p) => p.income)}
              format={(v) => money.formatCompact(v)}
              axis={money.formatAxis}
              formatFull={money.format}
              ariaLabel={`${t.laporan.tahunan.trendTitle}: ${points
                .map((p) => `${p.label} ${money.format(p.income)}`)
                .join(", ")}`}
            />
          </div>
        </BentoCard>
      )}
    </div>
  );
}
