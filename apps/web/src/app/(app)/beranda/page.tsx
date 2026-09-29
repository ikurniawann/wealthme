"use client";

import { useState } from "react";
import { useSession } from "@/lib/auth-compat";
import { useLocale } from "@/hooks/use-locale";
import { BerandaHero } from "./_components/hero-card";
import { WealthSnapshot } from "./_components/wealth-snapshot";
import { StatCards } from "./_components/stat-cards";
import { CashflowCard } from "./_components/cashflow-card";
import { AllocationCard } from "./_components/allocation-card";
import { RecentActivity } from "./_components/recent-activity";
import { BudgetCard } from "./_components/budget-card";
import { AttentionCard } from "./_components/attention-card";
import { GoalsCard } from "./_components/goals-card";
import { SetupChecklistCard } from "./_components/setup-checklist-card";
import {
  useBerandaData,
  useMoneyFormatters,
  type BerandaPeriod,
} from "./_components/use-beranda-data";

/**
 * EPIC-026 Wave 8 — `/beranda` rebuilt 1:1 against
 * `docs/prototype/pages/beranda.html`'s `.bento-dashboard`.
 *
 * Section order matches the prototype exactly: hero (7) · composition
 * snapshot (5) · four stat tiles (3 each) · cashflow chart (7) · allocation
 * donut (5) · recent transactions (7) · side column with budget + needs
 * attention (5) · goals (full width). All spans come from `design-system.css`;
 * this file owns composition only — the sections live in `_components/`.
 */
function BerandaPage() {
  const { data: session } = useSession();
  const { t } = useLocale();
  const [period, setPeriod] = useState<BerandaPeriod>("6M");
  const [dismissedSetup, setDismissedSetup] = useState(false);

  const fmt = useMoneyFormatters();
  const data = useBerandaData(period);

  if (data.isError) {
    return (
      <div className="t-md t-muted flex items-center justify-center py-16">
        {t.beranda.loadError}
      </div>
    );
  }

  const firstName = session?.user?.name?.split(" ")[0] ?? "Kamu";
  const greetingKey = getGreetingKey(new Date().getHours());

  return (
    <div className="stack gap-3.5">
      <div className="section-title">
        {t.greeting[greetingKey]}, {firstName}
      </div>

      {data.isSetupChecklistReady &&
        !(data.setupChecklist.complete && dismissedSetup) && (
          <SetupChecklistCard
            {...data.setupChecklist}
            onDismiss={() => setDismissedSetup(true)}
          />
        )}

      <section
        className="bento-dashboard bento-dashboard--ordered"
        aria-label={t.beranda.title}
      >
        <BerandaHero
          isLoading={data.isLoading}
          netWorth={data.netWorth}
          assetsTotal={data.assetsTotal}
          totalLiabilities={data.totalLiabilities}
          currentMonth={data.currentMonth}
          historyPoints={data.historyPoints}
          isHistoryLoading={data.isHistoryLoading}
          period={period}
          onPeriodChange={setPeriod}
          fmt={fmt}
        />

        <WealthSnapshot
          isLoading={data.isLoading}
          liquidTotal={data.liquidTotal}
          nonLiquidTotal={data.nonLiquidTotal}
          liquidPct={data.liquidPct}
          nonLiquidPct={data.nonLiquidPct}
          fmt={fmt}
        />

        <StatCards
          hasData={Boolean(data.summary)}
          cashEwalletTotal={data.cashEwalletTotal}
          bankTotal={data.bankTotal}
          investasiTotal={data.investasiTotal}
          totalLiabilities={data.totalLiabilities}
          fmt={fmt}
        />

        <CashflowCard
          isLoading={data.isLoading}
          cashflow={data.cashflow}
          currentMonth={data.currentMonth}
          fmt={fmt}
        />

        <AllocationCard
          isLoading={data.isLoading}
          allocation={data.allocation}
        />

        <RecentActivity
          isLoading={data.isLoading}
          transactions={data.recentTransactions}
          fmt={fmt}
        />

        <div className="bento-side">
          <BudgetCard
            isLoading={data.isBudgetsLoading}
            budgets={data.budgets}
          />
          <AttentionCard
            isLoading={data.isLoading}
            pendingApprovalsCount={data.pendingApprovalsCount}
            nearestDueLiability={data.nearestDueLiability}
          />
        </div>

        <GoalsCard
          isLoading={data.isGoalsLoading}
          goals={data.goals}
          fmt={fmt}
        />
      </section>

      {/* EPIC-026 Wave 3 — the AI insight banner was removed: the prototype's
          bento-dashboard ends at `.bento-goals`, and the banner's "insight"
          was static i18n copy, not real analysis. */}
    </div>
  );
}

function getGreetingKey(
  h: number,
): "morning" | "afternoon" | "afternoon2" | "evening" {
  if (h < 11) return "morning";
  if (h < 15) return "afternoon";
  if (h < 18) return "afternoon2";
  return "evening";
}

export default BerandaPage;
export { BerandaPage };
