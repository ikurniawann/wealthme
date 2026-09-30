"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  chartPalette,
  useThemeRebuildToken,
} from "@/components/charts/apex-base";
import { DonutChart } from "@/components/charts/apex-presets";
import type { DonutSegment } from "@/components/charts/donut";
import { CardLink, SectionCard } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import type { AllocationItem } from "./use-beranda-data";

/**
 * EPIC-026 Wave 8 — prototype's `.card.bento-allocation` ("Alokasi Kekayaan").
 *
 * Donut palette fix: the segment colours used to come straight from the API
 * (`DashboardSummaryDto.allocation[].color` — hardcoded hexes such as the
 * bright cyan `#06B6D4` for "Rekening" in `dashboard.service.ts`), which
 * rendered off-brand against the prototype. The prototype's `WMCharts.donut()`
 * tints from the shared chart tokens instead, so the segments below are
 * recoloured from `chartPalette()` (`--chart-1`..`--chart-5`) and re-read on a
 * theme flip via `useThemeRebuildToken()`. The API colour survives only as the
 * pre-mount fallback, when `getComputedStyle` cannot resolve the tokens yet.
 */
export function AllocationCard({
  isLoading,
  allocation,
}: {
  isLoading: boolean;
  allocation: AllocationItem[];
}) {
  const router = useRouter();
  const { t } = useLocale();
  const money = useMoney();
  const rebuildToken = useThemeRebuildToken();

  const segments: DonutSegment[] = useMemo(() => {
    const palette = chartPalette().filter(Boolean);
    return allocation.map((item, i) => ({
      label: item.label,
      // Value = the real Rupiah amount, NOT the percentage: the Apex preset
      // sums `value` for its currency-formatted center total.
      value: item.amount,
      color: palette.length > 0 ? palette[i % palette.length]! : item.apiColor,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuildToken forces a re-read of the CSS chart tokens on a theme flip.
  }, [allocation, rebuildToken]);

  const total = allocation.reduce((sum, item) => sum + item.amount, 0);

  const donutAriaLabel =
    allocation.length > 0
      ? `${t.beranda.wealthBreakdown}: ${allocation
          .map((a) => {
            const percent =
              total > 0 ? Math.round((a.amount / total) * 1000) / 10 : 0;
            return `${a.label} ${percent}%`;
          })
          .join(", ")}`
      : t.beranda.wealthBreakdown;

  const breakdown = allocation.map((item, i) => ({
    ...item,
    color: segments[i]?.color ?? item.apiColor,
    percent: total > 0 ? Math.round((item.amount / total) * 1000) / 10 : 0,
  }));

  return (
    <SectionCard
      className="bento-allocation"
      title={t.beranda.wealthBreakdown}
      action={
        /* EPIC-026 Wave 3 — the prototype's "Detail" action links to
           ringkasan.html, not aset. */
        <CardLink onClick={() => router.push("/ringkasan")}>
          {t.beranda.allocationDetailLink}
        </CardLink>
      }
    >
      {isLoading || segments.length === 0 ? (
        <div className="t-md t-muted flex h-[220px] items-center justify-center">
          {isLoading ? t.common.loading : t.common.noData}
        </div>
      ) : (
        <>
          <style>{`
            .allocation-card__donut .apexcharts-pie-area {
              stroke: var(--card);
              stroke-width: 2;
              transition: filter 0.14s ease;
            }
            .allocation-card__donut .apexcharts-pie-area:hover {
              filter: brightness(1.08);
              cursor: pointer;
            }
            .allocation-card__donut {
              background: radial-gradient(
                circle,
                transparent 54%,
                color-mix(in oklab, var(--border) 55%, transparent) 55%,
                color-mix(in oklab, var(--border) 55%, transparent) 56%,
                transparent 57%
              );
            }
            .allocation-row {
              transition: border-color 0.14s ease, transform 0.14s ease;
            }
            .allocation-row:hover {
              border-color: color-mix(in oklab, var(--row-color, var(--primary)) 35%, var(--border));
              transform: translateY(-1px);
            }
            .allocation-row__dot {
              box-shadow:
                0 0 0 2px color-mix(in oklab, var(--card) 82%, transparent),
                0 0 0 2px color-mix(in oklab, var(--row-color, var(--primary)) 45%, transparent);
            }
            .allocation-row__meta {
              border-top: 1px solid color-mix(in oklab, var(--border) 55%, transparent);
              padding-top: 4px;
              margin-top: 1px;
            }
          `}</style>
          <div className="allocation-card__body">
            <div className="allocation-card__donut [&_.apexcharts-legend]:hidden!">
              <DonutChart
                segments={segments}
                centerLabel={t.beranda.donutCenterLabel}
                height={188}
                ariaLabel={donutAriaLabel}
                money={money}
              />
            </div>
            <div
              className="allocation-card__list"
              aria-label={t.beranda.wealthBreakdown}
              style={
                breakdown.length > 3
                  ? { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }
                  : undefined
              }
            >
              {breakdown.map((item) => (
                <div
                  className="allocation-row"
                  key={item.label}
                  style={{ "--row-color": item.color } as React.CSSProperties}
                >
                  <div className="allocation-row__top">
                    <span className="allocation-row__label" title={item.label}>
                      <span
                        className="allocation-row__dot"
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      />
                      {item.label}
                    </span>
                    <span
                      className="allocation-row__value"
                      title={money.format(item.amount)}
                    >
                      {money.formatCompact(item.amount)}
                    </span>
                  </div>
                  <div className="allocation-row__meta">
                    <span>{item.percent}%</span>
                    <span title={money.format(item.amount)}>
                      {money.format(item.amount)}
                    </span>
                  </div>
                  <span className="allocation-row__track" aria-hidden="true">
                    <span
                      className="allocation-row__bar"
                      style={{
                        width: `${Math.min(100, Math.max(0, item.percent))}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </SectionCard>
  );
}
