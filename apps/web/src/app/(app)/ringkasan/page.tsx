"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Eye, EyeOff } from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  SectionCard,
  StatusBadge,
  ProgressBar,
  CardLink,
} from "@/components/wm";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { formatRupiah, formatRupiahCompact } from "@/lib/format";
import { useCurrencyPreference } from "@/hooks/use-currency-preference";
import { useLocale } from "@/hooks/use-locale";
import { ConsolidatedTotalCard } from "@/components/consolidated-total-card";
// EPIC-025 N3-C2 — ringkasan is the ApexCharts go/no-go gate: the first page
// wired to the N3-A presets. All 4 series below are derived from data this
// page (or `beranda`) already fetches — no new backend endpoint.
import {
  CashflowChart,
  DonutChart,
  HBarChart,
  RadialChart,
  TrendChart,
} from "@/components/charts/apex-presets";
import type { DonutSegment } from "@/components/charts/donut";
import type {
  DashboardSummaryDto,
  LiabilityDto,
  NetWorthDto,
  NetWorthHistoryDto,
  NetWorthHistoryPointDto,
  ReportSummaryDto,
} from "@wealthme/contracts";

const COMPOSITION_COLOR: Record<string, string> = {
  bank: "var(--brand-cyan)",
  ewallet: "var(--success)",
  investment: "var(--primary)",
  property: "var(--warning)",
  cash: "var(--muted-foreground)",
};

// ── Privacy ("Sembunyikan nominal") toggle ──────────────────────────────────
// Page-local port of the same pattern already shipped on `aset/page.tsx`
// (D1/US-ASSET-5): per-user localStorage, namespaced the same way as
// device-storage.ts (`wm.<feature>.<userId>`) so one user's preference never
// bleeds into another's on a shared device. Kept page-local because
// `components/wm/*` is a protected foundation directory.
const RINGKASAN_PRIVACY_STORAGE_PREFIX = "wm.ringkasan-privacy.";

function readStoredPrivacy(userId: string): boolean {
  try {
    return (
      window.localStorage.getItem(
        `${RINGKASAN_PRIVACY_STORAGE_PREFIX}${userId}`,
      ) === "1"
    );
  } catch {
    // storage may be unavailable (private browsing, SSR)
    return false;
  }
}

function writeStoredPrivacy(userId: string, isOn: boolean): void {
  try {
    window.localStorage.setItem(
      `${RINGKASAN_PRIVACY_STORAGE_PREFIX}${userId}`,
      isOn ? "1" : "0",
    );
  } catch {
    // storage may be unavailable — the toggle still works for this session
  }
}

// ── Trend range segmented control ("6 Bln / 12 Bln / Semua") ───────────────
// Mirrors `beranda/page.tsx`'s PERIOD_RANGE mapping onto the same
// `/dashboard/net-worth/history` endpoint — no new backend work.
type TrendRangeKey = "6m" | "12m" | "all";
const TREND_RANGE_PARAM: Record<TrendRangeKey, string> = {
  "6m": "6m",
  "12m": "12m",
  all: "120m",
};

// ── Root cause of the x-axis label bug ──────────────────────────────────────
// The history endpoint returns one snapshot PER DAY the scheduler ran
// (`dashboard.service.ts#getNetWorthHistory`), not one per month. Mapping
// every raw point straight to a chart category produced a category per
// snapshot day — many of which fall in the same calendar month — so the
// x-axis rendered the same "MMM YY" label repeated for every day inside
// that month. Fix: bucket the ascending, already-sorted points by calendar
// month and keep the LAST (most recent / "closing") snapshot per month, so
// each category label is unique.
function groupHistoryPointsByMonth(
  points: NetWorthHistoryPointDto[],
): NetWorthHistoryPointDto[] {
  const lastByMonth = new Map<string, NetWorthHistoryPointDto>();
  const monthOrder: string[] = [];
  for (const point of points) {
    const captured = new Date(point.capturedAt);
    const monthKey = `${captured.getFullYear()}-${captured.getMonth()}`;
    if (!lastByMonth.has(monthKey)) monthOrder.push(monthKey);
    lastByMonth.set(monthKey, point);
  }
  return monthOrder.map((key) => lastByMonth.get(key)!);
}

// Minimum days of history required before an "N% YoY" figure is honest —
// under this span the badge is omitted instead of extrapolated (Honest UI).
const YOY_MIN_SPAN_DAYS = 330;

