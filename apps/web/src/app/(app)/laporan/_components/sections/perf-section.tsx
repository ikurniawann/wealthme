import { SectionCard, StatusBadge } from "@/components/wm";
import { RadialChart } from "@/components/charts/apex-presets";
import { useLocale } from "@/hooks/use-locale";
import type {
  InvestmentSummaryDto,
  ReportSummaryDto,
} from "@wealthme/contracts";
import { BarRow } from "../atoms";

/* ───────────────────────── Section: Performa ───────────────────────── */

export function PerfSection({
  summary,
  invSummary,
  isLoading,
}: {
  summary?: ReportSummaryDto;
  invSummary?: InvestmentSummaryDto;
  isLoading?: boolean;
}) {
  const { t } = useLocale();
  const savingsRate = summary?.savingsRate ?? null;
  const invReturn = invSummary?.totalReturnPct ?? null;
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <SectionCard title={t.laporan.performa.title}>
        {/* EPIC-026 Wave 3 — prototype's `#c-rperf` mount is the Apex
            radial preset (J3 FOLD) beside the indicator list. The
            prototype's own radial ("Dana Darurat", months of emergency
            fund) needs a liquid-balance-vs-monthly-expense figure this
            section does not fetch — the radial gauges the savings rate,
            the same indicator the first row below tracks. */}
        {savingsRate !== null && (
          <div className="mb-3.5">
            <RadialChart
              value={Math.max(0, Math.min(100, savingsRate))}
              label={t.laporan.savingsRateLabel}
              height={200}
              ariaLabel={`${t.laporan.performa.savingsRateTargetLabel}: ${savingsRate}%`}
            />
          </div>
        )}
        <div className="flex flex-col gap-2.5">
          {savingsRate !== null && (
            <BarRow
              label={t.laporan.performa.savingsRateTargetLabel}
              right={
                <StatusBadge
                  variant={
                    savingsRate >= 30
                      ? "success"
                      : savingsRate >= 20
                        ? "warning"
                        : "danger"
                  }
                >
                  {savingsRate}%
                  {savingsRate >= 30
                    ? t.laporan.performa.achievedSuffix
                    : t.laporan.performa.needsImprovementSuffix}
                </StatusBadge>
              }
              value={Math.min(savingsRate, 100)}
              color={
                savingsRate >= 30
                  ? "var(--success)"
                  : savingsRate >= 20
                    ? "var(--warning)"
                    : "var(--destructive)"
              }
            />
          )}
          {invReturn !== null && (
            <BarRow
              label={t.laporan.performa.investReturnTargetLabel}
              right={
                <StatusBadge
                  variant={
                    invReturn >= 12
                      ? "success"
                      : invReturn >= 0
                        ? "warning"
                        : "danger"
                  }
                >
                  {invReturn.toFixed(1)}%
                  {invReturn >= 12 ? t.laporan.performa.exceededSuffix : ""}
                </StatusBadge>
              }
              value={Math.min(Math.max(invReturn, 0), 100)}
              color={invReturn >= 12 ? "var(--success)" : "var(--warning)"}
            />
          )}
          {savingsRate === null && invReturn === null && (
            <div className="py-6 text-center text-[12px] text-muted-foreground">
              {t.laporan.performa.emptyPerf}
            </div>
          )}
        </div>
        <div className="mt-3 text-[11px] text-muted-foreground">
          {t.laporan.performa.noteText}
        </div>
      </SectionCard>
    </div>
  );
}
