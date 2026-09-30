"use client";

import { useState } from "react";
import { useSession } from "@/lib/auth-compat";
import { useLocale } from "@/hooks/use-locale";
import { BentoGrid } from "@/components/wm";
import {
  AttentionTips,
  BerandaHeroCard,
  GoalsBento,
  HealthBento,
  HistoryBento,
  SpendingBento,
  LimitCard,
  WalletCard,
} from "./_components/bento-sections";
import { MobileHome } from "./_components/mobile-home";
import {
  useBerandaData,
  useMoneyFormatters,
  type BerandaPeriod,
} from "./_components/use-beranda-data";
import "./_components/beranda.css";

/**
 * Bento v2 Beranda (docs/design/proto/index.html). Desktop: dark hero with
 * the real six-month cash flow (or net-worth history) and a KPI column,
 * wallet, monthly limit, the one attention card, allocation, savings health,
 * goals and history. Phones (<= 720px) get the dedicated `MobileHome`. The
 * greeting and page title live in the shell (`PageGreeting`).
 */
function BerandaPage() {
  const { data: session } = useSession();
  const { t } = useLocale();
  const [period] = useState<BerandaPeriod>("6M");

  const fmt = useMoneyFormatters();
  const data = useBerandaData(period);

  if (data.isError) {
    return <p className="wm-cap py-16 text-center">{t.beranda.loadError}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <MobileHome
        netWorth={data.netWorth}
        accounts={data.accounts}
        members={data.members}
        currentMonth={data.currentMonth}
        cashflow={data.cashflow}
        transactions={data.recentTransactions}
        goals={data.goals}
        fmt={fmt}
      />

      <section aria-label={t.beranda.title}>
        <BentoGrid className="beranda-grid">
          <BerandaHeroCard
            netWorth={data.netWorth}
            currentMonth={data.currentMonth}
            cashflow={data.cashflow}
            fmt={fmt}
          />
          <WalletCard
            accounts={data.accounts}
            members={data.members}
            selfUserId={session?.userId}
            fmt={fmt}
          />
          <LimitCard budgets={data.budgets} fmt={fmt} />
          <AttentionTips
            pendingApprovalsCount={data.pendingApprovalsCount}
            nearestDueLiability={data.nearestDueLiability}
          />
          <SpendingBento fmt={fmt} />
          <HealthBento fmt={fmt} />
          <GoalsBento goals={data.goals} fmt={fmt} />
          <HistoryBento fmt={fmt} />
        </BentoGrid>
      </section>
    </div>
  );
}

export default BerandaPage;
export { BerandaPage };
