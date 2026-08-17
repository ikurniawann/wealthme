"use client";

// EPIC-026 — prototype `ringkasan.html` block 5c: the "Health Score" card —
// the `#c-health` radial mount (`WMCharts.radial(…, 176)`), a centered caption,
// a status `.badge`, and a `.notice.notice--info` carrying the debt-ratio
// insight.
//
// Honest UI: the prototype hardcodes a 78 "Financial Health Score" from a
// model this app does not have. The gauge therefore plots the real
// `savingsRate` (clamped 0–100) the API does return, and the notice's ratio is
// computed from real totals — no invented composite score.

import { Sparkles } from "lucide-react";

import { StatusBadge } from "@/components/wm";
import { RadialChart } from "@/components/charts/apex-presets";
import { useLocale } from "@/hooks/use-locale";
import { formatPercent1, type RingkasanData } from "./use-ringkasan-data";

/** Prototype call-site height: `WMCharts.radial("#c-health", 78, "Skor", 176)`. */
const RADIAL_HEIGHT = 176;

export function HealthScoreCard({ data }: { data: RingkasanData }) {
  const { t } = useLocale();
  const { savingsRate, debtRatio, dateLocale } = data;
  const score = Math.max(0, Math.min(100, savingsRate));

  return (
    <article className="card">
      <div className="card__header">
        <h2 className="card__title">{t.ringkasan.healthScoreTitle}</h2>
      </div>
      <div className="card__body mx-auto flex max-w-[360px] flex-col justify-center">
        <div className="chart">
          <RadialChart
            value={score}
            label={t.ringkasan.healthScoreCenterLabel}
            height={RADIAL_HEIGHT}
            ariaLabel={`${t.ringkasan.financialHealthScoreLabel}: ${savingsRate}`}
          />
        </div>
        <div className="t-xs t-muted text-center">
          {t.ringkasan.financialHealthScoreLabel}
        </div>
        <div className="row justify-center" style={{ marginTop: 8 }}>
          <StatusBadge
            variant={
              savingsRate >= 20
                ? "success"
                : savingsRate >= 10
                  ? "info"
                  : "danger"
            }
          >
            {savingsRate >= 20
              ? t.ringkasan.healthStatusGood
              : savingsRate >= 10
                ? t.ringkasan.healthStatusFair
                : t.ringkasan.healthStatusNeedsAttention}
          </StatusBadge>
        </div>
        {debtRatio !== null && (
          <div className="notice notice--info" style={{ marginTop: 12 }}>
            <Sparkles className="size-[15px] shrink-0" />
            <span>
              {t.ringkasan.healthDebtRatioNotePrefix}
              <strong className="mono">
                {formatPercent1(debtRatio, dateLocale)}%
              </strong>
              {debtRatio <= 40
                ? t.ringkasan.healthDebtRatioNoteSuffixSafe
                : t.ringkasan.healthDebtRatioNoteSuffixAttention}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
