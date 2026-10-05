"use client";

// EPIC-026 — prototype `ringkasan.html` block 3: a `.bento-grid` with the
// net-worth trend card (`bento-span-8`, `#c-networth`) beside the asset
// composition card (`bento-span-4`, `#c-alloc` + the four labelled
// `.progress` rows).

import { useRouter } from "next/navigation";

import { ProgressBar, StatusBadge, CardLink } from "@/components/wm";
import { DonutChart, TrendChart } from "@/components/charts/apex-presets";
import { BentoCard, CompositionStack, GhostButton } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";
import { formatPercent1, type RingkasanData } from "./use-ringkasan-data";
import type { TrendRangeKey } from "./use-ringkasan-data";

// Prototype chart heights (`docs/prototype/assets/charts.js` + the
// `ringkasan.html` call sites): trend 280, donut 268.
const TREND_HEIGHT = 280;
const EMPTY_TREND_HEIGHT = 168;
const DONUT_HEIGHT = 268;

export function TrendCompositionSection({
  data,
  trendRange,
}: {
  data: RingkasanData;
  trendRange: TrendRangeKey;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const {
    isLoading,
    isNetWorthHistoryLoading,
    trendTitleByRange,
    netWorthTrendCategories,
    netWorthTrendSeries,
    netWorthTrendValues,
    netWorthTrendAriaLabel,
    yoyPct,
    composition,
    donutSegments,
    donutAriaLabel,
    dateLocale,
    money,
    moneyFull,
  } = data;

  return (
    <section className="bento-grid">
      <article className="card bento-span-8">
        <div className="card__header">
          <h2 className="card__title">{trendTitleByRange[trendRange]}</h2>
          {/* "N% YoY" is only rendered when the fetched history genuinely
              spans close to a year — see `use-ringkasan-data.ts`. */}
          {yoyPct !== null && (
            <StatusBadge
              variant={yoyPct >= 0 ? "success" : "danger"}
              className="card__action"
            >
              {yoyPct >= 0
                ? t.ringkasan.yoyUpPrefix
                : t.ringkasan.yoyDownPrefix}
              {formatPercent1(Math.abs(yoyPct), dateLocale)}
              {t.ringkasan.yoySuffix}
            </StatusBadge>
          )}
        </div>
        <div className="card__body">
          {isNetWorthHistoryLoading ? (
            <div
              className="animate-pulse rounded-md bg-muted"
              style={{ height: EMPTY_TREND_HEIGHT }}
            />
          ) : netWorthTrendValues.length < 2 ? (
            <div
              className="flex items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 t-sm t-muted"
              style={{ height: EMPTY_TREND_HEIGHT }}
            >
              {t.ringkasan.emptyNetWorthTrend}
            </div>
          ) : (
            <>
              <div className="chart private">
                <TrendChart
                  categories={netWorthTrendCategories}
                  series={netWorthTrendSeries}
                  height={TREND_HEIGHT}
                  ariaLabel={netWorthTrendAriaLabel}
                  money={{ format: moneyFull, formatCompact: money }}
                />
              </div>
              <div className="row row--between" style={{ marginTop: 2 }}>
                <span className="t-xs t-muted">
                  {t.ringkasan.netWorthTrendRangeStart}
                </span>
                <span className="t-xs t-muted">
                  {t.ringkasan.netWorthTrendRangeEnd}
                </span>
              </div>
            </>
          )}
        </div>
      </article>

      <article className="card bento-span-4">
        <div className="card__header">
          <h2 className="card__title">{t.ringkasan.compositionTitle}</h2>
          {/* Prototype's "Detail" action → aset.html. */}
          <div className="card__action">
            <CardLink onClick={() => router.push("/aset")}>
              {t.common.viewDetail}
            </CardLink>
          </div>
        </div>
        <div className="card__body">
          {isLoading ? (
            <div className="stack">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[32px] animate-pulse rounded-md bg-muted"
                />
              ))}
            </div>
          ) : composition.length === 0 ? (
            <div className="py-4 text-center t-md t-muted">
              {t.ringkasan.emptyComposition}
            </div>
          ) : (
            <>
              {/* The labelled `.progress` list below is the ONE legend for
                  this card, exactly as in the prototype — Apex's own donut
                  legend is hidden so it isn't duplicated. */}
              <div className="chart private [&_.apexcharts-legend]:hidden!">
                <DonutChart
                  segments={donutSegments}
                  centerLabel={t.ringkasan.totalAssetsLabel}
                  height={DONUT_HEIGHT}
                  ariaLabel={donutAriaLabel}
                  money={{ format: moneyFull, formatCompact: money }}
                />
              </div>
              <div className="stack" style={{ marginTop: 8 }}>
                {composition.map((c) => (
                  <div key={c.label}>
                    <div className="row row--between">
                      <span className="t-xs t-bold truncate">{c.label}</span>
                      <span className="t-xs t-muted mono private shrink-0">
                        {c.value}
                      </span>
                    </div>
                    <ProgressBar
                      value={c.pct}
                      color={c.color}
                      height={6}
                      ariaLabel={c.label}
                      className="mt-[5px]"
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </article>
    </section>
  );
}

/** Bento v2: asset composition as a composition stack (no donut), beside the hero. */
export function CompositionBento({ data }: { data: RingkasanData }) {
  const { t } = useLocale();
  const router = useRouter();
  const { isLoading, donutSegments, money, totalAssets } = data;
  return (
    <BentoCard
      className="rk2-comp private-scope"
      title={t.ringkasan.compositionTitle}
      action={
        <GhostButton onClick={() => router.push("/aset")}>
          {t.common.viewDetail}
        </GhostButton>
      }
    >
      {isLoading ? null : donutSegments.length === 0 ? (
        <p className="wm-cap mt-4">{t.ringkasan.emptyComposition}</p>
      ) : (
        <>
          <div className="mt-3 private">
            <CompositionStack
              label={t.ringkasan.compositionTitle}
              center={money(totalAssets)}
              sub={t.ringkasan.totalAssetsLabel}
              format={money}
              items={donutSegments.map((seg) => ({
                label: seg.label,
                value: seg.value,
                color: seg.color,
              }))}
            />
          </div>
        </>
      )}
    </BentoCard>
  );
}
