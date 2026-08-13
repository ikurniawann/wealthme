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
import type { DonutSegment } from "@/components/charts/donut";
// EPIC-025 N3-G1 — the chart swap: ApexCharts presets replace the old
// Sparkline/Donut+DonutLegend/BarChart components. Every series below is the
// SAME data these components rendered before the swap (traced inline).
import {
  CashflowChart,
  DonutChart,
  SparklineChart,
} from "@/components/charts/apex-presets";
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
import { useGoldPrice } from "@/hooks/use-gold-price";
import { formatGoldGrams } from "@/components/consolidated-total-card";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { formatRupiah, formatRupiahCompact } from "@/lib/format";
import type {
  AllowanceRequestDto,
  DashboardSummaryDto,
  GoalDto,
  LiabilityDto,
  NetWorthDto,
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
  // EPIC-021 Group F (#6) — the hero card's gold-equivalent line (part of
  // the consolidated IDR/USD/gram-emas total, Open Design Decision #6).
  const { hasPrice: hasGoldPrice, toGoldGrams } = useGoldPrice();
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

  // EPIC-025 N3-G1 — bento-hero footer metric ("Liabilitas"). Same
  // `/dashboard/net-worth` endpoint `ringkasan` already fetches; only
  // `liabilitiesTotal` is read here (no new backend work, per Ground Truth).
  const { data: netWorthData } = useQuery<NetWorthDto>({
    queryKey: queryKeys.netWorth.summary(familyGroupId ?? ""),
    queryFn: () =>
      apiFetch<NetWorthDto>(
        `/family-groups/${familyGroupId}/dashboard/net-worth`,
        { token: session?.accessToken },
      ),
    enabled: Boolean(familyGroupId) && Boolean(session?.accessToken),
    staleTime: 60_000,
  });

  // EPIC-025 N3 fidelity follow-up — "Perlu Perhatian" card
  // (`docs/prototype/pages/beranda.html`'s `.bento-side` second article),
  // cut in N3-G1 on the (wrong) assumption it needed a new endpoint. Both
  // queries below already exist and are already fetched by
  // /persetujuan and /liabilitas respectively — no new backend work.
  const { data: allowanceRequests } = useQuery<AllowanceRequestDto[]>({
    queryKey: queryKeys.allowanceRequests.all(familyGroupId ?? ""),
    queryFn: () =>
      apiFetch<AllowanceRequestDto[]>(
        `/family-groups/${familyGroupId}/allowance-requests`,
        { token: session?.accessToken },
      ),
    enabled: Boolean(familyGroupId) && Boolean(session?.accessToken),
    staleTime: 60_000,
  });
  const { data: liabilities } = useQuery<LiabilityDto[]>({
    queryKey: queryKeys.liabilities.all(familyGroupId ?? ""),
    queryFn: () =>
      apiFetch<LiabilityDto[]>(`/family-groups/${familyGroupId}/liabilities`, {
        token: session?.accessToken,
      }),
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

  // `allocation` keeps the percentage-based shape (`item.value`) the old
  // `DonutLegend` rendered — still used below for the legend rows/aria text.
  const allocation: DonutSegment[] = (summary?.allocation ?? []).map(
    (item) => ({
      label: item.label,
      value: item.value,
      color: item.color,
      sub: money(item.amount),
    }),
  );
  // EPIC-025 N3-G1 — DonutChart series, value = `item.amount` (Rupiah), NOT
  // the percentage: the Apex preset sums `value` for its center-total label
  // and formats it as currency, so the series must carry the real amount to
  // preserve numeric parity (matches `ringkasan`'s N3-C2 DonutChart wiring).
  const donutSegments: DonutSegment[] = (summary?.allocation ?? []).map(
    (item) => ({
      label: item.label,
      value: item.amount,
      color: item.color,
    }),
  );

  // "Perlu Perhatian" notices — same derivations liabilitas/persetujuan
  // already compute client-side from their own fetched lists.
  const pendingApprovalsCount = (allowanceRequests ?? []).filter(
    (r) => r.status === "pending",
  ).length;
  const nearestDueLiability = (liabilities ?? [])
    .filter((l) => l.dueDate)
    .sort((a, b) =>
      (a.dueDate as string).localeCompare(b.dueDate as string),
    )[0];

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
    // EPIC-023 Task E retry (MEDIUM 5) — `accountName` is null for a card
    // purchase (E3); without this fallback a description-less card
    // purchase rendered a blank-named row here.
    name: tx.description ?? tx.accountName ?? "—",
    cat:
      tx.categoryName ??
      (tx.type === "income"
        ? t.common.income2
        : tx.type === "expense"
          ? t.common.expense2
          : t.common.transfer),
    // EPIC-022 B8 — a transfer is neither income nor expense; render it
    // neutrally (no +/- sign) instead of a red negative that contradicts
    // its neutral (violet) chip above.
    amt: !isReady
      ? t.common.loading
      : tx.type === "transfer"
        ? money(tx.amount)
        : (tx.type === "income" ? "+" : "-") + money(tx.amount),
    inc: tx.type === "income",
    isTransfer: tx.type === "transfer",
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
  // EPIC-021 Group F (#6) — gold-equivalent of net worth, null until the
  // family owner sets a price (Open Design Decision #6: manual only).
  const goldGrams = hasGoldPrice ? toGoldGrams(netWorth) : null;

  // EPIC-025 N3-G1 — bento-hero footer + "Komposisi Kekayaan" snapshot card.
  // Both derived purely from data this page already fetches (`summary`,
  // `netWorthData`) — no new backend endpoint, per Ground Truth.
  const assetsTotal = summary?.assetsTotal ?? 0;
  const totalLiabilities = Number(netWorthData?.liabilitiesTotal ?? 0);
  const LIQUID_TYPES = new Set(["cash", "ewallet", "bank"]);
  const liquidTotal = (summary?.accountSummary ?? [])
    .filter((s) => LIQUID_TYPES.has(s.type))
    .reduce((sum, s) => sum + s.total, 0);
  const nonLiquidTotal = (summary?.accountSummary ?? [])
    .filter((s) => !LIQUID_TYPES.has(s.type))
    .reduce((sum, s) => sum + s.total, 0);
  const liquidPct =
    assetsTotal > 0 ? Math.round((liquidTotal / assetsTotal) * 1000) / 10 : 0;
  const nonLiquidPct =
    assetsTotal > 0
      ? Math.round((nonLiquidTotal / assetsTotal) * 1000) / 10
      : 0;

  // EPIC-025 N3-G1 — chart-parity aria labels: every value below is read
  // from the same `summary`/`netWorthHistory` data the chart series render,
  // never a separately-computed number.
  const sparklineAriaLabel =
    sparklinePoints.length >= 2
      ? `${t.beranda.totalWealth}: ${money(sparklinePoints[0]!)} → ${money(sparklinePoints[sparklinePoints.length - 1]!)}`
      : t.beranda.totalWealth;
  const cashflowAriaLabel = cashflow
    ? `${t.common.cashFlow} ${cashflow.months[cashflow.months.length - 1] ?? ""}: ${t.common.income} ${money(currentMonth?.income ?? 0)}, ${t.common.expense} ${money(currentMonth?.expense ?? 0)}`
    : t.common.cashFlow;
  const donutAriaLabel =
    allocation.length > 0
      ? `${t.beranda.wealthBreakdown}: ${allocation.map((a) => `${a.label} ${a.value}%`).join(", ")}`
      : t.beranda.wealthBreakdown;

  if (isError) {
    return (
      <div className="flex items-center justify-center py-16 text-[13px] text-muted-foreground">
        {t.beranda.loadError}
      </div>
    );
  }

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
        EPIC-025 N3-G1 — bento-grid layout port
        (`docs/prototype/pages/beranda.html`'s `.bento-dashboard`): a 12-col
        grid at `lg`+, 2-col tablet, stacked mobile. Card spans mirror the
        prototype's `.bento-hero`(7)/`.bento-snapshot`(5)/`.bento-stat`(3
        each)/`.bento-chart`(7)/`.bento-allocation`(5)/`.bento-transactions`(7)/
        `.bento-goals`(12). The prototype's `.bento-side` (budget-overview +
        "Perlu Perhatian" notices) is NOT ported — beranda does not fetch
        budget or pending-approval data today, and this wave is
        presentation-only (Ground Truth: fold only what's already fetched,
        never invent a new endpoint).
      */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-12 lg:items-start">
        <div className="grid grid-cols-1 gap-3.5 md:col-span-2 md:grid-cols-2 lg:contents">
          {/* Wealth Hero */}
          <Rise index={0} className="lg:col-span-7">
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
              {/* EPIC-021 Group F (#6) — gold-equivalent line, part of the
                  consolidated IDR/USD/gram-emas total (Open Design
                  Decision #6: no live gold feed, manual price only). */}
              {!isLoading && goldGrams !== null && (
                <div className="mt-0.5 text-[10.5px] opacity-70">
                  ≈ {formatGoldGrams(goldGrams)}
                  {t.consolidatedTotal.goldUnitSuffix}{" "}
                  {t.consolidatedTotal.goldLabel.toLowerCase()}
                </div>
              )}
              {!isLoading && goldGrams === null && (
                <div className="mt-0.5 text-[10.5px] opacity-70">
                  <button
                    type="button"
                    onClick={() => router.push("/akun")}
                    className="cursor-pointer underline decoration-white/40 underline-offset-2 hover:decoration-white"
                  >
                    {t.consolidatedTotal.goldPromptText}
                  </button>
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
                {/* EPIC-025 N3-G1 — Sparkline → SparklineChart (Apex). Same
                    `sparklinePoints` series as before the swap, just a
                    different rendering library. */}
                <SparklineChart
                  data={sparklinePoints}
                  color="#ffffff"
                  ariaLabel={sparklineAriaLabel}
                />
                <div className="mt-1 flex justify-between px-[22px] text-[10px] opacity-60">
                  {sparkLabels.map((l) => (
                    <span key={l}>{l}</span>
                  ))}
                </div>
              </div>

              {/* EPIC-025 N3-G1 — bento-hero__footer (prototype metrics
                  row): Aset / Liabilitas / Arus kas bulan ini, all derived
                  from data this page already fetches. */}
              <div className="mt-3.5 grid grid-cols-3 gap-2.5">
                <div className="rounded-[11px] border border-white/[0.18] bg-white/10 px-3 py-2.5">
                  <div className="text-[11px] font-semibold opacity-80">
                    {t.ringkasan.totalAssetsLabel}
                  </div>
                  <div className="mono mt-0.5 text-[14px] font-extrabold">
                    {isLoading ? "…" : moneyCompact(assetsTotal)}
                  </div>
                </div>
                <div className="rounded-[11px] border border-white/[0.18] bg-white/10 px-3 py-2.5">
                  <div className="text-[11px] font-semibold opacity-80">
                    {t.ringkasan.totalLiabilitiesLabel}
                  </div>
                  <div className="mono mt-0.5 text-[14px] font-extrabold">
                    {isLoading ? "…" : moneyCompact(totalLiabilities)}
                  </div>
                </div>
                <div className="rounded-[11px] border border-white/[0.18] bg-white/10 px-3 py-2.5">
                  <div className="text-[11px] font-semibold opacity-80">
                    {t.beranda.cashflowThisMonth}
                  </div>
                  <div className="mono mt-0.5 text-[14px] font-extrabold">
                    {isLoading ? "…" : moneyCompact(currentMonth?.net ?? 0)}
                  </div>
                </div>
              </div>
            </HeroCard>
          </Rise>

          {/* EPIC-025 N3-G1 — "Komposisi Kekayaan" snapshot card
              (`.bento-snapshot`). Liquid vs non-liquid split, derived from
              the already-fetched `summary.accountSummary` — no new
              endpoint. */}
          <Rise index={1} className="lg:col-span-5">
            <SectionCard
              title={t.beranda.wealthComposition}
              action={
                <CardLink onClick={() => router.push("/ringkasan")}>
                  {t.common.viewDetail}
                </CardLink>
              }
            >
              {isLoading ? (
                <div className="flex h-[105px] items-center justify-center text-[13px] text-muted-foreground">
                  {t.common.loading}
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3 rounded-xl bg-secondary p-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-card text-primary">
                      <ArrowLeftRight className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11.5px] font-bold text-muted-foreground">
                        {t.beranda.liquidAssets} · {liquidPct}%
                      </div>
                      <div className="mono mt-px text-[16px] font-extrabold tracking-tight">
                        {moneyCompact(liquidTotal)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-secondary p-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-card text-brand-purple">
                      <Landmark className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11.5px] font-bold text-muted-foreground">
                        {t.beranda.nonLiquidAssets} · {nonLiquidPct}%
                      </div>
                      <div className="mono mt-px text-[16px] font-extrabold tracking-tight">
                        {moneyCompact(nonLiquidTotal)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </SectionCard>
          </Rise>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:col-span-2 lg:col-span-12 lg:grid-cols-3 xl:grid-cols-5">
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

        {/* Row 3 — Cashflow (`.bento-chart`, 7) + Allocation (`.bento-allocation`, 5) */}
        <div className="grid grid-cols-1 gap-3.5 md:col-span-2 md:grid-cols-2 lg:contents">
          {/* Cashflow */}
          <SectionCard
            title={t.common.cashFlow}
            className="lg:col-span-7"
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
            {/* EPIC-025 N3-G1 — BarChart → CashflowChart (Apex). Same
                `cashflow.months/income/expense` series as before the swap. */}
            {cashflow && (
              <CashflowChart
                months={cashflow.months}
                income={cashflow.income}
                expense={cashflow.expense}
                height={90}
                ariaLabel={cashflowAriaLabel}
              />
            )}
          </SectionCard>

          {/* Allocation (`.bento-allocation`) — DonutChart, replacing the
              old Donut+DonutLegend combo below the summary cards. */}
          <SectionCard
            title={t.beranda.wealthBreakdown}
            className="lg:col-span-5"
            action={
              <CardLink onClick={() => router.push("/aset")}>
                {t.common.viewDetail}
              </CardLink>
            }
          >
            {isLoading ? (
              <div className="flex h-[220px] items-center justify-center text-[13px] text-muted-foreground">
                {t.common.loading}
              </div>
            ) : allocation.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center text-[13px] text-muted-foreground">
                {t.common.noData}
              </div>
            ) : (
              <div className="space-y-3">
                <DonutChart
                  segments={donutSegments}
                  centerLabel={t.common.total}
                  height={200}
                  ariaLabel={donutAriaLabel}
                />
                <div className="space-y-1.5">
                  {allocation.map((seg) => (
                    <div
                      key={seg.label}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: seg.color }}
                      />
                      <span className="flex-1 text-muted-foreground">
                        {seg.label}
                      </span>
                      <span className="font-bold">{seg.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Recent activity (`.bento-transactions`, 7) */}
        <div className="lg:col-span-7">
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
                        className={`text-[13px] font-bold ${
                          a.isTransfer
                            ? "text-muted-foreground"
                            : a.inc
                              ? "text-success"
                              : "text-destructive"
                        }`}
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
        </div>

        {/* "Perlu Perhatian" (`.bento-side` 2nd article) — lg:col-span-5,
            paired next to Recent activity's lg:col-span-7 like the
            prototype's aside column. */}
        <div className="lg:col-span-5">
          <SectionCard title={t.beranda.needsAttentionTitle}>
            {isLoading ? (
              <div className="space-y-2">
                {Array(2)
                  .fill(null)
                  .map((_, i) => (
                    <div
                      key={i}
                      className="h-[42px] animate-pulse rounded-md bg-muted"
                    />
                  ))}
              </div>
            ) : pendingApprovalsCount === 0 && !nearestDueLiability ? (
              <div className="py-4 text-center text-[13px] text-muted-foreground">
                {t.beranda.noNotices}
              </div>
            ) : (
              <div className="space-y-2">
                {pendingApprovalsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => router.push("/persetujuan")}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] border border-warning/30 bg-warning-soft px-3 py-2.5 text-left text-[12.5px]"
                  >
                    <span className="text-[15px]">✅</span>
                    <span>
                      <strong>{pendingApprovalsCount}</strong>{" "}
                      {t.beranda.pendingApprovalsNotice}
                    </span>
                  </button>
                )}
                {nearestDueLiability && (
                  <button
                    type="button"
                    onClick={() => router.push("/liabilitas")}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] border bg-accent px-3 py-2.5 text-left text-[12.5px]"
                  >
                    <span className="text-[15px]">📅</span>
                    <span>
                      <strong>{nearestDueLiability.name}</strong>{" "}
                      {t.beranda.liabilityDueNotice}{" "}
                      {new Date(
                        nearestDueLiability.dueDate!,
                      ).toLocaleDateString(t.beranda.dateLocale, {
                        day: "numeric",
                        month: "short",
                      })}
                      .
                    </span>
                  </button>
                )}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Goals (`.bento-goals`, full width) */}
        <div className="lg:col-span-12">
          <SectionCard
            title={t.beranda.financialGoals}
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
        <div className="flex items-center gap-3.5 rounded-[14px] bg-accent p-4 md:col-span-2 lg:col-span-12">
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
