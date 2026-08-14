"use client";

// EPIC-025 N3-C2 — HBarChart mount for the liability breakdown, over the same
// `/liabilities` list `/liabilitas` already fetches. App-only: the prototype's
// ringkasan has no liability chart, so this keeps the existing feature while
// rendering on the prototype's `.card` surface, placed last so the five
// prototype blocks above stay in their original order.
//
// Colour: previously hardcoded to `var(--destructive)` at this call site. Now
// left unset so `HBarChart` falls back to the shared palette's `--chart-1`
// (brand teal) — the destructive red is reserved for the top-expenses series
// the prototype itself colours that way.

import { HBarChart } from "@/components/charts/apex-presets";
import { useLocale } from "@/hooks/use-locale";
import type { RingkasanData } from "./use-ringkasan-data";

export function LiabilityBreakdownCard({ data }: { data: RingkasanData }) {
  const { t } = useLocale();
  const {
    isLiabilitiesLoading,
    liabilityBreakdown,
    liabilityCategories,
    liabilityData,
    liabilityAriaLabel,
  } = data;

  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title">{t.ringkasan.liabilityBreakdownTitle}</h2>
      </div>
      <div className="card__body">
        {isLiabilitiesLoading ? (
          <div className="h-[180px] animate-pulse rounded-md bg-muted" />
        ) : liabilityBreakdown.length === 0 ? (
          <div className="py-4 text-center t-md t-muted">
            {t.ringkasan.emptyLiabilityBreakdown}
          </div>
        ) : (
          <div className="chart private">
            <HBarChart
              categories={liabilityCategories}
              data={liabilityData}
              ariaLabel={liabilityAriaLabel}
            />
          </div>
        )}
      </div>
    </section>
  );
}
