"use client";

// EPIC-026 — prototype `ringkasan.html` block 5c: the "Skor kesehatan"
// `.r-health` card (bento v2) — a `.gauge` mount beside a `.health-stat`
// column (score, status pill, debt-ratio notice).
//
// `drawGauge()` draws a semicircle of 30 tick segments ("tick-style gauge,
// matching the approved dashboard semicircle"), NOT a full circular ring —
// a previous pass used `RadialChart` (a full-circle Apex radial), which
// does not match. `/beranda`'s `HealthBento` already built this exact
// pattern as `TickGauge` (`@/components/charts/bento-charts`) over the same
// savings-rate shape; reused here as-is instead of duplicating it.
//
// Honest UI: the prototype hardcodes a 78 "Financial Health Score" from a
// model this app does not have. The gauge therefore plots the real
// `savingsRate` (clamped 0–100) the API does return, and the notice's ratio is
// computed from real totals — no invented composite score.

import { Sparkles } from "lucide-react";

import { BentoCard, StatusBadge } from "@/components/wm";
import { TickGauge } from "@/components/charts/bento-charts";
import { useLocale } from "@/hooks/use-locale";
import { formatPercent1, type RingkasanData } from "./use-ringkasan-data";

export function HealthScoreCard({ data }: { data: RingkasanData }) {
  const { t } = useLocale();
  const { savingsRate, debtRatio, dateLocale, savingsWindowLabel } = data;
  const score = Math.max(0, Math.min(100, savingsRate));

  return (
    <BentoCard
      className="rk2-health"
      title={t.ringkasan.healthScoreTitle}
      caption={`${t.ringkasan.financialHealthScoreLabel} · ${savingsWindowLabel}`}
    >
      <div className="rk2-health-body">
        <div className="rk2-health-gauge">
          <TickGauge
            value={score}
            ariaLabel={`${t.ringkasan.financialHealthScoreLabel} ${savingsWindowLabel}: ${savingsRate}`}
          >
            <b className="private">{score}%</b>
            <small>{t.ringkasan.financialHealthScoreLabel}</small>
          </TickGauge>
        </div>
        <div className="rk2-health-stat">
          <StatusBadge
            variant={
              savingsRate >= 20
                ? "success"
                : savingsRate >= 10
                  ? "info"
                  : "danger"
            }
            className="mt-2"
          >
            {savingsRate >= 20
              ? t.ringkasan.healthStatusGood
              : savingsRate >= 10
                ? t.ringkasan.healthStatusFair
                : t.ringkasan.healthStatusNeedsAttention}
          </StatusBadge>
          {debtRatio !== null && (
            <div className="notice notice--info" style={{ marginTop: 10 }}>
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
      </div>
    </BentoCard>
  );
}
