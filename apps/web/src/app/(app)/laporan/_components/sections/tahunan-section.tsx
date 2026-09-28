import { SectionCard } from "@/components/wm";
import { TrendChart } from "@/components/charts/apex-presets";
import { useMoney } from "@/hooks/use-money";
import { useLocale } from "@/hooks/use-locale";
import type { ReportSummaryDto } from "@wealthme/contracts";
import { StatTile } from "../atoms";

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
      <div className="text-[15px] font-bold">{t.laporan.tahunan.title}</div>
      {latest ? (
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          <StatTile
            label={`${t.laporan.totalIncomeLabel} ${latest.label}`}
            value={money.format(latest.income)}
            valueClass="text-success"
          />
          <StatTile
            label={t.laporan.totalExpenseLabel}
            value={money.format(latest.expense)}
            valueClass="text-destructive"
          />
          <StatTile
            label={t.laporan.tahunan.netYearLabel}
            value={(latest.net >= 0 ? "+" : "") + money.format(latest.net)}
            valueClass={latest.net >= 0 ? "text-success" : "text-destructive"}
          />
          <StatTile
            label={t.laporan.savingsRateLabel}
            value={
              latest.income > 0
                ? `${Math.round(((latest.income - latest.expense) / latest.income) * 100)}%`
                : "—"
            }
            valueClass="text-primary"
          />
        </div>
      ) : (
        <div className="rounded-[12px] border p-6 text-center text-[12px] text-muted-foreground">
          {t.laporan.tahunan.emptyYear}
        </div>
      )}
      {points.length > 0 && (
        <SectionCard title={t.laporan.tahunan.trendTitle}>
          {/* EPIC-026 Wave 3 — prototype's `#c-tahunan` mount is the Apex
              trend preset (J3 FOLD); same yearly income series the
              hand-rolled progress bars rendered before this rebuild. The
              prototype's own series (net worth per year) needs historical
              snapshots the schema does not persist — income per year is
              what this section's data actually carries (its existing
              title already says so). */}
          <TrendChart
            categories={points.map((p) => p.label)}
            series={[
              {
                name: t.laporan.totalIncomeLabel,
                data: points.map((p) => p.income),
              },
            ]}
            height={260}
            ariaLabel={`${t.laporan.tahunan.trendTitle}: ${points
              .map((p) => `${p.label} ${money.format(p.income)}`)
              .join(", ")}`}
            money={money}
          />
        </SectionCard>
      )}
    </div>
  );
}
