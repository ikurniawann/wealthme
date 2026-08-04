"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-compat";
import { useQuery } from "@tanstack/react-query";
import {
  Gem,
  Eye,
  ArrowUp,
  ArrowDown,
  Landmark,
  Wallet,
  TrendingUp,
  Home,
  CreditCard,
  ArrowDownLeft,
  ArrowLeftRight,
  Target,
  type LucideIcon,
} from "lucide-react";
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
  IconChip,
  CountUpRupiah,
  AnimatedProgress,
  Rise,
} from "@/components/wm";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useLocale } from "@/hooks/use-locale";
import { useCurrencyPreference } from "@/hooks/use-currency-preference";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { formatRupiah, formatRupiahCompact } from "@/lib/format";
import type {
  DashboardSummaryDto,
  GoalDto,
  NetWorthHistoryDto,
} from "@wealthme/contracts";

const PERIODS = ["1M", "3M", "6M", "1Y", "All"] as const;

const PERIOD_RANGE: Record<(typeof PERIODS)[number], string> = {
  "1M": "30d",
  "3M": "3m",
  "6M": "6m",
  "1Y": "12m",
  All: "120m",
};

const ACCOUNT_TYPE_ICON: Record<string, { icon: LucideIcon; chip: string }> = {
  bank: { icon: Landmark, chip: "bg-blue-100 text-blue-600" },
  ewallet: { icon: Wallet, chip: "bg-green-100 text-green-600" },
  investment: { icon: TrendingUp, chip: "bg-violet-100 text-violet-600" },
  property: { icon: Home, chip: "bg-yellow-100 text-yellow-600" },
  cash: { icon: Wallet, chip: "bg-green-100 text-green-600" },
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

function BerandaPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useLocale();
  const { currency, formatMoney, isIndicative, isReady } =
    useCurrencyPreference();
  // Every monetary display on this page routes through these two helpers so
  // conversion coverage stays consistent — never a fabricated 1:1-rate
  // number rendered under a foreign currency symbol while the FX rate is
  // still loading (or failed to load).
  const money = (value: number): string =>
    !isReady
      ? t.common.loading
      : isIndicative
        ? `≈ ${formatMoney(value)}`
        : formatRupiah(value);
  const moneyCompact = (value: number): string =>
    !isReady
      ? t.common.loading
      : isIndicative
        ? `≈ ${formatMoney(value)}`
        : formatRupiahCompact(value);
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

  const range = PERIOD_RANGE[period];
  // ponytail: inline key — lib/query-keys.ts is a protected foundation file.
  const { data: netWorthHistory } = useQuery<NetWorthHistoryDto>({
    queryKey: ["dashboard", familyGroupId ?? "", "net-worth-history", range],
    queryFn: () =>
      apiFetch<NetWorthHistoryDto>(
        `/family-groups/${familyGroupId}/dashboard/net-worth/history?range=${range}`,
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
      now: moneyCompact(g.currentAmount),
      target: moneyCompact(g.targetAmount),
    };
  });

  const allocation: DonutSegment[] = (summary?.allocation ?? []).map(
    (item) => ({
      label: item.label,
      value: item.value,
      color: item.color,
      sub: money(item.amount),
    }),
  );

  const SUMMARY_ROUTE: Record<string, string> = {
    investment: "/investasi",
    property: "/aset",
    bank: "/rekening",
    ewallet: "/rekening",
    cash: "/rekening",
  };

  const summaryCards = (summary?.accountSummary ?? []).map((s) => {
    const cfg = ACCOUNT_TYPE_ICON[s.type] ?? {
      icon: Wallet,
      chip: "bg-gray-100 text-gray-600",
    };
    // isIndicative (non-IDR preference): switch from the compact IDR format
    // to formatMoney's converted output, prefixed with "≈" — these mock FX
    // rates are indicative, never a live/authoritative conversion. IDR
    // (the default) keeps today's exact compact format unchanged. moneyCompact
    // also withholds rendering (loading placeholder) until the FX rate is
    // actually ready, so this never shows a fabricated 1:1-rate number.
    return {
      icon: cfg.icon,
      chip: cfg.chip,
      label: s.label,
      amount: moneyCompact(s.total),
      delta: "—",
      up: true as boolean,
      href: SUMMARY_ROUTE[s.type] ?? "/rekening",
    };
  });

  const activities = (summary?.recentTransactions ?? []).map((tx) => ({
    icon:
      tx.type === "income"
        ? ArrowDownLeft
        : tx.type === "expense"
          ? CreditCard
          : ArrowLeftRight,
    chip:
      tx.type === "income"
        ? "bg-green-100 text-green-600"
        : tx.type === "expense"
          ? "bg-red-100 text-red-600"
          : "bg-violet-100 text-violet-600",
    name: tx.description ?? tx.accountName,
    cat:
      tx.categoryName ??
      (tx.type === "income"
        ? t.common.income2
        : tx.type === "expense"
          ? t.common.expense2
          : t.common.transfer),
    amt: !isReady
      ? t.common.loading
      : (tx.type === "income" ? "+" : "-") + money(tx.amount),
    inc: tx.type === "income",
    date: formatRelativeDate(tx.occurredAt),
  }));

  // Real wealth trend from persisted snapshots; falls back to the 30-day
  // transaction-flow proxy until enough snapshots accumulate.
  const snapshotPoints = (netWorthHistory?.points ?? []).map((p) =>
    Number(p.netWorth),
  );
  const sparklinePoints =
    snapshotPoints.length >= 2
      ? snapshotPoints
      : summary?.sparkline && summary.sparkline.length > 0
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

  const donutCenterValue = isIndicative
    ? money(netWorth)
    : netWorth >= 1_000_000_000
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

      {/*
        Wide-viewport main+aside reflow (EPIC-018 Task C). Below `lg` this
        wrapper is a plain `space-y-3.5` stack, so the blocks below render in
        exactly today's order/spacing — untouched. At `lg`+ it becomes a
        3-col grid (main = col 1-2 / ~2/3, aside = col 3 / ~1/3); the two
        "row" wrapper divs below switch to `display: contents` at `lg` so
        their children become direct grid items — DOM order stays identical,
        only visual placement changes. Hero + the cashflow chart stay wide in
        the main column; the allocation breakdown, recent activity, and
        goals lists move into the narrower aside alongside them.
      */}
      <div className="space-y-3.5 lg:grid lg:grid-cols-3 lg:items-start lg:gap-3.5 lg:space-y-0">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:contents">
          {/* Wealth Hero */}
          <Rise
            index={0}
            className="lg:col-start-1 lg:col-end-3 lg:row-start-1"
          >
            <HeroCard className="gradient-wealth">
              <div className="flex items-center gap-1.5 text-[12.5px] font-semibold opacity-90">
                <Gem className="size-[13px] opacity-80" />{" "}
                {t.beranda.totalWealth}
                <button
                  aria-label={t.common.toggleBalance}
                  className="ml-0.5 cursor-pointer opacity-60"
                >
                  <Eye className="size-[13px]" />
                </button>
              </div>
              <h1 className="mono mt-1 text-[28px] font-extrabold tracking-tight">
                {isLoading || (isIndicative && !isReady) ? (
                  t.common.loading
                ) : isIndicative ? (
                  <>≈ {formatMoney(netWorth)}</>
                ) : (
                  <CountUpRupiah value={netWorth} />
                )}
              </h1>
              {isIndicative && (
                <div className="mt-0.5 text-[10.5px] opacity-70">
                  Perkiraan dalam {currency} · kurs indikatif, bukan kurs pasar
                  real-time
                </div>
              )}
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
                    {money(Math.abs(currentMonth.net))} {t.beranda.thisMonth}
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
          </Rise>

          {/* Allocation */}
          <Rise index={1} className="lg:col-start-3 lg:row-start-1">
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
          </Rise>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-start-1 lg:col-end-3 lg:row-start-2 lg:grid-cols-3 xl:grid-cols-5">
          {isLoading
            ? Array(5)
                .fill(null)
                .map((_, i) => (
                  <div
                    key={i}
                    className="h-[88px] animate-pulse rounded-[14px] bg-muted"
                  />
                ))
            : summaryCards.slice(0, 5).map((s, i) => (
                <Rise key={s.label} index={2 + i}>
                  <div
                    role="link"
                    tabIndex={0}
                    aria-label={`Buka ${s.label}`}
                    onClick={() => router.push(s.href)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        router.push(s.href);
                    }}
                    className="cursor-pointer transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]"
                  >
                    <SummaryCard
                      icon={
                        <IconChip icon={s.icon} className={s.chip} size={34} />
                      }
                      iconBg="transparent"
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
                  </div>
                </Rise>
              ))}
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3 lg:contents">
          {/* Cashflow */}
          <SectionCard
            title={t.common.cashFlow}
            className="lg:col-start-1 lg:col-end-3 lg:row-start-3"
            action={
              <span className="rounded-md border bg-background px-2 py-[3px] text-[11px] text-muted-foreground">
                {cashflow?.months[cashflow.months.length - 1] ?? "—"}{" "}
                {t.common.latest}
              </span>
            }
          >
            <div className="mb-2.5 flex flex-wrap gap-4">
              <div>
                <div className="text-[10.5px] text-muted-foreground">
                  {t.common.income}
                </div>
                <div className="text-[15px] font-extrabold text-success">
                  {isLoading ? "..." : money(currentMonth?.income ?? 0)}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] text-muted-foreground">
                  {t.common.expense}
                </div>
                <div className="text-[15px] font-extrabold text-destructive">
                  {isLoading ? "..." : money(currentMonth?.expense ?? 0)}
                </div>
              </div>
            </div>
            <div className="mb-2 text-[11px] text-muted-foreground">
              {t.common.surplus}{" "}
              <span className="font-bold text-success">
                {isLoading ? "..." : money(currentMonth?.net ?? 0)}
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
            className="lg:col-start-3 lg:row-start-2"
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
                    <IconChip
                      icon={a.icon}
                      className={a.chip}
                      size={34}
                      rounded="rounded-full"
                    />
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
            className="lg:col-start-3 lg:row-start-3"
            action={
              <CardLink onClick={() => router.push("/tujuan")}>
                {t.common.viewAll}
              </CardLink>
            }
            bodyClassName="flex flex-1 flex-col"
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
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-4 text-center">
                <Target className="size-7 text-muted-foreground/40" />
                <div className="text-[13px] text-muted-foreground">
                  {t.beranda.noGoals}
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/tujuan")}
                  className="text-[12px] font-semibold text-primary hover:underline"
                >
                  + {t.beranda.addGoalCta}
                </button>
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
                    <AnimatedProgress value={g.pct} color={g.color} />
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
        <div className="flex items-center gap-3.5 rounded-[14px] bg-accent p-4 lg:col-start-1 lg:col-end-4 lg:row-start-4">
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
    </div>
  );
}

export default BerandaPage;
export { BerandaPage };
