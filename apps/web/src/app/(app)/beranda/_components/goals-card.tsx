"use client";

import { useRouter } from "next/navigation";
import { Target } from "lucide-react";
import type { GoalDto } from "@wealthme/contracts";
import { AnimatedProgress, CardLink, SectionCard } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";
import type { MoneyFormatters } from "./use-beranda-data";

/**
 * EPIC-026 Wave 8 — prototype's full-width `.card.bento-goals`
 * ("Tujuan Keuangan"): a `.bento-goal-list` grid of `.bento-goal` tiles, each
 * with a `.bento-goal__icon`, a mono "now / target" line, and a `.progress`.
 */
const GOAL_STATUS_COLOR: Record<GoalDto["status"], string> = {
  achieved: "var(--success)",
  on_track: "var(--primary)",
  needs_boost: "var(--warning)",
  at_risk: "var(--brand-purple)",
};

export function GoalsCard({
  isLoading,
  goals,
  fmt,
}: {
  isLoading: boolean;
  goals: GoalDto[];
  fmt: MoneyFormatters;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const items = goals.slice(0, 3);

  return (
    <SectionCard
      className="bento-goals"
      title={t.beranda.financialGoals}
      bodyClassName={
        isLoading || items.length === 0 ? undefined : "bento-goal-list"
      }
      action={
        <CardLink onClick={() => router.push("/tujuan")}>
          {t.common.viewAll}
        </CardLink>
      }
    >
      {isLoading ? (
        <div className="stack">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-[52px] animate-pulse rounded-md bg-muted"
              aria-hidden="true"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="stack items-center justify-center py-4 text-center">
          <Target className="size-7 text-muted-foreground/40" />
          <div className="t-md t-muted">{t.beranda.noGoals}</div>
          <button
            type="button"
            onClick={() => router.push("/tujuan")}
            className="card-link"
          >
            + {t.beranda.addGoalCta}
          </button>
        </div>
      ) : (
        items.map((g) => (
          <div className="bento-goal" key={g.id}>
            <div className="row gap-2">
              <span className="bento-goal__icon">{g.icon ?? "🎯"}</span>
              <div className="min-w-0 flex-1">
                <div className="t-sm t-bold truncate">{g.name}</div>
                <div className="t-xs t-muted mono truncate">
                  {fmt.moneyCompact(g.currentAmount)} /{" "}
                  {fmt.moneyCompact(g.targetAmount)}
                </div>
              </div>
            </div>
            <div className="mt-[9px]">
              <AnimatedProgress
                value={g.progressPercent}
                color={GOAL_STATUS_COLOR[g.status] ?? "var(--primary)"}
              />
            </div>
          </div>
        ))
      )}
    </SectionCard>
  );
}
