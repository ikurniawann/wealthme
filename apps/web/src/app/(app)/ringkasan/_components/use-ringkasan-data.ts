"use client";

// EPIC-026 — `/ringkasan` data layer. Extracted verbatim (queries + derived
// values, provenance comments intact) out of the previous ~1,000-line
// `page.tsx` so the page file only composes prototype sections.
//
// Every figure below comes from an endpoint this page already called before
// the rebuild — the prototype's hardcoded mock numbers are never used.

import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { formatRupiah, formatRupiahCompact } from "@/lib/format";
import { useCurrencyPreference } from "@/hooks/use-currency-preference";
import { useLocale } from "@/hooks/use-locale";
import type { StatusBadgeVariant } from "@/components/wm";
import type { DonutSegment } from "@/components/charts/donut";
import type {
  DashboardSummaryDto,
  LiabilityDto,
  NetWorthDto,
  NetWorthHistoryDto,
  NetWorthHistoryPointDto,
  ReportSummaryDto,
} from "@wealthme/contracts";

/**
 * Prototype's asset-composition colours (`ringkasan.html`'s four
 * `.progress__bar` inline backgrounds), keyed by account type.
 */
const COMPOSITION_COLOR: Record<string, string> = {
  bank: "var(--brand-cyan)",
  ewallet: "var(--success)",
  investment: "var(--primary)",
  property: "var(--warning)",
  cash: "var(--muted-foreground)",
};

// ── Trend range segmented control ("6 Bln / 12 Bln / Semua") ───────────────
// Mirrors `beranda/page.tsx`'s PERIOD_RANGE mapping onto the same
// `/dashboard/net-worth/history` endpoint — no new backend work.
export type TrendRangeKey =
  | "1m"
  | "3m"
  | "6m"
  | "12m"
  | "ytd"
  | "all"
  | "custom";
/** EPIC-033 group 5 (p30) — a user-picked date window for the trend. */
export type TrendCustomRange = { from: string; to: string };

const TREND_RANGE_PARAM: Record<TrendRangeKey, string> = {
  "1m": "1m",
  "3m": "3m",
  "6m": "6m",
  "12m": "12m",
  // ytd/custom fetch the widest window and are narrowed client-side.
  ytd: "12m",
  all: "120m",
  custom: "120m",
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
export function groupHistoryPointsByMonth(
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

export function formatPercent1(value: number, dateLocale: string): string {
  return value.toLocaleString(dateLocale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export type AssetBreakdownRow = {
  key: string;
  label: string;
  badgeLabel: string;
  badgeVariant: StatusBadgeVariant;
  amount: number;
};

export type RingkasanData = ReturnType<typeof useRingkasanData>;

export function useRingkasanData(
  trendRange: TrendRangeKey,
  customRange?: TrendCustomRange,
) {
  const { t } = useLocale();
  const { data: session } = useSession();
  const familyGroupId = session?.familyGroupId ?? null;
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

  const trendTitleByRange: Record<TrendRangeKey, string> = {
    "1m": t.ringkasan.netWorthTrendTitle1m,
    "3m": t.ringkasan.netWorthTrendTitle3m,
    "6m": t.ringkasan.netWorthTrendTitle,
    "12m": t.ringkasan.netWorthTrendTitle12m,
    ytd: t.ringkasan.netWorthTrendTitleYtd,
    all: t.ringkasan.netWorthTrendTitleAll,
    custom: t.ringkasan.netWorthTrendTitleCustom,
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
  const topExpenseAriaLabel = `${t.ringkasan.topExpensesTitle}: ${topExpenseSlice
    .map((e) => `${e.categoryName} ${moneyFull(e.amount)}`)
    .join(", ")}`;

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
  // EPIC-033 group 5 (p30) — "Tahun Ini" and a custom from/to window are
  // cut from the widest fetch rather than adding endpoint params.
  const windowStart =
    trendRange === "ytd"
      ? new Date(new Date().getFullYear(), 0, 1).getTime()
      : trendRange === "custom" && customRange?.from
        ? new Date(customRange.from).getTime()
        : null;
  const windowEnd =
    trendRange === "custom" && customRange?.to
      ? new Date(customRange.to).getTime() + 86_400_000 - 1
      : null;
  const netWorthHistoryPoints = (netWorthHistory?.points ?? []).filter((p) => {
    const ts = new Date(p.capturedAt).getTime();
    if (windowStart !== null && ts < windowStart) return false;
    if (windowEnd !== null && ts > windowEnd) return false;
    return true;
  });
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
  const assetBreakdownRows: AssetBreakdownRow[] = [
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

  return {
    // status
    isLoading,
    isError,
    isNetWorthLoading,
    isNetWorthHistoryLoading,
    isLiabilitiesLoading,
    // formatting
    money,
    moneyFull,
    dateLocale: t.beranda.dateLocale,
    currency,
    isIndicative,
    // header
    familyName,
    todayLabel,
    // headline figures
    netWorth,
    totalAssets,
    totalLiabilities,
    savingsRate,
    monthIncome,
    monthExpense,
    monthNet,
    accountTypeCount: summary?.accountSummary.length ?? 0,
    // trend
    trendTitleByRange,
    netWorthTrendCategories,
    netWorthTrendSeries,
    netWorthTrendValues,
    netWorthTrendAriaLabel,
    yoyPct,
    // composition
    composition,
    donutSegments,
    donutAriaLabel,
    // cashflow
    cashflowMonths,
    cashflowIncome,
    cashflowExpense,
    cashflowAriaLabel,
    // top expenses
    topExpenseSlice,
    topExpenseCategories,
    topExpenseData,
    topExpenseAriaLabel,
    // liabilities
    allLiabilities,
    liabilityBreakdown,
    liabilityCategories,
    liabilityData,
    liabilityAriaLabel,
    // breakdown table
    assetBreakdownRows,
    // health
    debtRatio,
  };
}
