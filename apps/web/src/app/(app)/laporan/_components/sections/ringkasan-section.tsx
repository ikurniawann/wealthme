import { Target, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { CardLink, SectionCard } from "@/components/wm";
import type { DonutSegment } from "@/components/charts/donut";
// EPIC-025 N3-G2 — the chart swap: ApexCharts presets replace the old
// BarChart/Donut+DonutLegend components. Every series fed to these presets
// is the SAME underlying data the old components rendered (traced inline
// at each call site) — only the rendering library changed.
import { CashflowChart, DonutChart } from "@/components/charts/apex-presets";
import { useMoney } from "@/hooks/use-money";
import { useLocale } from "@/hooks/use-locale";
import type {
  BalanceSheetDto,
  DetailReportDto,
  InvestmentSummaryDto,
  ReportSummaryDto,
} from "@wealthme/contracts";
import {
  balanceSheetToWealthAlloc,
  buildInvChartData,
  categoryBreakdownToDonut,
  formatSignedRupiah,
} from "@/lib/laporan-utils";
import { RingkasanStatCard } from "../atoms";

/* ───────────────────────── Section: Ringkasan ───────────────────────── */

export function RingkasanSection({
  go,
  summary,
  detailReport,
  invSummary,
  balanceSheet,
  isLoading,
  chartSummary,
  isChartLoading,
  chartRange,
  onChartRangeChange,
  periodLabel,
}: {
  go: (id: string) => void;
  summary?: ReportSummaryDto;
  /** Same rangeStart/rangeEnd every other tab queries — unlike `summary`
   * (a fixed trailing-months window, shared with Bulanan/Arus Kas/Performa),
   * this is scoped to exactly the selected period filter. The headline stat
   * cards below read their totals from here so "Bulan Ini"/"3 Bulan
   * Terakhir"/etc actually changes what "Total Pemasukan" shows. */
  detailReport?: DetailReportDto;
  invSummary?: InvestmentSummaryDto;
  balanceSheet?: BalanceSheetDto;
  isLoading?: boolean;
  /** EPIC-025 N3-J1 (gap 7) — the "Pemasukan vs Pengeluaran" chart's own
   * 6/12-month window, independent of `summary` (which always stays the
   * trailing-6-month window every other section/stat card here relies on). */
  chartSummary?: ReportSummaryDto;
  isChartLoading?: boolean;
  chartRange?: 6 | 12;
  onChartRangeChange?: (range: 6 | 12) => void;
  periodLabel?: string;
}) {
  const { t } = useLocale();
  const money = useMoney();
  const activeChartSummary = chartSummary ?? summary;
  const chartMonths = activeChartSummary?.points.map((p) => p.label) ?? [];
  // EPIC-025 N3-G2 — raw Rupiah series (not the old BarChart's /1_000_000
  // "juta" pre-scale — that was a pixel-height scale factor for the old
  // bespoke SVG bars, not a data change). CashflowChart's own axis/tooltip
  // formatters (`formatRupiahCompact`/`formatRupiah`) expect real amounts.
  const chartIncome = activeChartSummary?.points.map((p) => p.income) ?? [];
  const chartExpense = activeChartSummary?.points.map((p) => p.expense) ?? [];
  const cashflowChartAriaLabel =
    activeChartSummary && chartMonths.length > 0
      ? `${t.laporan.ringkasan.cashflowCardTitle} ${chartMonths[chartMonths.length - 1]}: ${t.common.income} ${money.format(chartIncome[chartIncome.length - 1] ?? 0)}, ${t.common.expense} ${money.format(chartExpense[chartExpense.length - 1] ?? 0)}`
      : t.laporan.ringkasan.cashflowCardTitle;

  // EPIC-025 N3-J1 (gap 5) — headline stat deltas, computed ONLY from data
  // already fetched (`summary.points`, trailing months ending at the
  // selected period). `points` is ascending chronological — the last entry
  // is the active period, the one before it is "last month". No delta is
  // rendered when there is no real previous point to compare against (a
  // dashed placeholder would be more misleading than nothing).
  // Headline totals for the exact selected period (see `detailReport`'s
  // prop comment) — `summary` stays the fixed trailing-months window used
  // only for the delta-vs-previous-month labels and the trend chart below.
  const headlineIncome = detailReport?.totalIncome ?? 0;
  const headlineExpense = detailReport?.totalExpense ?? 0;
  const headlineNet = headlineIncome - headlineExpense;
  const headlineSavingsRate =
    headlineIncome > 0 ? Math.round((headlineNet / headlineIncome) * 100) : 0;

  const points = summary?.points ?? [];
  const currentPoint = points[points.length - 1];
  const previousPoint =
    points.length > 1 ? points[points.length - 2] : undefined;
  const incomeDeltaPct =
    currentPoint && previousPoint && previousPoint.income > 0
      ? ((currentPoint.income - previousPoint.income) / previousPoint.income) *
        100
      : null;
  const expenseDeltaPct =
    currentPoint && previousPoint && previousPoint.expense > 0
      ? ((currentPoint.expense - previousPoint.expense) /
          previousPoint.expense) *
        100
      : null;
  // Consecutive trailing months (from the most recent) with a positive net
  // — a real streak read off the same series, not a guess.
  let surplusStreak = 0;
  for (let i = points.length - 1; i >= 0; i -= 1) {
    if (points[i].net > 0) surplusStreak += 1;
    else break;
  }
  // Matches the 30% savings-rate target `PerfSection` already uses
  // elsewhere on this page (`laporan.performa.savingsRateTargetLabel`) —
  // reused here, not a new invented threshold.
  const SAVINGS_TARGET_PCT = 30;

  function formatDeltaPct(pct: number): string {
    const arrow = pct >= 0 ? "↑" : "↓";
    return `${arrow} ${Math.abs(pct).toFixed(1)}%`;
  }
  const incomeDeltaLabel =
    incomeDeltaPct !== null && previousPoint
      ? `${formatDeltaPct(incomeDeltaPct)} ${t.laporan.ringkasan.statVsPrefix} ${previousPoint.label}`
      : undefined;
  const expenseDeltaLabel =
    expenseDeltaPct !== null && previousPoint
      ? `${formatDeltaPct(expenseDeltaPct)} ${t.laporan.ringkasan.statVsPrefix} ${previousPoint.label}`
      : undefined;
  const netCashflowDeltaLabel =
    summary && surplusStreak > 0
      ? t.laporan.ringkasan.statSurplusStreakTemplate.replace(
          "{count}",
          String(surplusStreak),
        )
      : undefined;
  const savingsRatioDeltaLabel =
    summary != null
      ? (summary.savingsRate >= SAVINGS_TARGET_PCT
          ? t.laporan.ringkasan.statSavingsAboveTargetTemplate
          : t.laporan.ringkasan.statSavingsBelowTargetTemplate
        ).replace("{target}", String(SAVINGS_TARGET_PCT))
      : undefined;

  // `expenseDonut`/`wealthAlloc` keep the percentage-based `DonutSegment[]`
  // shape `categoryBreakdownToDonut`/`balanceSheetToWealthAlloc` (protected
  // `laporan-utils.ts`) return — still used for the legend rows below,
  // unchanged from before the swap.
  const expenseDonut = summary
    ? categoryBreakdownToDonut(summary.topExpenseCategories)
    : [];
  // EPIC-025 N3-G2 — DonutChart series, value = the real amount (not the
  // percentage `expenseDonut` carries): the Apex preset sums `value` for
  // its center-total label and formats it as currency, so the series must
  // carry real amounts to preserve numeric parity. Built directly from
  // `summary.topExpenseCategories` (same filter/order `categoryBreakdownToDonut`
  // applies) rather than editing the protected util.
  const expenseDonutAmounts: DonutSegment[] = summary
    ? summary.topExpenseCategories
        .filter((item) => item.percentage > 0)
        .map((item, i) => ({
          label: item.categoryName,
          value: item.amount,
          color: expenseDonut[i]?.color ?? "#E2E8F0",
        }))
    : [];
  const expenseDonutAriaLabel =
    expenseDonut.length > 0
      ? `${t.laporan.ringkasan.expenseAllocTitle}: ${expenseDonut.map((s) => `${s.label} ${s.value}%`).join(", ")}`
      : t.laporan.ringkasan.expenseAllocTitle;

  const invChart = buildInvChartData(invSummary);

  const wealthAlloc = balanceSheet
    ? balanceSheetToWealthAlloc(balanceSheet.assets, balanceSheet.totalAssets)
    : [];
  /**
   * `BalanceSheetDto.assets[].category` is the raw Prisma `Asset.type` enum
   * for the physical-asset buckets ("properti", "kendaraan", …) — see
   * `computeLiveBalanceSheet`, which groups by that code verbatim — while
   * the snapshot-sourced buckets ("Kas & Setara Kas", "Investasi") already
   * arrive human-readable. Map through the same `assetTypeLabels` dictionary
   * `/aset` uses for these exact codes, falling back to the raw string for
   * the already-labeled buckets. AslSection does the same for its own chart.
   *
   * Display only — the raw `seg.label` stays the lookup key below, since
   * that is what `assets[].category` actually equals.
   */
  const assetCategoryLabel = (raw: string): string =>
    t.aset.assetTypeLabels[raw as keyof typeof t.aset.assetTypeLabels] ?? raw;

  // EPIC-025 N3-G2 — same amount-vs-percentage fix as `expenseDonutAmounts`,
  // matched back to the real amount by `category` label (order/color stay
  // identical to `wealthAlloc`, which the legend below still renders).
  const wealthAllocAmounts: DonutSegment[] = wealthAlloc.map((seg) => ({
    label: assetCategoryLabel(seg.label),
    value:
      balanceSheet?.assets.find((a) => a.category === seg.label)?.amount ?? 0,
    color: seg.color,
  }));
  const wealthAllocAriaLabel =
    wealthAlloc.length > 0
      ? `${t.laporan.ringkasan.wealthAllocTitle}: ${wealthAlloc.map((s) => `${assetCategoryLabel(s.label)} ${s.value}%`).join(", ")}`
      : t.laporan.ringkasan.wealthAllocTitle;

  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      {/* EPIC-025 N3-J1 (gap 5) — headline stat cards, prototype's
          `.auto-grid--metrics` of `.card.stat`. */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <RingkasanStatCard
          icon={<TrendingUp className="size-[17px]" />}
          iconBg="var(--success-soft)"
          iconColor="var(--success)"
          label={t.laporan.totalIncomeLabel}
          value={detailReport ? money.format(headlineIncome) : "Rp ·"}
          valueClass="text-success"
          delta={incomeDeltaLabel}
          deltaClass={
            incomeDeltaPct !== null && incomeDeltaPct < 0
              ? "text-destructive"
              : "text-success"
          }
        />
        <RingkasanStatCard
          icon={<TrendingDown className="size-[17px]" />}
          iconBg="color-mix(in oklab, var(--destructive) 14%, transparent)"
          iconColor="var(--destructive)"
          label={t.laporan.totalExpenseLabel}
          value={detailReport ? money.format(headlineExpense) : "Rp ·"}
          valueClass="text-destructive"
          delta={expenseDeltaLabel}
          deltaClass={
            expenseDeltaPct !== null && expenseDeltaPct < 0
              ? "text-success"
              : "text-destructive"
          }
        />
        <RingkasanStatCard
          icon={<Wallet className="size-[17px]" />}
          iconBg="var(--accent)"
          iconColor="var(--accent-foreground)"
          label={t.laporan.ringkasan.statNetCashflowLabel}
          value={detailReport ? formatSignedRupiah(headlineNet) : "Rp ·"}
          valueClass={
            detailReport && headlineNet >= 0
              ? "text-success"
              : "text-destructive"
          }
          delta={netCashflowDeltaLabel}
        />
        <RingkasanStatCard
          icon={<Target className="size-[17px]" />}
          iconBg="var(--brand-purple-soft)"
          iconColor="var(--brand-purple)"
          label={t.laporan.ringkasan.statSavingsRatioLabel}
          value={detailReport ? `${headlineSavingsRate}%` : "—"}
          delta={savingsRatioDeltaLabel}
          deltaClass={
            detailReport && headlineSavingsRate >= SAVINGS_TARGET_PCT
              ? "text-success"
              : "text-warning"
          }
        />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3.5 lg:grid-cols-2">
        <SectionCard
          title={t.laporan.ringkasan.cashflowCardTitle}
          action={
            chartRange && onChartRangeChange ? (
              <div className="inline-flex rounded-full border bg-secondary p-0.5 text-[11.5px] font-semibold">
                {([6, 12] as const).map((range) => (
                  <button
                    key={range}
                    type="button"
                    aria-pressed={chartRange === range}
                    onClick={() => onChartRangeChange(range)}
                    className={
                      "rounded-full px-2.5 py-1 transition-colors " +
                      (chartRange === range
                        ? "bg-card text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground")
                    }
                  >
                    {range === 6
                      ? t.laporan.ringkasan.cashflowRange6
                      : t.laporan.ringkasan.cashflowRange12}
                  </button>
                ))}
              </div>
            ) : undefined
          }
        >
          {/* EPIC-025 N3-J1 (gap 7) — fixed height (was 100px, visibly
              squashed with overlapping axis labels) + real series derived
              from the active-range summary. */}
          <div
            className={
              isChartLoading ? "opacity-50 pointer-events-none" : undefined
            }
          >
            {chartMonths.length > 0 ? (
              <CashflowChart
                months={chartMonths}
                income={chartIncome}
                expense={chartExpense}
                height={260}
                ariaLabel={cashflowChartAriaLabel}
              />
            ) : (
              <div className="flex h-[260px] items-center justify-center text-[12px] text-muted-foreground">
                {t.laporan.emptyMonthTransactions}
              </div>
            )}
          </div>
        </SectionCard>
        <SectionCard title={t.laporan.ringkasan.expenseAllocTitle}>
          <div className="grid items-center gap-4 md:grid-cols-[220px_minmax(0,1fr)] [&_.apexcharts-legend]:hidden!">
            {expenseDonut.length > 0 ? (
              <>
                {/* EPIC-025 N3-G2 — Donut → DonutChart (Apex). Same segments
                    as `expenseDonut`, amount-valued for center-total parity
                    (see `expenseDonutAmounts` above); `expenseCenterValue`
                    (formatJuta) is unused now that the Apex preset computes
                    its own center total from the real series. */}
                <DonutChart
                  segments={expenseDonutAmounts}
                  centerLabel={t.common.total}
                  height={190}
                  ariaLabel={expenseDonutAriaLabel}
                />
                <div className="space-y-2">
                  {expenseDonut.map((seg) => (
                    <div
                      key={seg.label}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: seg.color }}
                      />
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {seg.label}
                      </span>
                      <span className="mono font-medium">{seg.value}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-4 text-[12px] text-muted-foreground">
                {t.laporan.ringkasan.emptyExpenseAlloc}
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* EPIC-025 N3-J1 (gap 6) — "Rincian per Kategori" table, built from
          `summary.topExpenseCategories` (already fetched — no new
          endpoint). The prototype also shows an "Akun COA", "Transaksi"
          count, "Bulan Lalu", and a signed "Selisih" column; those are
          genuinely omitted (not just visually) because `ReportSummaryDto`
          carries neither a COA account code nor a per-category transaction
          count nor a previous-period breakdown per category — only this
          period's amount + share. Rendering fabricated numbers for those
          columns would violate the no-fabricated-data rule; a new endpoint
          is out of this task's scope. */}
      <SectionCard
        title={t.laporan.ringkasan.categoryTable.title}
        action={
          periodLabel ? (
            <span className="text-[11px] text-muted-foreground">
              {periodLabel}
            </span>
          ) : undefined
        }
        bodyClassName="pt-0"
      >
        {summary && summary.topExpenseCategories.length > 0 ? (
          <div className="w-full overflow-x-auto [mask-image:linear-gradient(to_left,transparent,black_24px)]">
            <table className="w-full min-w-[420px] text-left text-[12.5px]">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 font-semibold">
                    {t.laporan.ringkasan.categoryTable.colKategori}
                  </th>
                  <th className="py-2 text-right font-semibold">
                    {t.laporan.ringkasan.categoryTable.colPersentase}
                  </th>
                  <th className="py-2 text-right font-semibold">
                    {t.laporan.ringkasan.categoryTable.colBulanIni}
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.topExpenseCategories.map((item) => (
                  <tr
                    key={item.categoryName}
                    className="border-b last:border-0"
                  >
                    <td className="py-2.5 font-semibold">
                      {item.categoryName}
                    </td>
                    <td className="mono py-2.5 text-right text-muted-foreground">
                      {item.percentage}%
                    </td>
                    <td className="mono py-2.5 text-right font-bold">
                      {money.format(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-6 text-center text-[12px] text-muted-foreground">
            {t.laporan.ringkasan.categoryTable.emptyState}
          </div>
        )}
      </SectionCard>

      <SectionCard title={t.laporan.ringkasan.wealthAllocTitle}>
        <div className="grid items-center gap-4 md:grid-cols-[220px_minmax(0,1fr)] [&_.apexcharts-legend]:hidden!">
          {wealthAlloc.length > 0 ? (
            <>
              {/* EPIC-025 N3-G2 — Donut → DonutChart (Apex). Same segments
                  as `wealthAlloc`, amount-valued for center-total parity
                  (see `wealthAllocAmounts` above); `wealthCenterValue`
                  (formatJuta) is unused now that the Apex preset computes
                  its own center total from the real series. */}
              <DonutChart
                segments={wealthAllocAmounts}
                centerLabel={t.common.total}
                height={190}
                ariaLabel={wealthAllocAriaLabel}
              />
              <div className="space-y-2">
                {wealthAlloc.map((seg) => (
                  <div
                    key={seg.label}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: seg.color }}
                    />
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {assetCategoryLabel(seg.label)}
                    </span>
                    <span className="mono font-medium">{seg.value}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-4 text-[12px] text-muted-foreground">
              {t.laporan.ringkasan.emptyWealthAlloc}
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title={t.laporan.ringkasan.invPerformanceTitle}
        action={
          <CardLink onClick={() => go("rinv")}>{t.common.viewDetail}</CardLink>
        }
      >
        <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-2">
          <div>
            <div className="text-[11px] text-muted-foreground">
              {t.laporan.ringkasan.totalValueLabel}
            </div>
            <div className="text-[20px] font-black">
              {invSummary
                ? money.format(parseFloat(invSummary.totalCurrentValue))
                : "Rp ·"}
            </div>
            {invSummary && (
              <>
                <div
                  className={
                    "mt-1 text-[12px] " +
                    (parseFloat(invSummary.totalReturnRp) >= 0
                      ? "text-success"
                      : "text-destructive")
                  }
                >
                  {parseFloat(invSummary.totalReturnRp) >= 0 ? "+" : ""}
                  {money.format(parseFloat(invSummary.totalReturnRp))} ▲{" "}
                  {invSummary.totalReturnPct.toFixed(1)}%
                </div>
                <div
                  className={
                    "text-[11px] " +
                    (parseFloat(invSummary.todayReturnRp) >= 0
                      ? "text-success"
                      : "text-destructive")
                  }
                >
                  {t.laporan.ringkasan.todayReturnPrefix}{" "}
                  {parseFloat(invSummary.todayReturnRp) >= 0 ? "+" : ""}
                  {money.format(parseFloat(invSummary.todayReturnRp))} (
                  {invSummary.todayReturnPct.toFixed(2)}%)
                </div>
              </>
            )}
          </div>
          <div>
            {invChart ? (
              <>
                <div className="space-y-2">
                  <div>
                    <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="size-2 rounded-[2px]"
                          style={{ background: "var(--primary)" }}
                        />
                        {t.laporan.ringkasan.donutNilaiLabel}
                      </span>
                      <span>{invChart.nilaiPct}%</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${invChart.nilaiPct}%`,
                          background: "var(--primary)",
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="size-2 rounded-[2px]"
                          style={{ background: "#10B981" }}
                        />
                        {t.laporan.ringkasan.donutModalLabel}
                      </span>
                      <span>{invChart.modalPct}%</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${invChart.modalPct}%`,
                          background: "#10B981",
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-[10.5px] text-muted-foreground">
                  {invChart.hasReturn
                    ? t.laporan.ringkasan.portfolioUpLabel
                    : t.laporan.ringkasan.portfolioDownLabel}
                </div>
              </>
            ) : (
              <div className="flex h-[70px] items-center justify-center text-[12px] text-muted-foreground">
                {t.laporan.ringkasan.emptyInvestment}
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* EPIC-026 Wave 3 — the "Insight AI" banner was removed: the
          prototype's rsum panel ends at the category table, and the
          banner's "insight" was static i18n copy (a hardcoded "18%"
          claim), not real analysis. Its aiInsight* keys remain in the
          i18n dictionaries — noted for a separate cleanup. */}
    </div>
  );
}
