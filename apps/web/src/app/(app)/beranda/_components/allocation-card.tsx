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
import { formatRupiah, formatRupiahCompact } from "@/lib/format";
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
        <div className="allocation-card__body">
          <div className="allocation-card__donut">
            <DonutChart
              segments={segments}
              centerLabel={t.beranda.donutCenterLabel}
              height={188}
              ariaLabel={donutAriaLabel}
            />
          </div>
          <div
            className="allocation-card__list"
            aria-label={t.beranda.wealthBreakdown}
          >
            {breakdown.map((item) => (
              <div className="allocation-row" key={item.label}>
                <div className="allocation-row__top">
                  <span className="allocation-row__label">
                    <span
                      className="allocation-row__dot"
                      style={{ backgroundColor: item.color }}
                      aria-hidden="true"
                    />
                    {item.label}
                  </span>
                  <span
                    className="allocation-row__value"
                    title={formatRupiah(item.amount)}
                  >
                    {formatRupiahCompact(item.amount)}
                  </span>
                </div>
                <div className="allocation-row__meta">
                  <span>{item.percent}%</span>
                  <span>{formatRupiah(item.amount)}</span>
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
      )}
    </SectionCard>
  );
}
