"use client";

/**
 * `/ringkasan` — rebuilt against `docs/prototype/pages/ringkasan.html`
 * (EPIC-026). This file only owns page-level state (trend range + privacy)
 * and composes the prototype's blocks, each of which lives in
 * `./_components`:
 *
 *   1. `.page-lead`                       → `RingkasanPageLead`
 *   2. `.bento-grid` hero + 3 stats       → `HeroStatsSection`
 *   3. `.bento-grid` trend + composition  → `TrendCompositionSection`
 *   4. "Rincian Aset vs Liabilitas" table → `BreakdownTableSection`
 *   5. `.grid.grid--3.equal-grid` band    → `CashflowCard` / `TopExpensesCard`
 *                                            / `HealthScoreCard`
 *
 * Two app-only blocks sit outside the prototype's five: the consolidated
 * IDR/USD/gram-emas total (EPIC-021 Group F, Open Design Decision #6) and the
 * liability breakdown chart (EPIC-025 N3-C2).
 *
 * All data comes from `useRingkasanData()` — real API queries. The
 * prototype's hardcoded mock figures are never used.
 */

import { useState } from "react";

import { useSession } from "@/lib/auth-compat";
import { useLocale } from "@/hooks/use-locale";
import { ConsolidatedTotalCard } from "@/components/consolidated-total-card";

import { BreakdownTableSection } from "./_components/breakdown-table-section";
import { CashflowCard } from "./_components/cashflow-card";
import { HealthScoreCard } from "./_components/health-score-card";
import { HeroStatsSection } from "./_components/hero-stats-section";
import { LiabilityBreakdownCard } from "./_components/liability-breakdown-card";
import { RingkasanPageLead } from "./_components/page-lead";
import { TopExpensesCard } from "./_components/top-expenses-card";
import { TrendCompositionSection } from "./_components/trend-composition-section";
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
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
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
      <RingkasanPageLead
        familyName={data.familyName}
        todayLabel={data.todayLabel}
        trendRange={trendRange}
        onTrendRangeChange={setTrendRange}
        customRange={customRange}
        onCustomRangeChange={setCustomRange}
        displayCurrency={displayCurrency}
        onDisplayCurrencyChange={setDisplayCurrency}
        privacyOn={privacyOn}
        onTogglePrivacy={togglePrivacy}
      />

      <HeroStatsSection data={data} displayCurrency={displayCurrency} />

      {noteCurrency && (
        <div className="t-xs t-muted">
          {t.ringkasan.indicativeFxNotePrefix}
          {noteCurrency}
          {t.ringkasan.indicativeFxNoteSuffix}
        </div>
      )}

      {/* EPIC-021 Group F (#6) — consolidated total shown simultaneously in
          IDR + USD + gram-emas (Open Design Decision #6). Not in the
          prototype; renders on the prototype's own `.card` surface via
          SectionCard, directly under the headline figures it restates. */}
      <ConsolidatedTotalCard
        netWorthIdr={data.netWorth}
        isLoading={data.isLoading}
      />

      <TrendCompositionSection data={data} trendRange={trendRange} />

      <BreakdownTableSection data={data} />

      <section className="grid grid--3 equal-grid">
        <CashflowCard data={data} />
        <TopExpensesCard data={data} />
        <HealthScoreCard data={data} />
      </section>

      <LiabilityBreakdownCard data={data} />
    </div>
  );
}
