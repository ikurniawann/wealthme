"use client";

/**
 * `/ringkasan` — ported against `docs/design/proto/ringkasan.html` (source
 * of truth; the "Structural port fidelity follow-up" pass). This file only
 * owns page-level state (trend range + currency + privacy) and composes the
 * prototype's blocks, each of which lives in `./_components`:
 *
 *   1. `.r-hero` top-right `.hero-ctrl` row → `RingkasanPageLead`, rendered
 *      INSIDE `HeroStatsSection`/`BentoHero`'s `controls` slot. There is no
 *      standalone page-header row above the hero — the prototype has none.
 *   2. `.r-hero` (number, delta pill, multicur line, chart, KPIs) → `HeroStatsSection`
 *   3. `.r-comp` composition stack beside the hero → `CompositionBento`
 *   4. `.r-cash` / `.r-top` row             → `CashflowCard` / `TopExpensesCard`
 *   5. `.r-health` / `.r-liab` row          → `HealthScoreCard` / `LiabilityBreakdownCard`
 *   6. `.r-breakdown` table                 → `BreakdownTableSection` (last, full width)
 *
 * The former "Total Konsolidasi" (IDR/USD/gram-emas) card was removed — the
 * prototype has no such card, and its figures duplicate the hero's own
 * "≈ $X · Y gr emas" multicur line (now rendered in `HeroStatsSection`). The
 * `ConsolidatedTotalCard` component itself is untouched (still used by
 * `/beranda`).
 *
 * All data comes from `useRingkasanData()` — real API queries. The
 * prototype's hardcoded mock figures are never used.
 */

import { useState } from "react";
import "./ringkasan.css";

import { useSession } from "@/lib/auth-compat";
import { localIsoDate } from "@/lib/local-date";
import { useLocale } from "@/hooks/use-locale";
import { BentoGrid } from "@/components/wm";

import { BreakdownTableSection } from "./_components/breakdown-table-section";
import { CashflowCard } from "./_components/cashflow-card";
import { HealthScoreCard } from "./_components/health-score-card";
import { HeroStatsSection } from "./_components/hero-stats-section";
import { LiabilityBreakdownCard } from "./_components/liability-breakdown-card";
import { TopExpensesCard } from "./_components/top-expenses-card";
import { CompositionBento } from "./_components/trend-composition-section";
import { useRingkasanPrivacy } from "./_components/use-ringkasan-privacy";
import {
  useRingkasanData,
  type TrendCustomRange,
  type TrendRangeKey,
} from "./_components/use-ringkasan-data";
import {
  indicativeNoteCurrency,
  type DisplayCurrency,
} from "./_components/display-currency";

export default function RingkasanPage() {
  const { t } = useLocale();
  const { data: session } = useSession();
  const { privacyOn, togglePrivacy } = useRingkasanPrivacy(session?.userId);
  const [trendRange, setTrendRange] = useState<TrendRangeKey>("12m");
  // EPIC-033 group 5 (p30) — custom date window + display currency.
  const [customRange, setCustomRange] = useState<TrendCustomRange>(() => {
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth() - 3, to.getDate());
    return {
      from: localIsoDate(from),
      to: localIsoDate(to),
    };
  });
  const [displayCurrency, setDisplayCurrency] =
    useState<DisplayCurrency>("IDR");
  const data = useRingkasanData(trendRange, customRange);
  const noteCurrency = indicativeNoteCurrency(
    displayCurrency,
    data.currency,
    data.isIndicative,
  );

  if (data.isError) {
    return (
      <div className="flex items-center justify-center py-16 t-md t-muted">
        {t.ringkasan.errorLoad}
      </div>
    );
  }

  return (
    // `is-private` is the prototype's own privacy mechanism — every amount
    // below carries `.private`, which `design-system.css` blurs while this
    // class is present. The 16px gap reproduces the prototype's own
    // `.page > * + *` rhythm, which this single wrapper would otherwise
    // collapse.
    <div
      className={`stack${privacyOn ? " is-private" : ""}`}
      style={{ gap: 16 }}
    >
      <div className="rk2-top">
        <HeroStatsSection
          data={data}
          displayCurrency={displayCurrency}
          trendRange={trendRange}
          onTrendRangeChange={setTrendRange}
          customRange={customRange}
          onCustomRangeChange={setCustomRange}
          onDisplayCurrencyChange={setDisplayCurrency}
          privacyOn={privacyOn}
          onTogglePrivacy={togglePrivacy}
        />
        <div className="rk2-side">
          <CompositionBento data={data} />
        </div>
      </div>

      {noteCurrency && (
        <div className="t-xs t-muted">
          {t.ringkasan.indicativeFxNotePrefix}
          {noteCurrency}
          {t.ringkasan.indicativeFxNoteSuffix}
        </div>
      )}

      {/* Prototype `ringkasan.html` row order below the hero: Arus kas +
          Pengeluaran terbesar, then Skor kesehatan + Liabilitas terbesar,
          then the full-width Rincian Aset vs Liabilitas table last. */}
      <BentoGrid className="rk2-grid">
        <CashflowCard data={data} />
        <TopExpensesCard data={data} />
        <HealthScoreCard data={data} />
        <LiabilityBreakdownCard data={data} />
        <BreakdownTableSection data={data} />
      </BentoGrid>
    </div>
  );
}
