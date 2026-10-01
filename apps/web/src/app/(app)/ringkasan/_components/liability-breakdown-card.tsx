"use client";

// EPIC-025 N3-C2 / EPIC-026 bento v2 — liability breakdown over the same
// `/liabilities` list `/liabilitas` already fetches. Maps onto the
// prototype's `.r-liab` ("Liabilitas terbesar") bento card, placed alongside
// the health-score card per `ringkasan.html`'s grid. `drawLiabilities()`
// renders `#liabBars` as an `.hbars` list (name, amount in red, a thin red
// track bar sized off the largest liability) — not an Apex hbar chart.

import { BentoCard, Track } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";
import type { RingkasanData } from "./use-ringkasan-data";

export function LiabilityBreakdownCard({ data }: { data: RingkasanData }) {
  const { t } = useLocale();
  const { isLiabilitiesLoading, liabilityBreakdown, liabilityData, moneyFull } =
    data;

  const maxAmount = liabilityData.reduce((max, v) => Math.max(max, v), 0);

  return (
    <BentoCard className="rk2-liab" title={t.ringkasan.liabilityBreakdownTitle}>
      <div className="stack private" style={{ gap: 10, marginTop: 12 }}>
        {isLiabilitiesLoading ? (
          <div className="h-[180px] animate-pulse rounded-md bg-muted" />
        ) : liabilityBreakdown.length === 0 ? (
          <div className="py-4 text-center t-md t-muted">
            {t.ringkasan.emptyLiabilityBreakdown}
          </div>
        ) : (
          liabilityBreakdown.map((l) => {
            const amount = Number(l.remainingBalance);
            return (
              <div key={l.id}>
                <div className="row row--between">
                  <span className="t-xs t-bold truncate">{l.name}</span>
                  <span className="t-xs t-danger mono shrink-0">
                    {moneyFull(amount)}
                  </span>
                </div>
                <Track
                  value={maxAmount > 0 ? (amount / maxAmount) * 100 : 0}
                  fill="bad"
                  className="mt-[5px]"
                />
              </div>
            );
          })
        )}
      </div>
    </BentoCard>
  );
}
