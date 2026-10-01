import { BentoCard, StatusBadge, Track } from "@/components/wm";
import { TickGauge } from "@/components/charts/bento-charts";
import { useLocale } from "@/hooks/use-locale";
import type {
  InvestmentSummaryDto,
  ReportSummaryDto,
} from "@wealthme/contracts";
import "./sections-a.css";

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
      <BentoCard title={t.laporan.performa.title}>
        {/* EPIC-026 Wave 3 — prototype's `#c-rperf` mount is the gauge
            (J3 FOLD) beside the indicator list. The gauge reads the
            savings rate, the same indicator the first row below tracks. */}
        {savingsRate !== null && (
          <div className="mb-3.5 mx-auto max-w-[260px]">
            <TickGauge
              value={Math.max(0, Math.min(100, savingsRate))}
              ariaLabel={`${t.laporan.performa.savingsRateTargetLabel}: ${savingsRate}%`}
            >
              <b>{savingsRate}%</b>
              <small>{t.laporan.savingsRateLabel}</small>
            </TickGauge>
          </div>
        )}
        <div className="flex flex-col">
          {savingsRate !== null && (
            <div className="lap-a-perf-bar">
              <div className="lap-a-perf-bar-head">
                <span className="lap-a-perf-label">
                  {t.laporan.performa.savingsRateTargetLabel}
                </span>
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
              </div>
              <Track
                value={Math.min(savingsRate, 100)}
                fill={
                  savingsRate >= 30
                    ? "lime"
                    : savingsRate >= 20
                      ? "orange"
                      : "bad"
                }
              />
            </div>
          )}
          {invReturn !== null && (
            <div className="lap-a-perf-bar">
              <div className="lap-a-perf-bar-head">
                <span className="lap-a-perf-label">
                  {t.laporan.performa.investReturnTargetLabel}
                </span>
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
              </div>
              <Track
                value={Math.min(Math.max(invReturn, 0), 100)}
                fill={invReturn >= 12 ? "lime" : "orange"}
              />
            </div>
          )}
          {savingsRate === null && invReturn === null && (
            <div className="lap-a-empty">
              <b>{t.laporan.performa.emptyPerf}</b>
            </div>
          )}
        </div>
        <div className="mt-3 text-[11px] text-muted-foreground">
          {t.laporan.performa.noteText}
        </div>
      </BentoCard>
    </div>
  );
}
