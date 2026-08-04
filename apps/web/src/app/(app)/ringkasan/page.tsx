"use client";

import { useSession } from "@/lib/auth-compat";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { SectionCard, StatusBadge, ProgressBar } from "@/components/wm";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { formatRupiah, formatRupiahCompact } from "@/lib/format";
import { useCurrencyPreference } from "@/hooks/use-currency-preference";
import { useLocale } from "@/hooks/use-locale";
import { buildNetWorthTrendPath } from "@/lib/chart-utils";
import { ConsolidatedTotalCard } from "@/components/consolidated-total-card";
import type {
  DashboardSummaryDto,
  NetWorthDto,
  ReportSummaryDto,
} from "@wealthme/contracts";

const COMPOSITION_COLOR: Record<string, string> = {
  bank: "var(--brand-cyan)",
  ewallet: "var(--success)",
  investment: "var(--primary)",
  property: "var(--warning)",
  cash: "var(--muted-foreground)",
};

export default function RingkasanPage() {
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

  const netWorth = summary?.netWorth ?? 0;
  const totalAssets = (summary?.accountSummary ?? []).reduce(
    (sum, s) => sum + (s.total > 0 ? s.total : 0),
    0,
  );
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

  const trendIncome = summary?.cashflow.income ?? [];
  const trendExpense = summary?.cashflow.expense ?? [];
  const trend = buildNetWorthTrendPath(trendIncome, trendExpense, 320, 90);

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

  if (isError) {
    return (
      <div className="flex items-center justify-center py-16 text-[13px] text-muted-foreground">
        {t.ringkasan.errorLoad}
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {/* Top stat cards */}
      <div className="mb-[18px] grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <Card className="gap-0 border-none gradient-wealth p-5 text-white">
          <div className="mb-1.5 text-[11px] opacity-80">
            {t.ringkasan.totalNetWorthLabel}
          </div>
          <div className="text-[20px] font-black">
            {isLoading ? "..." : money(netWorth)}
          </div>
          <div className="mt-1 text-[11px] text-emerald-300">
            {isLoading
              ? "..."
              : monthNet >= 0
                ? `${t.ringkasan.monthDeltaUpPrefix}${money(monthNet)}${t.ringkasan.monthDeltaSuffix}`
                : `${t.ringkasan.monthDeltaDownPrefix}${money(Math.abs(monthNet))}${t.ringkasan.monthDeltaSuffix}`}
          </div>
        </Card>
        <Card className="gap-0 p-5">
          <div className="mb-1.5 text-[11px] text-muted-foreground">
            {t.ringkasan.totalAssetsLabel}
          </div>
          <div className="text-[20px] font-black text-success">
            {isLoading ? "..." : money(totalAssets)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {summary?.accountSummary.length
              ? `${summary.accountSummary.length}${t.ringkasan.accountTypesSuffix}`
              : t.ringkasan.noDataDash}
          </div>
        </Card>
        <Card className="gap-0 p-5">
          <div className="mb-1.5 text-[11px] text-muted-foreground">
            {t.ringkasan.totalLiabilitiesLabel}
          </div>
          <div className="text-[20px] font-black text-muted-foreground">
            {isLoading || isNetWorthLoading ? "..." : money(totalLiabilities)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {t.ringkasan.liabilitiesSublabel}
          </div>
        </Card>
        <Card className="gap-0 p-5">
          <div className="mb-1.5 text-[11px] text-muted-foreground">
            {t.ringkasan.savingsRateLabel}
          </div>
          <div className="text-[20px] font-black text-primary">
            {isLoading ? "..." : `${savingsRate}%`}
          </div>
          <div className="text-[11px] text-success">
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
            title={t.ringkasan.netWorthTrendTitle}
            className="lg:col-start-1 lg:col-end-3 lg:row-start-1"
          >
            {isLoading ? (
              <div className="h-[90px] animate-pulse rounded-md bg-muted" />
            ) : trend.points.length === 0 ? (
              <div className="flex h-[90px] items-center justify-center text-[12px] text-muted-foreground">
                {t.ringkasan.emptyCashflow}
              </div>
            ) : (
              <svg
                viewBox="0 0 320 90"
                width="100%"
                height={90}
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="ng" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--primary)"
                      stopOpacity={0.18}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--primary)"
                      stopOpacity={0.01}
                    />
                  </linearGradient>
                </defs>
                {trend.areaPath && <path d={trend.areaPath} fill="url(#ng)" />}
                {trend.linePath && (
                  <path
                    d={trend.linePath}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                )}
                {trend.points.length > 0 && (
                  <circle
                    cx={trend.points[trend.points.length - 1]!.x}
                    cy={trend.points[trend.points.length - 1]!.y}
                    r="4"
                    fill="var(--primary)"
                  />
                )}
              </svg>
            )}
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              {(summary?.cashflow.months ?? []).map((m, i) => (
                <span key={`${m}-${i}`}>{m}</span>
              ))}
            </div>
          </SectionCard>

          {/* Asset composition — horizontal labelled bar list */}
          <SectionCard
            title={t.ringkasan.compositionTitle}
            className="lg:col-start-3 lg:row-start-1"
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
                      <span className="shrink-0 text-muted-foreground">
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

        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3 lg:contents">
          {/* Cash Flow */}
          <SectionCard
            title={`${t.ringkasan.cashFlowTitlePrefix}${summary?.cashflow.months.at(-1) ?? ""}`}
            className="lg:col-start-1 lg:col-end-3 lg:row-start-2"
          >
            <div className="mb-2.5">
              <div className="text-[11px] text-muted-foreground">
                {t.ringkasan.incomeLabel}
              </div>
              <div className="text-[18px] font-extrabold text-success">
                {isLoading ? "..." : moneyFull(monthIncome)}
              </div>
            </div>
            <div className="mb-2.5">
              <div className="text-[11px] text-muted-foreground">
                {t.ringkasan.expenseLabel}
              </div>
              <div className="text-[18px] font-extrabold text-destructive">
                {isLoading ? "..." : moneyFull(monthExpense)}
              </div>
            </div>
            <div className="border-t pt-2.5">
              <div className="text-[11px] text-muted-foreground">
                {t.ringkasan.surplusLabel}
              </div>
              <div
                className={`text-[18px] font-extrabold ${monthNet >= 0 ? "text-success" : "text-destructive"}`}
              >
                {isLoading ? "..." : moneyFull(monthNet)}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={t.ringkasan.topExpensesTitle}
            className="lg:col-start-3 lg:row-start-2"
          >
            <div className="divide-y">
              {isLoading && (
                <div className="py-4 text-center text-[13px] text-muted-foreground">
                  {t.ringkasan.loadingLabel}
                </div>
              )}
              {!isLoading && topExpenses.length === 0 && (
                <div className="py-4 text-center text-[13px] text-muted-foreground">
                  {t.ringkasan.emptyTopExpenses}
                </div>
              )}
              {topExpenses.slice(0, 5).map((expenseItem, idx) => (
                <div
                  key={expenseItem.categoryName}
                  className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <div
                    className="flex size-[30px] shrink-0 items-center justify-center rounded-md text-[13px]"
                    style={{
                      background:
                        expenseItem.color ??
                        ["#EEF2FF", "#DCFCE7", "#FEF9C3", "#FEE2E2", "#F3F4F6"][
                          idx % 5
                        ],
                    }}
                  >
                    {["🏠", "😊", "🚗", "🏥", "💡"][idx % 5]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">
                      {expenseItem.categoryName}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge variant="gray">
                      {expenseItem.percentage}%
                    </StatusBadge>
                    <div className="text-right">
                      <div className="text-[13px] font-bold text-destructive">
                        {moneyFull(expenseItem.amount)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Health Score */}
          <SectionCard
            title={t.ringkasan.healthScoreTitle}
            className="lg:col-start-3 lg:row-start-3"
          >
            <div className="py-2.5 text-center">
              <svg
                viewBox="0 0 120 70"
                width="140"
                height="80"
                className="mx-auto"
              >
                <path
                  d="M10,60 A50,50 0 0,1 110,60"
                  fill="none"
                  stroke="var(--muted)"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                <path
                  d="M10,60 A50,50 0 0,1 110,60"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray="157"
                  strokeDashoffset={Math.round(
                    157 - (Math.max(0, Math.min(100, savingsRate)) / 100) * 157,
                  )}
                />
              </svg>
              <div className="-mt-3.5 text-[32px] font-black text-primary">
                {savingsRate}
              </div>
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
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
