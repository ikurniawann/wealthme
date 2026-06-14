"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Gem, Eye, ArrowUp, ArrowDown } from "lucide-react";
import { Sparkline } from "@/components/charts/sparkline";
import {
  Donut,
  DonutLegend,
  type DonutSegment,
} from "@/components/charts/donut";
import { BarChart } from "@/components/charts/bar-chart";
import {
  HeroCard,
  SectionCard,
  CardLink,
  SummaryCard,
  ProgressBar,
} from "@/components/wm";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { formatRupiah, formatRupiahCompact } from "@/lib/format";
import type { DashboardSummaryDto, GoalDto } from "@wealthme/contracts";

const PERIODS = ["1M", "3M", "6M", "1Y", "All"] as const;

const ACCOUNT_TYPE_ICON: Record<string, { icon: string; iconBg: string }> = {
  bank: { icon: "🏦", iconBg: "#DBEAFE" },
  ewallet: { icon: "💵", iconBg: "#DCFCE7" },
  investment: { icon: "📈", iconBg: "#EDE9FE" },
  property: { icon: "🏠", iconBg: "#FEF9C3" },
  cash: { icon: "💵", iconBg: "#DCFCE7" },
};

const GOAL_STATUS_STYLE: Record<
  GoalDto["status"],
  { color: string; iconBg: string }
> = {
  achieved: { color: "var(--success)", iconBg: "#DCFCE7" },
  on_track: { color: "var(--primary)", iconBg: "#DBEAFE" },
  needs_boost: { color: "var(--warning)", iconBg: "#FEF9C3" },
  at_risk: { color: "var(--brand-purple)", iconBg: "#EDE9FE" },
};

function getGreetingKey(
  h: number,
): "morning" | "afternoon" | "afternoon2" | "evening" {
  if (h < 11) return "morning";
  if (h < 15) return "afternoon";
  if (h < 18) return "afternoon2";
  return "evening";
}