function formatPercent1(value: number, dateLocale: string): string {
  return value.toLocaleString(dateLocale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export default function RingkasanPage() {
  const router = useRouter();
  const { t } = useLocale();
  const { data: session } = useSession();
  const familyGroupId = session?.familyGroupId ?? null;
  const userId = session?.userId;
  const { currency, formatMoney, isIndicative, isReady } =
    useCurrencyPreference();
  // Never show a fabricated 1:1-rate conversion — while a non-IDR FX rate is
  // still loading (or failed), route every monetary display through the
  // loading placeholder instead of a wrong-magnitude number under a foreign
  // currency symbol. Compact IDR formatting has no non-IDR equivalent in
  // formatMoney, so non-IDR falls back to the full (non-compact) converted
  // amount, prefixed to flag it as an approximation from the mock FX rates
  // service — never an authoritative/live conversion.
  const money = (value: number) =>
    !isReady
      ? "..."
      : isIndicative
        ? `≈ ${formatMoney(value)}`
        : formatRupiahCompact(value);
  // Same idea, but for the (non-compact) full-precision displays below.
  const moneyFull = (value: number) =>
    !isReady
      ? "..."
      : isIndicative
        ? `≈ ${formatMoney(value)}`
        : formatRupiah(value);

  // D1/US-ASSET-5-style privacy eye toggle, ported page-locally for
  // ringkasan (prototype's "Sembunyikan nominal" button).
  const [privacyOn, setPrivacyOn] = useState(false);
  useEffect(() => {
    if (!userId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrivacyOn(readStoredPrivacy(userId));
  }, [userId]);
  function togglePrivacy(): void {
    const next = !privacyOn;
    setPrivacyOn(next);
    if (userId) writeStoredPrivacy(userId, next);
  }

  const [trendRange, setTrendRange] = useState<TrendRangeKey>("12m");
  const trendRanges: { key: TrendRangeKey; label: string }[] = [
    { key: "6m", label: t.ringkasan.trendRangeLabel6m },
    { key: "12m", label: t.ringkasan.trendRangeLabel12m },
    { key: "all", label: t.ringkasan.trendRangeLabelAll },
  ];
  const trendTitleByRange: Record<TrendRangeKey, string> = {
    "6m": t.ringkasan.netWorthTrendTitle,
    "12m": t.ringkasan.netWorthTrendTitle12m,
    all: t.ringkasan.netWorthTrendTitleAll,
  };

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

  const { data: netWorthData, isLoading: isNetWorthLoading } =
    useQuery<NetWorthDto>({
      queryKey: queryKeys.netWorth.summary(familyGroupId ?? ""),
      queryFn: () =>
        apiFetch<NetWorthDto>(
          `/family-groups/${familyGroupId}/dashboard/net-worth`,
          { token: session?.accessToken },
        ),
      enabled: Boolean(familyGroupId) && Boolean(session?.accessToken),
      staleTime: 60_000,
    });

  // Family group name for the page header subtitle ("<Family> · per <date>").
  // `/family-groups/mine` already exists and is already used by
  // `akun/page.tsx` — no new endpoint.
  const { data: familyGroups } = useQuery<{ id: string; name: string }[]>({
    queryKey: queryKeys.familyGroups.mine(),
    queryFn: () =>
      apiFetch<{ id: string; name: string }[]>("/family-groups/mine", {
        token: session?.accessToken,
      }),
    enabled: Boolean(session?.accessToken),
    staleTime: 60_000,
  });
  const familyName =
    familyGroups?.find((g) => g.id === familyGroupId)?.name ??
    familyGroups?.[0]?.name ??
    t.ringkasan.pageHeaderFamilyFallback;
  const todayLabel = new Date().toLocaleDateString(t.beranda.dateLocale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const netWorth = summary?.netWorth ?? 0;
  // EPIC-022 B5 — use the API's own net-worth rollup (accounts + investments
  // + other assets) so this card reconciles with the net-worth figure beside
  // it. The previous computation re-derived "Total Aset" from
  // `accountSummary` filtered to positive balances only — it silently
  // dropped overdrawn accounts and excluded investments/other assets that
  // ARE part of net worth.
  const accountsTotal = Number(netWorthData?.accountsTotal ?? 0);
  const investmentsTotal = Number(netWorthData?.investmentsTotal ?? 0);
  const physicalAssetsTotal = Number(netWorthData?.assetsTotal ?? 0);
  const totalAssets = accountsTotal + investmentsTotal + physicalAssetsTotal;
  const savingsRate = summary?.currentMonth.savingsRate ?? 0;
  const monthIncome = summary?.currentMonth.income ?? 0;
  const monthExpense = summary?.currentMonth.expense ?? 0;
  const monthNet = summary?.currentMonth.net ?? 0;

  // liabilitiesTotal is a serialized decimal string; Number() tolerates
  // decimals/empties (BigInt would throw), and the value is display-only.
  const totalLiabilities = Number(netWorthData?.liabilitiesTotal ?? 0);

  const { data: reportSummary } = useQuery<ReportSummaryDto>({
    queryKey: queryKeys.reports.summary(familyGroupId ?? "", 1),
    queryFn: () =>
      apiFetch<ReportSummaryDto>(
        `/family-groups/${familyGroupId}/reports/summary?months=1`,
        { token: session?.accessToken },
      ),
    enabled: Boolean(familyGroupId) && Boolean(session?.accessToken),
    staleTime: 60_000,
  });

  const topExpenses = reportSummary?.topExpenseCategories ?? [];
  // EPIC-026 Wave 3 — prototype's `#c-topexp` mount is an hbar chart
  // (`WMCharts.hbar`, destructive color), not a list; same
  // `topExpenseCategories` data this page already fetches.
  const topExpenseSlice = topExpenses.slice(0, 5);
  const topExpenseCategories = topExpenseSlice.map((e) => e.categoryName);
  const topExpenseData = topExpenseSlice.map((e) => e.amount);

  // "Tren Kekayaan Bersih" — plots the real net-worth history endpoint
  // (already used by /beranda), instead of a cumulative running sum of
  // income − expense from zero, which is cumulative cashflow, not net
  // worth. The range is now driven by the "6 Bln / 12 Bln / Semua"
  // segmented control instead of a fixed 6-month window.
  const { data: netWorthHistory, isLoading: isNetWorthHistoryLoading } =
    useQuery<NetWorthHistoryDto>({
      queryKey: [
        "dashboard",
        familyGroupId ?? "",
        "net-worth-history",
        TREND_RANGE_PARAM[trendRange],
      ],
      queryFn: () =>
        apiFetch<NetWorthHistoryDto>(
          `/family-groups/${familyGroupId}/dashboard/net-worth/history?range=${TREND_RANGE_PARAM[trendRange]}`,
          { token: session?.accessToken },
        ),
      enabled: Boolean(familyGroupId) && Boolean(session?.accessToken),
      staleTime: 60_000,
    });
  const netWorthHistoryPoints = netWorthHistory?.points ?? [];
  // Bucketed to one (closing) point per calendar month — see
  // `groupHistoryPointsByMonth`'s header comment for why the raw points
  // produced repeated x-axis labels.
  const groupedHistoryPoints = groupHistoryPointsByMonth(netWorthHistoryPoints);
  const netWorthTrendValues = groupedHistoryPoints.map((p) =>
    Number(p.netWorth),
  );
  const netWorthTrendCategories = groupedHistoryPoints.map((p) =>
    new Date(p.capturedAt).toLocaleDateString(t.beranda.dateLocale, {
      month: "short",
      year: "2-digit",
    }),
  );
  const netWorthTrendSeries = [
    { name: t.ringkasan.totalNetWorthLabel, data: netWorthTrendValues },
  ];
  const netWorthTrendAriaLabel =
    netWorthTrendValues.length >= 2
      ? `${trendTitleByRange[trendRange]}: ${moneyFull(netWorthTrendValues[0]!)} ${t.ringkasan.netWorthTrendRangeStart} → ${moneyFull(netWorthTrendValues[netWorthTrendValues.length - 1]!)} ${t.ringkasan.netWorthTrendRangeEnd}`
      : trendTitleByRange[trendRange];

  // "↑ N% YoY" badge — computed honestly from the same series already
  // plotted. Only rendered when the fetched history actually spans close to
  // a year; otherwise a shorter-range selection (e.g. "6 Bln") would
  // silently produce a misleading "YoY" number.
  const firstHistoryPoint = groupedHistoryPoints[0];
  const lastHistoryPoint =
    groupedHistoryPoints[groupedHistoryPoints.length - 1];
  let yoyPct: number | null = null;
  if (
    firstHistoryPoint &&
    lastHistoryPoint &&
    firstHistoryPoint !== lastHistoryPoint
  ) {
    const spanDays =
      (new Date(lastHistoryPoint.capturedAt).getTime() -
        new Date(firstHistoryPoint.capturedAt).getTime()) /
      86_400_000;
    const firstNetWorth = Number(firstHistoryPoint.netWorth);
    if (spanDays >= YOY_MIN_SPAN_DAYS && firstNetWorth !== 0) {
      yoyPct =
        ((Number(lastHistoryPoint.netWorth) - firstNetWorth) /
          Math.abs(firstNetWorth)) *
        100;
    }
  }

  const composition = (summary?.allocation ?? []).map((item) => ({
    label: item.label,
    value: `${money(item.amount)} · ${item.value}%`,
    pct: item.value,
    color:
      COMPOSITION_COLOR[
        (summary?.accountSummary ?? []).find((s) => s.label === item.label)
          ?.type ?? ""
      ] ?? item.color,
  }));

  // EPIC-025 N3-C2 — DonutChart mount, reusing the existing `DonutSegment[]`
  // shape (never redefined) over the same allocation data `composition`
  // above already derives.
  const donutSegments: DonutSegment[] = (summary?.allocation ?? []).map(
    (item) => ({
      label: item.label,
      value: item.amount,
      color:
        COMPOSITION_COLOR[
          (summary?.accountSummary ?? []).find((s) => s.label === item.label)
            ?.type ?? ""
        ] ?? item.color,
    }),
  );
  const donutAriaLabel =
    composition.length > 0
      ? `${t.ringkasan.compositionTitle}: ${composition.map((c) => `${c.label} ${c.pct}%`).join(", ")}`
      : t.ringkasan.compositionTitle;

  // EPIC-025 N3-C2 — CashflowChart mount, over `summary.cashflow` (the same
  // months/income/expense arrays `beranda`'s existing BarChart already
  // sums — no new endpoint).
  const cashflowMonths = summary?.cashflow.months ?? [];
  const cashflowIncome = summary?.cashflow.income ?? [];
  const cashflowExpense = summary?.cashflow.expense ?? [];
  const cashflowAriaLabel =
    cashflowMonths.length > 0
      ? `${t.ringkasan.cashFlowTitlePrefix}${cashflowMonths.at(-1) ?? ""}: ${t.ringkasan.incomeLabel} ${moneyFull(monthIncome)}, ${t.ringkasan.expenseLabel} ${moneyFull(monthExpense)}`
      : t.ringkasan.cashFlowTitlePrefix;

  // EPIC-025 N3-C2 — HBarChart mount for the liability breakdown, over the
  // same `/liabilities` list the `/liabilitas` page already fetches — no
  // new endpoint.
  const { data: liabilities, isLoading: isLiabilitiesLoading } = useQuery<
    LiabilityDto[]
  >({
    queryKey: queryKeys.liabilities.all(familyGroupId ?? ""),
    queryFn: () =>
      apiFetch<LiabilityDto[]>(`/family-groups/${familyGroupId}/liabilities`, {
        token: session?.accessToken,
      }),
    enabled: Boolean(familyGroupId) && Boolean(session?.accessToken),
    staleTime: 60_000,
  });
  const allLiabilities = (liabilities ?? [])
    .slice()
    .sort((a, b) => Number(b.remainingBalance) - Number(a.remainingBalance));
  const liabilityBreakdown = allLiabilities.slice(0, 6);
  const liabilityCategories = liabilityBreakdown.map((l) => l.name);
  const liabilityData = liabilityBreakdown.map((l) =>
    Number(l.remainingBalance),
  );
  const liabilityAriaLabel =
    liabilityBreakdown.length > 0
      ? `${t.ringkasan.liabilityBreakdownTitle}: ${liabilityBreakdown.map((l) => `${l.name} ${moneyFull(Number(l.remainingBalance))}`).join(", ")}`
      : t.ringkasan.liabilityBreakdownTitle;

  // "Rincian Aset vs Liabilitas" table — grouped by type, from data already
  // fetched on this page (`netWorthData`'s rollups + `summary.accountSummary`
  // for the bank/cash split + the full `liabilities` list above). No new
  // endpoint, and every row reconciles with the stat cards above (same
  // `totalAssets`/`totalLiabilities` figures).
  const accountSummaryList = summary?.accountSummary ?? [];
  const bankAmount = accountSummaryList
    .filter((a) => a.type === "bank")
    .reduce((sum, a) => sum + a.total, 0);
  const cashAmount = accountSummaryList
    .filter((a) => a.type === "cash" || a.type === "ewallet")
    .reduce((sum, a) => sum + a.total, 0);
  const assetBreakdownRows = [
    {
      key: "physical",
      label: t.ringkasan.breakdownAssetPhysicalLabel,
      badgeLabel: t.ringkasan.breakdownBadgeAssetFisik,
      badgeVariant: "success" as const,
      amount: physicalAssetsTotal,
    },
    {
      key: "investment",
      label: t.ringkasan.breakdownAssetInvestmentLabel,
      badgeLabel: t.ringkasan.breakdownBadgeInvestasi,
      badgeVariant: "info" as const,
      amount: investmentsTotal,
    },
    {
      key: "bank",
      label: t.ringkasan.breakdownAssetBankLabel,
      badgeLabel: t.ringkasan.breakdownBadgeBank,
      badgeVariant: "info" as const,
      amount: bankAmount,
    },
    {
      key: "cash",
      label: t.ringkasan.breakdownAssetCashLabel,
      badgeLabel: t.ringkasan.breakdownBadgeKas,
      badgeVariant: "success" as const,
      amount: cashAmount,
    },
  ].filter((row) => row.amount > 0);

  const debtRatio =
    totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : null;

  if (isError) {
    return (
      <div className="flex items-center justify-center py-16 text-[13px] text-muted-foreground">
        {t.ringkasan.errorLoad}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "space-y-3.5",
        privacyOn && "[&_.wm-money]:blur-sm [&_.wm-money]:select-none",
      )}
    >
      {/* Page lead — H1 + subtitle + range control + privacy toggle */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-[220px] flex-1">
          <h1 className="text-[17px] font-extrabold tracking-tight">
            {t.ringkasan.pageHeaderTitle}
          </h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {familyName}
            {t.ringkasan.pageHeaderSubtitleConnector}
            {todayLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label={t.ringkasan.trendRangeGroupAriaLabel}
            className="inline-flex gap-0.5 rounded-[10px] bg-secondary p-[3px]"
          >
            {trendRanges.map((range) => (
              <button
                key={range.key}
                type="button"
                role="tab"
                aria-selected={trendRange === range.key}
                onClick={() => setTrendRange(range.key)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-muted-foreground",
                  trendRange === range.key &&
                    "bg-card text-foreground shadow-sm",
                )}
              >
                {range.label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={privacyOn}
            aria-label={
              privacyOn
                ? t.ringkasan.showAmountsAriaLabel
                : t.ringkasan.hideAmountsAriaLabel
            }
            onClick={togglePrivacy}
          >
            {/* EPIC-026 Wave 3 — prototype's privacy button carries an
                eye-off/eye icon next to its label. */}
            {privacyOn ? (
              <Eye className="size-3.5" />
            ) : (
              <EyeOff className="size-3.5" />
            )}
            {privacyOn
              ? t.ringkasan.showAmountsButton
              : t.ringkasan.hideAmountsButton}
          </Button>
        </div>
      </div>

      {/* Top stat cards — EPIC-026 Wave 3: prototype's bento-grid spans
          (hero span-5, stat span-2/2/3 of 12) instead of 4 equal columns;
          md 2-col fallback per the translation table's bento rule. */}
      <div className="mb-[18px] grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-12">
        <Card className="gap-0 border-none gradient-wealth p-5 text-white md:col-span-2 lg:col-span-5">
          <div className="mb-1.5 text-[11px] opacity-80">
            {t.ringkasan.totalNetWorthLabel}
          </div>
          <div className="wm-money text-[20px] font-black">
            {isLoading ? "..." : money(netWorth)}
          </div>
          <div className="wm-money mt-1 text-[11px] text-emerald-300">
            {isLoading
              ? "..."
              : monthNet >= 0
                ? `${t.ringkasan.monthDeltaUpPrefix}${money(monthNet)}${t.ringkasan.monthDeltaSuffix}`
                : `${t.ringkasan.monthDeltaDownPrefix}${money(Math.abs(monthNet))}${t.ringkasan.monthDeltaSuffix}`}
          </div>
        </Card>
        <Card className="gap-0 p-5 lg:col-span-2">
          <div className="mb-1.5 text-[11px] text-muted-foreground">
            {t.ringkasan.totalAssetsLabel}
          </div>
          <div className="wm-money text-[20px] font-black text-success">
            {isLoading || isNetWorthLoading ? "..." : money(totalAssets)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {summary?.accountSummary.length
              ? `${summary.accountSummary.length}${t.ringkasan.accountTypesSuffix}`
              : t.ringkasan.noDataDash}
          </div>
        </Card>
        <Card className="gap-0 p-5 lg:col-span-2">
          <div className="mb-1.5 text-[11px] text-muted-foreground">
            {t.ringkasan.totalLiabilitiesLabel}
          </div>
          <div className="wm-money text-[20px] font-black text-muted-foreground">
            {isLoading || isNetWorthLoading ? "..." : money(totalLiabilities)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {t.ringkasan.liabilitiesSublabel}
          </div>
        </Card>
        <Card className="gap-0 p-5 md:col-span-2 lg:col-span-3">
          <div className="mb-1.5 text-[11px] text-muted-foreground">
            {t.ringkasan.savingsRateLabel}
          </div>
          <div className="text-[20px] font-black text-primary">
            {isLoading ? "..." : `${savingsRate}%`}
          </div>
          <div className="wm-money text-[11px] text-success">
            {monthExpense > 0
              ? `${t.ringkasan.expenseValuePrefix}${money(monthExpense)}`
              : t.ringkasan.noDataDash}
          </div>
        </Card>
      </div>
      {isIndicative && (
        <div className="-mt-2.5 mb-1.5 text-[11px] text-muted-foreground">
          {t.ringkasan.indicativeFxNotePrefix}
          {currency}
          {t.ringkasan.indicativeFxNoteSuffix}
        </div>
      )}

      {/* EPIC-021 Group F (#6) — consolidated total shown simultaneously in
          IDR + USD + gram-emas (Open Design Decision #6). */}
      <ConsolidatedTotalCard netWorthIdr={netWorth} isLoading={isLoading} />

      {/*
        Wide-viewport main+aside reflow (EPIC-018 Task C). Below `lg` this
        wrapper is a plain `space-y-3.5` stack — the blocks below render in
        exactly today's order/spacing, untouched. At `lg`+ it becomes a
        3-col grid (main = col 1-2 / ~2/3, aside = col 3 / ~1/3); the two
        "row" wrapper divs below switch to `display: contents` at `lg` so
        their children become direct grid items — DOM order stays identical,
        only visual placement changes. The net-worth trend chart and the
        cash flow breakdown stay wide in the main column; the composition,
        top-expenses, and health-score lists move into the narrower aside
        alongside them.
      */}
      <div className="space-y-3.5 lg:grid lg:grid-cols-3 lg:items-start lg:gap-3.5 lg:space-y-0">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:contents">
          <SectionCard
            title={
              <div className="flex flex-wrap items-center gap-2">
                <span>{trendTitleByRange[trendRange]}</span>
                {yoyPct !== null && (
                  <StatusBadge variant={yoyPct >= 0 ? "success" : "danger"}>
                    {yoyPct >= 0
                      ? t.ringkasan.yoyUpPrefix
                      : t.ringkasan.yoyDownPrefix}
                    {formatPercent1(Math.abs(yoyPct), t.beranda.dateLocale)}
                    {t.ringkasan.yoySuffix}
                  </StatusBadge>
                )}
              </div>
            }
            className="lg:col-start-1 lg:col-end-3 lg:row-start-1"
          >
            {/* EPIC-025 N3-C2 — ApexCharts go/no-go gate: first real chart
                mount, replacing the hand-rolled SVG path. */}
            {isNetWorthHistoryLoading ? (
              <div className="h-[250px] animate-pulse rounded-md bg-muted" />
            ) : netWorthTrendValues.length < 2 ? (
              <div className="flex h-[250px] items-center justify-center text-[12px] text-muted-foreground">
                {t.ringkasan.emptyNetWorthTrend}
              </div>
            ) : (
              <div className="wm-money">
                <TrendChart
                  categories={netWorthTrendCategories}
                  series={netWorthTrendSeries}
                  ariaLabel={netWorthTrendAriaLabel}
                />
              </div>
            )}
            {netWorthTrendValues.length >= 2 && (
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>{t.ringkasan.netWorthTrendRangeStart}</span>
                <span>{t.ringkasan.netWorthTrendRangeEnd}</span>
              </div>
            )}
          </SectionCard>

          {/* Asset composition — donut + single labelled bar list (the
              donut's own built-in ApexCharts legend is hidden below so it
              doesn't duplicate this list). */}
          <SectionCard
            title={t.ringkasan.compositionTitle}
            className="lg:col-start-3 lg:row-start-1"
            action={
              /* EPIC-026 Wave 3 — prototype's "Detail" action → aset.html. */
              <CardLink onClick={() => router.push("/aset")}>
                {t.common.viewDetail}
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
                      className="h-[32px] animate-pulse rounded-md bg-muted"
                    />
                  ))}
              </div>
            ) : composition.length === 0 ? (
              <div className="py-4 text-center text-[13px] text-muted-foreground">
                {t.ringkasan.emptyComposition}
              </div>
            ) : (
              <div className="space-y-3">
                {/* EPIC-025 N3-C2 — DonutChart mount, same allocation data
                    the list below already sums. `apexcharts-legend` is
                    hidden here — the list below is the ONE legend for this
                    card (previously duplicated: the donut's default legend
                    + this list). */}
                <div className="wm-money [&_.apexcharts-legend]:hidden">
                  <DonutChart
                    segments={donutSegments}
                    centerLabel={t.ringkasan.totalAssetsLabel}
                    height={220}
                    ariaLabel={donutAriaLabel}
                  />
                </div>
                {composition.map((c) => (
                  <div key={c.label}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
                      <span className="flex items-center gap-1.5 font-semibold truncate">
                        <span
                          className="inline-block size-2 shrink-0 rounded-full"
                          style={{ background: c.color }}
                        />
                        {c.label}
                      </span>
                      <span className="wm-money shrink-0 text-muted-foreground">
                        {c.value}
                      </span>
                    </div>
                    <ProgressBar value={c.pct} color={c.color} height={6} />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* "Rincian Aset vs Liabilitas" — asset-type rows (reconciling with
          the stat cards above), a Total Aset subtotal, each liability,
          a Total Liabilitas subtotal, then Kekayaan Bersih. Every figure is
          derived from `netWorthData`/`summary`/`liabilities`, already
          fetched above — no new endpoint. */}
      <SectionCard title={t.ringkasan.breakdownTableTitle}>
        {isLoading || isNetWorthLoading || isLiabilitiesLoading ? (
          <div className="h-[220px] animate-pulse rounded-md bg-muted" />
        ) : assetBreakdownRows.length === 0 && allLiabilities.length === 0 ? (
          <div className="py-4 text-center text-[13px] text-muted-foreground">
            {t.ringkasan.breakdownEmpty}
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="min-w-[640px] w-full text-[12.5px]">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-semibold">
                    {t.ringkasan.breakdownColPos}
                  </th>
                  <th className="py-2 font-semibold">
                    {t.ringkasan.breakdownColJenis}
                  </th>
                  <th className="py-2 text-right font-semibold">
                    {t.ringkasan.breakdownColPorsi}
                  </th>
                  <th className="py-2 text-right font-semibold">
                    {t.ringkasan.breakdownColNilai}
                  </th>
                </tr>
              </thead>
              <tbody>
                {assetBreakdownRows.map((row) => (
                  <tr key={row.key} className="border-b last:border-0">
                    <td className="py-2.5 font-bold">{row.label}</td>
                    <td className="py-2.5">
                      <StatusBadge variant={row.badgeVariant}>
                        {row.badgeLabel}
                      </StatusBadge>
                    </td>
                    <td className="mono py-2.5 text-right text-muted-foreground">
                      {totalAssets > 0
                        ? `${formatPercent1((row.amount / totalAssets) * 100, t.beranda.dateLocale)}%`
                        : t.ringkasan.noDataDash}
                    </td>
                    <td className="wm-money mono py-2.5 text-right font-bold text-success">
                      {moneyFull(row.amount)}
                    </td>
                  </tr>
                ))}
                {assetBreakdownRows.length > 0 && (
                  <tr className="border-b bg-secondary/40 last:border-0">
                    <td className="py-2.5 font-bold">
                      {t.ringkasan.breakdownTotalAssetsRow}
                    </td>
                    <td className="py-2.5" />
                    <td className="mono py-2.5 text-right text-muted-foreground">
                      100%
                    </td>
                    <td className="wm-money mono py-2.5 text-right font-extrabold text-success">
                      {moneyFull(totalAssets)}
                    </td>
                  </tr>
                )}

                {allLiabilities.map((liability) => (
                  <tr key={liability.id} className="border-b last:border-0">
                    <td className="py-2.5 font-bold">{liability.name}</td>
                    <td className="py-2.5">
                      <StatusBadge variant="danger">
                        {t.ringkasan.breakdownBadgeLiabilitas}
                      </StatusBadge>
                    </td>
                    <td className="mono py-2.5 text-right text-muted-foreground">
                      {totalLiabilities > 0
                        ? `${formatPercent1((Number(liability.remainingBalance) / totalLiabilities) * 100, t.beranda.dateLocale)}%`
                        : t.ringkasan.noDataDash}
                    </td>
                    <td className="wm-money mono py-2.5 text-right font-bold text-destructive">
                      {moneyFull(Number(liability.remainingBalance))}
                    </td>
                  </tr>
                ))}
                {allLiabilities.length > 0 && (
                  <tr className="border-b bg-secondary/40 last:border-0">
                    <td className="py-2.5 font-bold">
                      {t.ringkasan.breakdownTotalLiabilitiesRow}
                    </td>
                    <td className="py-2.5" />
                    <td className="mono py-2.5 text-right text-muted-foreground">
                      100%
                    </td>
                    <td className="wm-money mono py-2.5 text-right font-extrabold text-destructive">
                      {moneyFull(totalLiabilities)}
                    </td>
                  </tr>
                )}

                <tr>
                  <td className="py-2.5 font-extrabold">
                    {t.ringkasan.breakdownNetWorthRow}
                  </td>
                  <td
                    colSpan={2}
                    className="py-2.5 text-[11.5px] text-muted-foreground"
                  >
                    {t.ringkasan.breakdownNetWorthFormula}
                  </td>
                  <td className="wm-money mono py-2.5 text-right text-[15px] font-extrabold text-primary">
                    {moneyFull(totalAssets - totalLiabilities)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="space-y-3.5 lg:grid lg:grid-cols-3 lg:items-start lg:gap-3.5 lg:space-y-0">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3 lg:contents">
          {/* Cash Flow */}
          <SectionCard
            title={`${t.ringkasan.cashFlowTitlePrefix}${summary?.cashflow.months.at(-1) ?? ""}`}
            className="lg:col-start-1 lg:col-end-3 lg:row-start-2"
          >
            {/* EPIC-025 N3-C2 — CashflowChart mount, over the same
                `summary.cashflow` months/income/expense arrays already
                fetched for this page. */}
            {isLoading ? (
              <div className="mb-2.5 h-[220px] animate-pulse rounded-md bg-muted" />
            ) : cashflowMonths.length === 0 ? (
              <div className="mb-2.5 flex h-[100px] items-center justify-center text-[12px] text-muted-foreground">
                {t.ringkasan.emptyTopExpenses}
              </div>
            ) : (
              <div className="wm-money mb-2.5">
                <CashflowChart
                  months={cashflowMonths}
                  income={cashflowIncome}
                  expense={cashflowExpense}
                  height={220}
                  ariaLabel={cashflowAriaLabel}
                />
              </div>
            )}
            <div className="mb-2.5">
              <div className="text-[11px] text-muted-foreground">
                {t.ringkasan.incomeLabel}
              </div>
              <div className="wm-money text-[18px] font-extrabold text-success">
                {isLoading ? "..." : moneyFull(monthIncome)}
              </div>
            </div>
            <div className="mb-2.5">
              <div className="text-[11px] text-muted-foreground">
                {t.ringkasan.expenseLabel}
              </div>
              <div className="wm-money text-[18px] font-extrabold text-destructive">
                {isLoading ? "..." : moneyFull(monthExpense)}
              </div>
            </div>
            <div className="border-t pt-2.5">
              <div className="text-[11px] text-muted-foreground">
                {t.ringkasan.surplusLabel}
              </div>
              <div
                className={`wm-money text-[18px] font-extrabold ${monthNet >= 0 ? "text-success" : "text-destructive"}`}
              >
                {isLoading ? "..." : moneyFull(monthNet)}
              </div>
            </div>
          </SectionCard>

          {/* EPIC-026 Wave 3 — rebuilt to the prototype's `#c-topexp` hbar
              mount (was a hand-rolled list with fabricated rotating emoji
              icons — removed); "Laporan" action per the prototype. */}
          <SectionCard
            title={t.ringkasan.topExpensesTitle}
            className="lg:col-start-3 lg:row-start-2"
            action={
              <CardLink onClick={() => router.push("/laporan")}>
                {t.shell.pageTitles.laporan}
              </CardLink>
            }
          >
            {isLoading ? (
              <div className="h-[180px] animate-pulse rounded-md bg-muted" />
            ) : topExpenseSlice.length === 0 ? (
              <div className="py-4 text-center text-[13px] text-muted-foreground">
                {t.ringkasan.emptyTopExpenses}
              </div>
            ) : (
              <div className="wm-money">
                <HBarChart
                  categories={topExpenseCategories}
                  data={topExpenseData}
                  color="var(--destructive)"
                  ariaLabel={`${t.ringkasan.topExpensesTitle}: ${topExpenseSlice
                    .map((e) => `${e.categoryName} ${moneyFull(e.amount)}`)
                    .join(", ")}`}
                />
              </div>
            )}
          </SectionCard>

          {/* Health Score */}
          <SectionCard
            title={t.ringkasan.healthScoreTitle}
            className="lg:col-start-3 lg:row-start-3"
          >
            <div className="py-2.5 text-center">
              {/* EPIC-026 Wave 3 — prototype's `#c-health` mount is the
                  ApexCharts radial preset (`WMCharts.radial(…, 176)`), not
                  a hand-rolled SVG gauge. Same savingsRate-as-score data
                  as before the rebuild. "Skor" is the prototype's literal
                  center label (no existing i18n key). */}
              <RadialChart
                value={Math.max(0, Math.min(100, savingsRate))}
                label="Skor"
                height={176}
                ariaLabel={`${t.ringkasan.financialHealthScoreLabel}: ${savingsRate}`}
              />
              <div className="text-[11px] text-muted-foreground">
                {t.ringkasan.financialHealthScoreLabel}
              </div>
              <div className="mt-2">
                <StatusBadge
                  variant={
                    savingsRate >= 20
                      ? "success"
                      : savingsRate >= 10
                        ? "info"
                        : "danger"
                  }
                >
                  {savingsRate >= 20
                    ? t.ringkasan.healthStatusGood
                    : savingsRate >= 10
                      ? t.ringkasan.healthStatusFair
                      : t.ringkasan.healthStatusNeedsAttention}
                </StatusBadge>
              </div>
              {debtRatio !== null && (
                <div className="mt-3 flex items-start gap-2.5 rounded-[11px] border border-primary/25 bg-accent p-3 text-left text-[12.5px] text-accent-foreground">
                  <Sparkles className="size-[15px] shrink-0 translate-y-0.5" />
                  <span>
                    {t.ringkasan.healthDebtRatioNotePrefix}
                    <strong className="mono">
                      {formatPercent1(debtRatio, t.beranda.dateLocale)}%
                    </strong>
                    {debtRatio <= 40
                      ? t.ringkasan.healthDebtRatioNoteSuffixSafe
                      : t.ringkasan.healthDebtRatioNoteSuffixAttention}
                  </span>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* EPIC-025 N3-C2 — HBarChart mount for the liability breakdown, over
          the same `/liabilities` list `/liabilitas` already fetches. */}
      <SectionCard title={t.ringkasan.liabilityBreakdownTitle}>
        {isLiabilitiesLoading ? (
          <div className="h-[180px] animate-pulse rounded-md bg-muted" />
        ) : liabilityBreakdown.length === 0 ? (
          <div className="py-4 text-center text-[13px] text-muted-foreground">
            {t.ringkasan.emptyLiabilityBreakdown}
          </div>
        ) : (
          <div className="wm-money">
            <HBarChart
              categories={liabilityCategories}
              data={liabilityData}
              color="var(--destructive)"
              ariaLabel={liabilityAriaLabel}
            />
          </div>
        )}
      </SectionCard>
    </div>
  );
}