export default function BerandaPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useLocale();
  const firstName = session?.user?.name?.split(" ")[0] ?? "Kamu";
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("1M");

  const familyGroupId = session?.familyGroupId ?? null;

  const {
    data: summary,
    isLoading,
    isError,
  } = useQuery<DashboardSummaryDto>({
    queryKey: queryKeys.dashboard.summary(familyGroupId ?? ""),
    queryFn: () =>
      apiFetch<DashboardSummaryDto>(
        `/family-groups/${familyGroupId}/dashboard/summary`,
        { token: session?.accessToken },
      ),
    enabled: Boolean(familyGroupId) && Boolean(session?.accessToken),
    staleTime: 60_000,
  });

  const { data: goals, isLoading: isGoalsLoading } = useQuery<GoalDto[]>({
    queryKey: queryKeys.goals.all(familyGroupId ?? ""),
    queryFn: ({ signal }) =>
      apiFetch<GoalDto[]>(`/family-groups/${familyGroupId}/goals`, {
        token: session?.accessToken,
        signal,
      }),
    enabled: Boolean(familyGroupId) && Boolean(session?.accessToken),
    staleTime: 60_000,
  });

  function formatRelativeDate(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return t.common.today;
    if (diffDays === 1) return t.common.yesterday;
    return date.toLocaleDateString(t.beranda.dateLocale, {
      day: "numeric",
      month: "short",
    });
  }

  const goalItems = (goals ?? []).slice(0, 4).map((g) => {
    const style = GOAL_STATUS_STYLE[g.status] ?? GOAL_STATUS_STYLE.on_track;
    return {
      id: g.id,
      icon: g.icon ?? "🎯",
      iconBg: style.iconBg,
      name: g.name,
      pct: g.progressPercent,
      color: style.color,
      now: formatRupiahCompact(g.currentAmount),
      target: formatRupiahCompact(g.targetAmount),
    };
  });

  const allocation: DonutSegment[] = (summary?.allocation ?? []).map(
    (item) => ({
      label: item.label,
      value: item.value,
      color: item.color,
      sub: formatRupiah(item.amount),
    }),
  );

  const summaryCards = (summary?.accountSummary ?? []).map((s) => {
    const cfg = ACCOUNT_TYPE_ICON[s.type] ?? { icon: "💰", iconBg: "#F3F4F6" };
    return {
      icon: cfg.icon,
      iconBg: cfg.iconBg,
      label: s.label,
      amount: formatRupiahCompact(s.total),
      delta: "—",
      up: true as boolean,
    };
  });

  const activities = (summary?.recentTransactions ?? []).map((tx) => ({
    icon: tx.type === "income" ? "📥" : tx.type === "expense" ? "💳" : "🔄",
    iconBg: tx.type === "income" ? "#DCFCE7" : "#FEE2E2",
    name: tx.description ?? tx.accountName,
    cat:
      tx.categoryName ??
      (tx.type === "income"
        ? t.common.income2
        : tx.type === "expense"
          ? t.common.expense2
          : t.common.transfer),
    amt: (tx.type === "income" ? "+" : "-") + formatRupiah(tx.amount),
    inc: tx.type === "income",
    date: formatRelativeDate(tx.occurredAt),
  }));

  const sparklinePoints =
    summary?.sparkline && summary.sparkline.length > 0
      ? summary.sparkline
      : (Array(30).fill(50) as number[]);

  const cashflow = summary?.cashflow;
  const netWorth = summary?.netWorth ?? 0;
  const currentMonth = summary?.currentMonth;

  if (isError) {
    return (
      <div className="flex items-center justify-center py-16 text-[13px] text-muted-foreground">
        {t.beranda.loadError}
      </div>
    );
  }

  const donutCenterValue =
    netWorth >= 1_000_000_000
      ? (netWorth / 1_000_000_000).toFixed(2).replace(".", ",") + "M"
      : netWorth >= 1_000_000
        ? (netWorth / 1_000_000).toFixed(0) + " jt"
        : formatRupiah(netWorth);

  const greetingKey = getGreetingKey(new Date().getHours());
  const sparkLabels = t.common.sparkLabels;

  return (
    <div className="space-y-3.5">
      <div className="mb-[18px]">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[21px] font-extrabold">
            {t.greeting[greetingKey]}, {firstName} 👋
          </div>
          <LocaleSwitcher />
        </div>
        <div className="mt-0.5 text-[12.5px] text-muted-foreground">
          {t.beranda.subtitle}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {/* Wealth Hero */}
        <HeroCard className="gradient-wealth">
          <div className="flex items-center gap-1.5 text-[12.5px] font-semibold opacity-90">
            <Gem className="size-[13px] opacity-80" /> {t.beranda.totalWealth}
            <button
              aria-label={t.common.toggleBalance}
              className="ml-0.5 cursor-pointer opacity-60"
            >
              <Eye className="size-[13px]" />
            </button>
          </div>
          <div className="mt-1 text-[28px] font-extrabold tracking-tight">
            {isLoading ? t.common.loading : formatRupiah(netWorth)}
          </div>
          {currentMonth && (
            <div className="mt-1 text-[12.5px]">
              <span
                className={
                  currentMonth.net >= 0
                    ? "font-semibold text-emerald-300"
                    : "font-semibold text-red-300"
                }
              >
                {currentMonth.net >= 0 ? "▲" : "▼"}{" "}
                {formatRupiah(Math.abs(currentMonth.net))} {t.beranda.thisMonth}
              </span>{" "}
              <span className="opacity-60">
                ({t.common.savingsRate} {currentMonth.savingsRate}%)
              </span>
            </div>
          )}

          <div
            role="group"
            aria-label={t.common.period}
            className="mt-3.5 flex gap-1.5"
          >
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                aria-pressed={period === p}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                  period === p
                    ? "bg-white text-primary"
                    : "bg-white/15 text-white hover:bg-white/25"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="mt-3 -mx-[22px]">
            <Sparkline points={sparklinePoints} />
            <div className="mt-1 flex justify-between px-[22px] text-[10px] opacity-60">
              {sparkLabels.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
          </div>
        </HeroCard>

        {/* Allocation */}
        <SectionCard
          title={t.beranda.wealthBreakdown}
          action={
            <CardLink onClick={() => router.push("/aset")}>
              {t.common.viewDetail}
            </CardLink>
          }
        >
          {isLoading ? (
            <div className="flex h-[105px] items-center justify-center text-[13px] text-muted-foreground">
              {t.common.loading}
            </div>
          ) : allocation.length === 0 ? (
            <div className="flex h-[105px] items-center justify-center text-[13px] text-muted-foreground">
              {t.common.noData}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3.5">
              <Donut
                segments={allocation}
                size={105}
                thickness={17}
                centerValue={donutCenterValue}
                centerLabel={t.common.total}
              />
              <div className="min-w-[110px] flex-1">
                <DonutLegend segments={allocation} total={100} />
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {isLoading
          ? Array(5)
              .fill(null)
              .map((_, i) => (
                <div
                  key={i}
                  className="h-[88px] animate-pulse rounded-[14px] bg-muted"
                />
              ))
          : summaryCards.slice(0, 5).map((s) => (
              <SummaryCard
                key={s.label}
                icon={s.icon}
                iconBg={s.iconBg}
                label={s.label}
                amount={s.amount}
                delta={
                  <>
                    {s.up ? (
                      <ArrowUp className="size-[9px]" />
                    ) : (
                      <ArrowDown className="size-[9px]" />
                    )}
                    {s.delta}
                  </>
                }
                deltaUp={s.up}
              />
            ))}
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        {/* Cashflow */}
        <SectionCard
          title={t.common.cashFlow}
          action={
            <select className="rounded-md border bg-background px-2 py-[3px] text-[11px] text-muted-foreground outline-none">
              <option>
                {cashflow?.months[cashflow.months.length - 1] ?? "—"}{" "}
                {t.common.latest}
              </option>
            </select>
          }
        >
          <div className="mb-2.5 flex flex-wrap gap-4">
            <div>
              <div className="text-[10.5px] text-muted-foreground">
                {t.common.income}
              </div>
              <div className="text-[15px] font-extrabold text-success">
                {isLoading ? "..." : formatRupiah(currentMonth?.income ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-[10.5px] text-muted-foreground">
                {t.common.expense}
              </div>
              <div className="text-[15px] font-extrabold text-destructive">
                {isLoading ? "..." : formatRupiah(currentMonth?.expense ?? 0)}
              </div>
            </div>
          </div>
          <div className="mb-2 text-[11px] text-muted-foreground">
            {t.common.surplus}{" "}
            <span className="font-bold text-success">
              {isLoading ? "..." : formatRupiah(currentMonth?.net ?? 0)}
            </span>
          </div>
          {cashflow && (
            <BarChart
              months={cashflow.months}
              income={cashflow.income}
              expense={cashflow.expense}
              max={cashflow.max}
              height={90}
            />
          )}
        </SectionCard>

        {/* Recent activity */}
        <SectionCard
          title={t.beranda.recentTransactions}
          action={
            <CardLink onClick={() => router.push("/transaksi")}>
              {t.common.viewAll}
            </CardLink>
          }
        >
          {isLoading ? (
            <div className="space-y-2">
              {Array(3)
                .fill(null)
                .map((_, i) => (
                  <div
                    key={i}
                    className="h-[42px] animate-pulse rounded-md bg-muted"
                  />
                ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="py-4 text-center text-[13px] text-muted-foreground">
              {t.beranda.noTransactions}
            </div>
          ) : (
            <div className="divide-y">
              {activities.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div
                    className="flex size-[34px] items-center justify-center rounded-md text-[15px]"
                    style={{ background: a.iconBg }}
                  >
                    {a.icon}
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold">{a.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {a.cat}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-[13px] font-bold ${a.inc ? "text-success" : "text-destructive"}`}
                    >
                      {a.amt}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {a.date}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Goals */}
        <SectionCard
          title={t.beranda.financialGoals}
          action={
            <CardLink onClick={() => router.push("/tujuan")}>
              {t.common.viewAll}
            </CardLink>
          }
        >
          {isGoalsLoading ? (
            <div className="space-y-3.5">
              {Array(3)
                .fill(null)
                .map((_, i) => (
                  <div
                    key={i}
                    className="h-[52px] animate-pulse rounded-md bg-muted"
                  />
                ))}
            </div>
          ) : goalItems.length === 0 ? (
            <div className="py-4 text-center text-[13px] text-muted-foreground">
              {t.beranda.noGoals}
            </div>
          ) : (
            <div className="space-y-3.5">
              {goalItems.map((g) => (
                <div key={g.id}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <div
                      className="flex size-[26px] items-center justify-center rounded-md text-[13px]"
                      style={{ background: g.iconBg }}
                    >
                      {g.icon}
                    </div>
                    <div className="flex-1 text-[13px] font-semibold">
                      {g.name}
                    </div>
                    <div
                      className="text-[13px] font-bold"
                      style={{ color: g.color }}
                    >
                      {g.pct}%
                    </div>
                  </div>
                  <ProgressBar value={g.pct} color={g.color} />
                  <div className="mt-1 flex justify-between text-[10.5px] text-muted-foreground">
                    <span>{g.now}</span>
                    <span>{g.target}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* AI insight banner */}
      <div className="flex items-center gap-3.5 rounded-[14px] bg-accent p-4">
        <div className="text-[26px]">📊</div>
        <div className="flex-1">
          <div className="text-[13px] font-bold text-primary-strong">
            {t.beranda.aiInsightTitle}
          </div>
          <div className="mt-0.5 text-[12px] text-muted-foreground">
            {t.beranda.aiInsightBody}
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push("/ai")}
          className="cursor-pointer rounded-lg bg-primary px-3.5 py-2 text-[12px] font-semibold whitespace-nowrap text-primary-foreground hover:opacity-90"
        >
          {t.beranda.aiInsightCta}
        </button>
      </div>
    </div>
  );
}
