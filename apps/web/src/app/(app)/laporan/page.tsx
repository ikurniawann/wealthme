"use client";

import {
  Fragment,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  SectionCard,
  CardLink,
  MoneyStat,
  ProgressBar,
  StatusBadge,
} from "@/components/wm";
import type { DonutSegment } from "@/components/charts/donut";
// EPIC-025 N3-G2 — the chart swap: ApexCharts presets replace the old
// BarChart/Donut+DonutLegend components. Every series fed to these presets
// is the SAME underlying data the old components rendered (traced inline
// at each call site) — only the rendering library changed.
import {
  CashflowChart,
  DonutChart,
  HBarChart,
  RadialChart,
  TrendChart,
} from "@/components/charts/apex-presets";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { queryKeys } from "@/lib/query-keys";
import { formatRupiah } from "@/lib/format";
import { useLocale } from "@/hooks/use-locale";
import type { I18nDictionary, Locale } from "@/i18n";
import { REPORT_TABS } from "@/lib/nav";
import {
  clampDayToMonth,
  daysInMonth,
  getPeriodDateRange,
  getYearDateRange,
  REPORT_TIMEZONE_LABEL,
  resolvePreset,
  type ReportPeriodSelection,
  type ReportRangePreset,
} from "@/lib/laporan-period";
import type {
  BalanceSheetDto,
  BankReportDto,
  CashflowStatementDto,
  CoaMatrixDto,
  DetailReportDto,
  ExportJobRequestDto,
  ExportJobStatusDto,
  ExportReportType,
  InvestmentDto,
  InvestmentSummaryDto,
  InvestmentType,
  NetWorthDto,
  PnlDto,
  Pph21ResultDto,
  ReconciliationBridgeDto,
  ReportSummaryDto,
  Role,
  SankeyDto,
} from "@wealthme/contracts";
import {
  balanceSheetToWealthAlloc,
  buildInvChartData,
  categoryBreakdownToDonut,
  computeBalanceSheetIdentity,
  formatJuta,
  formatSignedRupiah,
  investmentCurrentValue,
  sankeyToFlowBars,
  txTypeToBadgeVariant,
} from "@/lib/laporan-utils";

/** Family group member (mirrors API MemberResponseDto). */
type FamilyMember = {
  id: string;
  userId: string;
  familyGroupId: string;
  role: Role;
  name: string;
  email: string;
  createdAt: string;
};

// EPIC-023 Task C retry (six-reviewer finding) — covers all six roles; the
// previous map only covered 3 and its "admin" key never matched the real
// enum value `admin_staff`, so admin_staff/spouse/dependant/operational all
// silently fell back to the `?? "info"` default below. Text labels now come
// from the shared `t.common.roleLabels` (see i18n/types.ts's `MemberRoleId`)
// instead of a page-local partial map.
const ROLE_VARIANTS: Record<
  string,
  "success" | "info" | "purple" | "warning" | "gray"
> = {
  owner: "success",
  spouse: "purple",
  admin_staff: "info",
  member: "gray",
  dependant: "warning",
  operational: "warning",
};

/* ───────────────────────── Locale-aware date helpers ───────────────────────── */

function localeTag(locale: Locale): string {
  return locale === "en" ? "en-US" : "id-ID";
}

function formatLocaleDateLong(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(localeTag(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatLocaleDateShort(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(localeTag(locale), {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatLocaleTime(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleTimeString(localeTag(locale), {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ───────────────────────── Small helpers ───────────────────────── */

/** Compact 4-up stat block (the demo's `.laporan-stats`). */
function StatTile({
  label,
  value,
  valueClass,
  hint,
}: {
  label: string;
  value: string;
  valueClass?: string;
  hint?: React.ReactNode;
}) {
  return (
    <div className="rounded-[12px] border bg-card p-4">
      <div className="text-[10.5px] text-muted-foreground">{label}</div>
      <div className={"text-[18px] font-extrabold " + (valueClass ?? "")}>
        {value}
        {hint}
      </div>
    </div>
  );
}

/** Activity row (the demo's `.act-item`). */
function ActItem({
  icon,
  iconBg,
  iconColor,
  iconSize = "16px",
  name,
  cat,
  right,
  last,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor?: string;
  iconSize?: string;
  name: string;
  cat?: string;
  right: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={
        "flex items-center gap-3 py-2.5 " +
        (last ? "" : "border-b border-border")
      }
    >
      <div
        className="flex size-[38px] shrink-0 items-center justify-center rounded-[10px] font-bold"
        style={{ background: iconBg, color: iconColor, fontSize: iconSize }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold">{name}</div>
        {cat && <div className="text-[11px] text-muted-foreground">{cat}</div>}
      </div>
      <div className="text-right">{right}</div>
    </div>
  );
}

/** Labelled progress row (the demo's progress-bar blocks). */
function BarRow({
  label,
  right,
  value,
  color,
}: {
  label: React.ReactNode;
  right: React.ReactNode;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-[5px] flex justify-between text-[12.5px]">
        <span className="font-semibold">{label}</span>
        <span className="flex items-center gap-2">{right}</span>
      </div>
      <ProgressBar value={value} color={color} height={8} />
    </div>
  );
}

/* ───────────────────────── Section: Ringkasan ───────────────────────── */

/** Headline stat card — prototype's `.card.stat` (gap 5): tinted icon,
 * label, value, and an optional delta sub-line. `delta` is only rendered
 * when the caller actually computed one from real data — never a
 * placeholder. */
function RingkasanStatCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  valueClass,
  delta,
  deltaClass,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  valueClass?: string;
  delta?: string;
  deltaClass?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[12px] border bg-card p-4">
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-[10px]"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] text-muted-foreground">{label}</div>
        <div
          className={"mono text-[17px] font-extrabold " + (valueClass ?? "")}
        >
          {value}
        </div>
        {delta && (
          <div
            className={
              "mt-1 text-[11px] " + (deltaClass ?? "text-muted-foreground")
            }
          >
            {delta}
          </div>
        )}
      </div>
    </div>
  );
}

function RingkasanSection({
  go,
  summary,
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
      ? `${t.laporan.ringkasan.cashflowCardTitle} ${chartMonths[chartMonths.length - 1]}: ${t.common.income} ${formatRupiah(chartIncome[chartIncome.length - 1] ?? 0)}, ${t.common.expense} ${formatRupiah(chartExpense[chartExpense.length - 1] ?? 0)}`
      : t.laporan.ringkasan.cashflowCardTitle;

  // EPIC-025 N3-J1 (gap 5) — headline stat deltas, computed ONLY from data
  // already fetched (`summary.points`, trailing months ending at the
  // selected period). `points` is ascending chronological — the last entry
  // is the active period, the one before it is "last month". No delta is
  // rendered when there is no real previous point to compare against (a
  // dashed placeholder would be more misleading than nothing).
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
  // EPIC-025 N3-G2 — same amount-vs-percentage fix as `expenseDonutAmounts`,
  // matched back to the real amount by `category` label (order/color stay
  // identical to `wealthAlloc`, which the legend below still renders).
  const wealthAllocAmounts: DonutSegment[] = wealthAlloc.map((seg) => ({
    label: seg.label,
    value:
      balanceSheet?.assets.find((a) => a.category === seg.label)?.amount ?? 0,
    color: seg.color,
  }));
  const wealthAllocAriaLabel =
    wealthAlloc.length > 0
      ? `${t.laporan.ringkasan.wealthAllocTitle}: ${wealthAlloc.map((s) => `${s.label} ${s.value}%`).join(", ")}`
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
          value={summary ? formatRupiah(summary.totalIncome) : "Rp —"}
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
          value={summary ? formatRupiah(summary.totalExpense) : "Rp —"}
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
          value={summary ? formatSignedRupiah(summary.netSavings) : "Rp —"}
          valueClass={
            summary && summary.netSavings >= 0
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
          value={summary ? `${summary.savingsRate}%` : "—"}
          delta={savingsRatioDeltaLabel}
          deltaClass={
            summary && summary.savingsRate >= SAVINGS_TARGET_PCT
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
          <div className="flex flex-wrap items-center gap-3.5">
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
                  height={220}
                  ariaLabel={expenseDonutAriaLabel}
                />
                <div className="min-w-[120px] flex-1 space-y-1.5">
                  {expenseDonut.map((seg) => (
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
          <div className="w-full overflow-x-auto">
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
                      {formatRupiah(item.amount)}
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
        <div className="flex flex-wrap items-center gap-3.5">
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
                height={220}
                ariaLabel={wealthAllocAriaLabel}
              />
              <div className="min-w-[120px] flex-1 space-y-1.5">
                {wealthAlloc.map((seg) => (
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
                ? formatRupiah(parseFloat(invSummary.totalCurrentValue))
                : "Rp —"}
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
                  {formatRupiah(parseFloat(invSummary.totalReturnRp))} ▲{" "}
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
                  {formatRupiah(parseFloat(invSummary.todayReturnRp))} (
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

/* ───────────────────────── Section: Harian ───────────────────────── */

const TX_ICON: Record<string, string> = {
  income: "📥",
  expense: "🛒",
  transfer: "↔️",
};
const TX_ICON_BG: Record<string, string> = {
  income: "#DCFCE7",
  expense: "#FEF3C7",
  transfer: "#DBEAFE",
};

function HarianSection({
  dailyReport,
  isLoading,
  date,
  onDateChange,
}: {
  dailyReport?: DetailReportDto;
  isLoading?: boolean;
  date: string;
  onDateChange: (d: string) => void;
}) {
  const { t, locale } = useLocale();
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const net =
    (dailyReport?.totalIncome ?? 0) - (dailyReport?.totalExpense ?? 0);

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[15px] font-bold">
          {t.laporan.harian.titlePrefix}{" "}
          {formatLocaleDateLong(`${date}T00:00:00`, locale)}
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="rounded-md border bg-background px-3 py-[7px] text-[13.5px] outline-none focus:border-primary"
        />
      </div>
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <StatTile
          label={t.laporan.harian.incomeTodayLabel}
          value={dailyReport ? formatRupiah(dailyReport.totalIncome) : "Rp —"}
          valueClass="text-success"
        />
        <StatTile
          label={t.laporan.harian.expenseTodayLabel}
          value={dailyReport ? formatRupiah(dailyReport.totalExpense) : "Rp —"}
          valueClass="text-destructive"
        />
        <StatTile
          label={t.laporan.harian.netDailyLabel}
          value={
            dailyReport ? `${net >= 0 ? "+" : ""}${formatRupiah(net)}` : "Rp —"
          }
          valueClass={net >= 0 ? "text-success" : "text-destructive"}
        />
        <StatTile
          label={t.laporan.harian.txnCountLabel}
          value={dailyReport ? String(dailyReport.count) : "—"}
          valueClass="text-primary"
        />
      </div>
      <SectionCard title={t.laporan.harian.txnTodayTitle}>
        {dailyReport && dailyReport.transactions.length > 0 ? (
          dailyReport.transactions.map((tx, i) => {
            const isIncome = tx.type === "income";
            // EPIC-022 B8 — a transfer is neither income nor expense;
            // render it neutrally (no +/- sign, muted colour) instead of a
            // red negative that contradicts its neutral category badge
            // elsewhere on this page. Same fix as DetailSection below.
            const isTransfer = tx.type === "transfer";
            const time = formatLocaleTime(tx.occurredAt, locale);
            return (
              <ActItem
                key={tx.id}
                icon={TX_ICON[tx.type] ?? "💳"}
                iconBg={TX_ICON_BG[tx.type] ?? "#F3F4F6"}
                name={tx.description ?? tx.accountName ?? "—"}
                cat={`${time} · ${tx.categoryName ?? tx.accountName ?? "—"}`}
                right={
                  <div
                    className={
                      "text-[13px] font-bold " +
                      (isTransfer
                        ? "text-muted-foreground"
                        : isIncome
                          ? "text-success"
                          : "text-destructive")
                    }
                  >
                    {isTransfer ? "" : isIncome ? "+" : "-"}
                    {formatRupiah(tx.amount)}
                  </div>
                }
                last={i === dailyReport.transactions.length - 1}
              />
            );
          })
        ) : (
          <div className="py-4 text-center text-[12px] text-muted-foreground">
            {t.laporan.harian.emptyToday}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Section: Bulanan ───────────────────────── */

function BulananSection({
  summary,
  isLoading,
}: {
  summary?: ReportSummaryDto;
  isLoading?: boolean;
}) {
  const { t } = useLocale();
  const chartMonths = summary?.points.map((p) => p.label) ?? [];
  // EPIC-025 N3-G2 — raw Rupiah series, same reasoning as `RingkasanSection`
  // above (the old /1_000_000 was a pixel-scale factor, not a data change).
  const chartIncome = summary?.points.map((p) => p.income) ?? [];
  const chartExpense = summary?.points.map((p) => p.expense) ?? [];
  const cashflowChartAriaLabel =
    summary && chartMonths.length > 0
      ? `${t.laporan.bulanan.trendTitle} ${chartMonths[chartMonths.length - 1]}: ${t.common.income} ${formatRupiah(chartIncome[chartIncome.length - 1] ?? 0)}, ${t.common.expense} ${formatRupiah(chartExpense[chartExpense.length - 1] ?? 0)}`
      : t.laporan.bulanan.trendTitle;

  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[15px] font-bold">{t.laporan.bulanan.title}</div>
      </div>
      {chartMonths.length > 0 && (
        <SectionCard title={t.laporan.bulanan.trendTitle}>
          {/* EPIC-025 N3-G2 — BarChart → CashflowChart (Apex). */}
          <CashflowChart
            months={chartMonths}
            income={chartIncome}
            expense={chartExpense}
            height={110}
            ariaLabel={cashflowChartAriaLabel}
          />
        </SectionCard>
      )}
      <SectionCard title={t.laporan.bulanan.recapTitle}>
        <div className="w-full overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 font-semibold">
                  {t.laporan.bulanan.colBulan}
                </th>
                <th className="py-2 font-semibold">
                  {t.laporan.bulanan.colMasuk}
                </th>
                <th className="py-2 font-semibold">
                  {t.laporan.bulanan.colKeluar}
                </th>
                <th className="py-2 font-semibold">
                  {t.laporan.bulanan.colNet}
                </th>
              </tr>
            </thead>
            <tbody>
              {summary?.points && summary.points.length > 0 ? (
                summary.points.map((p) => (
                  <tr key={p.label} className="border-b last:border-0">
                    <td className="py-2.5 font-semibold">{p.label}</td>
                    <td className="mono py-2.5 text-success">
                      {formatRupiah(p.income)}
                    </td>
                    <td className="mono py-2.5 text-destructive">
                      {formatRupiah(p.expense)}
                    </td>
                    <td
                      className={
                        "mono py-2.5 " +
                        (p.net >= 0 ? "text-success" : "text-destructive")
                      }
                    >
                      {p.net >= 0 ? "+" : ""}
                      {formatRupiah(p.net)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="py-6 text-center text-[12px] text-muted-foreground"
                  >
                    {t.laporan.emptyMonthTransactions}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Section: Tahunan ───────────────────────── */

function TahunanSection({
  yearly,
  isLoading,
}: {
  yearly?: ReportSummaryDto;
  isLoading?: boolean;
}) {
  const { t } = useLocale();
  const points = yearly?.points ?? [];
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";

  const latest = points[points.length - 1];

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="text-[15px] font-bold">{t.laporan.tahunan.title}</div>
      {latest ? (
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          <StatTile
            label={`${t.laporan.totalIncomeLabel} ${latest.label}`}
            value={formatRupiah(latest.income)}
            valueClass="text-success"
          />
          <StatTile
            label={t.laporan.totalExpenseLabel}
            value={formatRupiah(latest.expense)}
            valueClass="text-destructive"
          />
          <StatTile
            label={t.laporan.tahunan.netYearLabel}
            value={(latest.net >= 0 ? "+" : "") + formatRupiah(latest.net)}
            valueClass={latest.net >= 0 ? "text-success" : "text-destructive"}
          />
          <StatTile
            label={t.laporan.savingsRateLabel}
            value={
              latest.income > 0
                ? `${Math.round(((latest.income - latest.expense) / latest.income) * 100)}%`
                : "—"
            }
            valueClass="text-primary"
          />
        </div>
      ) : (
        <div className="rounded-[12px] border p-6 text-center text-[12px] text-muted-foreground">
          {t.laporan.tahunan.emptyYear}
        </div>
      )}
      {points.length > 0 && (
        <SectionCard title={t.laporan.tahunan.trendTitle}>
          {/* EPIC-026 Wave 3 — prototype's `#c-tahunan` mount is the Apex
              trend preset (J3 FOLD); same yearly income series the
              hand-rolled progress bars rendered before this rebuild. The
              prototype's own series (net worth per year) needs historical
              snapshots the schema does not persist — income per year is
              what this section's data actually carries (its existing
              title already says so). */}
          <TrendChart
            categories={points.map((p) => p.label)}
            series={[
              {
                name: t.laporan.totalIncomeLabel,
                data: points.map((p) => p.income),
              },
            ]}
            height={260}
            ariaLabel={`${t.laporan.tahunan.trendTitle}: ${points
              .map((p) => `${p.label} ${formatRupiah(p.income)}`)
              .join(", ")}`}
          />
        </SectionCard>
      )}
    </div>
  );
}

/* ───────────────────────── Section: Group Family ───────────────────────── */

function FamilySection({
  members,
  netWorth,
  summary,
  isLoading,
}: {
  members?: FamilyMember[];
  netWorth?: NetWorthDto;
  summary?: ReportSummaryDto;
  isLoading?: boolean;
}) {
  const { t } = useLocale();
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const memberList = members ?? [];

  const netWorthRows = netWorth
    ? [
        {
          label: t.laporan.family.rowAccountsCash,
          value: netWorth.accountsTotal,
          neg: false,
        },
        {
          label: t.laporan.family.rowInvestments,
          value: netWorth.investmentsTotal,
          neg: false,
        },
        {
          label: t.laporan.family.rowOtherAssets,
          value: netWorth.assetsTotal,
          neg: false,
        },
        {
          label: t.laporan.family.rowLiabilities,
          value: netWorth.liabilitiesTotal,
          neg: true,
        },
      ]
    : [];

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="text-[15px] font-bold">{t.laporan.family.title}</div>

      <SectionCard title={t.laporan.family.consolidationTitle}>
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          <MoneyStat
            label={t.laporan.family.totalNetWorthLabel}
            value={
              netWorth
                ? formatRupiah(parseFloat(netWorth.netWorth) || 0)
                : "Rp —"
            }
            valueClass="text-primary"
          />
          <MoneyStat
            label={t.laporan.totalIncomeLabel}
            value={summary ? formatRupiah(summary.totalIncome) : "Rp —"}
            valueClass="text-success"
          />
          <MoneyStat
            label={t.laporan.totalExpenseLabel}
            value={summary ? formatRupiah(summary.totalExpense) : "Rp —"}
            valueClass="text-destructive"
          />
          <MoneyStat
            label={t.laporan.surplusLabel}
            value={summary ? formatRupiah(summary.netSavings) : "Rp —"}
            valueClass="text-success"
          />
        </div>
      </SectionCard>

      {netWorthRows.length > 0 && (
        <SectionCard title={t.laporan.family.wealthCompositionTitle}>
          <div className="flex flex-col">
            {netWorthRows.map((row, i) => (
              <div
                key={row.label}
                className={
                  "flex items-center justify-between py-2.5 " +
                  (i === netWorthRows.length - 1
                    ? ""
                    : "border-b border-border")
                }
              >
                <span className="text-[13px] font-semibold">{row.label}</span>
                <span
                  className={
                    "mono text-[13px] font-bold " +
                    (row.neg ? "text-destructive" : "text-foreground")
                  }
                >
                  {row.neg ? "-" : ""}
                  {formatRupiah(parseFloat(row.value) || 0)}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard
        title={`${t.laporan.family.membersTitlePrefix} (${memberList.length})`}
      >
        {memberList.length > 0 ? (
          memberList.map((m, i) => (
            <ActItem
              key={m.id}
              icon={m.name.slice(0, 2).toUpperCase()}
              iconBg="#EEF2FF"
              iconColor="#4F46E5"
              iconSize="12px"
              name={m.name}
              cat={m.email}
              right={
                <StatusBadge variant={ROLE_VARIANTS[m.role] ?? "info"}>
                  {t.common.roleLabels[m.role] ?? m.role}
                </StatusBadge>
              }
              last={i === memberList.length - 1}
            />
          ))
        ) : (
          <div className="py-4 text-center text-[12px] text-muted-foreground">
            {t.laporan.family.emptyMembers}
          </div>
        )}
      </SectionCard>

      <div className="rounded-[12px] border border-primary/20 bg-accent p-3.5 text-[12px] text-muted-foreground">
        {t.laporan.family.noteConsolidation}
      </div>
    </div>
  );
}

/* ───────────────────────── Section: Bank ───────────────────────── */

const BANK_COLORS = [
  "var(--success)",
  "var(--brand-cyan)",
  "var(--warning)",
  "var(--primary)",
  "#8B5CF6",
];

function BankSection({
  bankReport,
  isLoading,
}: {
  bankReport?: BankReportDto;
  isLoading?: boolean;
}) {
  const { t } = useLocale();
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const banks = bankReport?.banks ?? [];
  const maxIncome = Math.max(...banks.map((b) => b.income), 1);

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="text-[15px] font-bold">{t.laporan.bank.title}</div>
      <SectionCard title={t.laporan.bank.balancePerAccountTitle}>
        {banks.length > 0 ? (
          banks.map((b, i) => (
            <ActItem
              key={b.accountName}
              icon={
                b.institution?.slice(0, 3).toUpperCase() ??
                b.accountName.slice(0, 3).toUpperCase()
              }
              iconBg="#DBEAFE"
              iconColor="#0061AF"
              iconSize="11px"
              name={b.accountName}
              cat={b.institution ?? "—"}
              right={
                <div className="text-[13px] font-bold">
                  {formatRupiah(b.balance)}
                </div>
              }
              last={i === banks.length - 1}
            />
          ))
        ) : (
          <div className="py-4 text-center text-[12px] text-muted-foreground">
            {t.laporan.bank.emptyAccounts}
          </div>
        )}
      </SectionCard>
      {banks.length > 0 && (
        <SectionCard title={t.laporan.bank.inOutTitle}>
          <div className="flex flex-col gap-2.5">
            {banks.map((b, i) => (
              <BarRow
                key={b.accountName}
                label={b.accountName}
                right={
                  <>
                    <span className="font-bold text-success">
                      +{formatJuta(b.income)}
                    </span>
                    <span className="font-bold text-destructive">
                      -{formatJuta(b.expense)}
                    </span>
                  </>
                }
                value={
                  maxIncome > 0 ? Math.round((b.income / maxIncome) * 100) : 0
                }
                color={BANK_COLORS[i % BANK_COLORS.length] ?? "var(--primary)"}
              />
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

/* ───────────────────────── Section: Detail ───────────────────────── */

function DetailSection({
  detailReport,
  isLoading,
}: {
  detailReport?: DetailReportDto;
  isLoading?: boolean;
}) {
  const { t, locale } = useLocale();
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const txs = detailReport?.transactions ?? [];

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[15px] font-bold">{t.laporan.detail.title}</div>
      </div>
      <SectionCard>
        <div className="w-full overflow-x-auto">
          <table className="min-w-[580px] w-full text-[12.5px]">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 font-semibold">
                  {t.laporan.detail.colDate}
                </th>
                <th className="py-2 font-semibold">
                  {t.laporan.detail.colDesc}
                </th>
                <th className="py-2 font-semibold">
                  {t.laporan.detail.colCategory}
                </th>
                <th className="py-2 font-semibold">
                  {t.laporan.detail.colAccount}
                </th>
                <th className="py-2 text-right font-semibold">
                  {t.laporan.detail.colAmount}
                </th>
              </tr>
            </thead>
            <tbody>
              {txs.length > 0 ? (
                txs.map((tx) => {
                  const isIncome = tx.type === "income";
                  // EPIC-022 B8 — a transfer is neither income nor expense;
                  // render it neutrally (no +/- sign, muted colour) instead
                  // of a red negative that contradicts its neutral badge.
                  const isTransfer = tx.type === "transfer";
                  const tgl = formatLocaleDateShort(tx.occurredAt, locale);
                  return (
                    <tr key={tx.id} className="border-b last:border-0">
                      <td className="mono py-2.5">{tgl}</td>
                      <td className="py-2.5">{tx.description ?? "—"}</td>
                      <td className="py-2.5">
                        <StatusBadge variant={txTypeToBadgeVariant(tx.type)}>
                          {tx.categoryName ?? tx.type}
                        </StatusBadge>
                      </td>
                      <td className="py-2.5">{tx.accountName ?? "—"}</td>
                      <td
                        className={
                          "mono py-2.5 text-right " +
                          (isTransfer
                            ? "text-muted-foreground"
                            : isIncome
                              ? "text-success"
                              : "text-destructive")
                        }
                      >
                        {isTransfer ? "" : isIncome ? "+" : "-"}
                        {formatRupiah(tx.amount)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="py-6 text-center text-[12px] text-muted-foreground"
                  >
                    {t.laporan.emptyMonthTransactions}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Section: Aliran Dana ───────────────────────── */

function AliranSection({
  sankeyData,
  isLoading,
  periodLabel,
}: {
  sankeyData?: SankeyDto;
  isLoading?: boolean;
  periodLabel: string;
}) {
  const { t } = useLocale();
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const incomeBars = sankeyData ? sankeyToFlowBars(sankeyData, "income") : [];
  const expenseBars = sankeyData ? sankeyToFlowBars(sankeyData, "expense") : [];

  const bulan = periodLabel;

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="text-[15px] font-bold">{t.laporan.aliran.title}</div>
      <SectionCard title={`${t.laporan.aliran.cardTitlePrefix} ${bulan}`}>
        {sankeyData && (incomeBars.length > 0 || expenseBars.length > 0) ? (
          /* EPIC-026 Wave 3 — prototype's `#c-aliran` mount is the Apex
             hbar preset (J3 FOLD); same sankey-derived label/amount pairs
             the hand-rolled gradient bars rendered before this rebuild. */
          <div className="flex flex-col gap-3.5">
            {incomeBars.length > 0 && (
              <div>
                <div className="mb-2 text-[11px] font-bold text-success">
                  {t.laporan.aliran.incomeSourceLabel}
                </div>
                <HBarChart
                  categories={incomeBars.map((b) => b.label)}
                  data={incomeBars.map((b) => b.amount)}
                  color="var(--success)"
                  ariaLabel={`${t.laporan.aliran.incomeSourceLabel}: ${incomeBars
                    .map((b) => `${b.label} ${formatJuta(b.amount)}`)
                    .join(", ")}`}
                />
              </div>
            )}
            {expenseBars.length > 0 && (
              <div>
                <div className="mb-2 text-[11px] font-bold text-destructive">
                  {t.laporan.aliran.expenseAllocLabel}
                </div>
                <HBarChart
                  categories={expenseBars.map((b) => b.label)}
                  data={expenseBars.map((b) => b.amount)}
                  color="var(--destructive)"
                  ariaLabel={`${t.laporan.aliran.expenseAllocLabel}: ${expenseBars
                    .map((b) => `${b.label} ${formatJuta(b.amount)}`)
                    .join(", ")}`}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="py-4 text-center text-[12px] text-muted-foreground">
            {t.laporan.aliran.emptyFlow}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Section: PNL ───────────────────────── */

function StatementRow({
  label,
  value,
  indent,
  valueColor,
  className,
  labelClass,
  valueClass,
}: {
  label: React.ReactNode;
  value?: React.ReactNode;
  indent?: boolean;
  valueColor?: string;
  className?: string;
  labelClass?: string;
  valueClass?: string;
}) {
  return (
    <tr className={className}>
      <td
        className={"py-[7px] " + (indent ? "pl-3.5 " : "") + (labelClass ?? "")}
      >
        {label}
      </td>
      <td
        className={"mono py-[7px] text-right " + (valueClass ?? "")}
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </td>
    </tr>
  );
}

function PnlSection({
  pnl,
  isLoading,
  periodLabel,
}: {
  pnl?: PnlDto;
  isLoading?: boolean;
  periodLabel: string;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const bulan = periodLabel;
  const netMargin =
    pnl && pnl.revenue > 0
      ? `${Math.round((pnl.netProfit / pnl.revenue) * 100 * 10) / 10}%`
      : "—";

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="text-[15px] font-bold">
        {t.laporan.pnl.titlePrefix} {bulan}
      </div>
      {/* EPIC-023 A4 — honest disclosure of the accounting basis this report
          uses, so a family reading "revenue" never assumes accrual timing. */}
      <div className="text-[11px] text-muted-foreground">
        {t.laporan.pnl.cashBasisNote}
      </div>
      <SectionCard>
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            <StatementRow
              label={t.laporan.pnl.revenueLabel}
              className="border-b-2 border-border"
              labelClass="py-2.5 font-bold text-success"
            />
            {pnl?.revenueBreakdown.map((item) => (
              <StatementRow
                key={item.categoryName}
                label={item.categoryName}
                value={formatRupiah(item.amount)}
                indent
              />
            ))}
            <StatementRow
              label={t.laporan.pnl.totalRevenueLabel}
              value={pnl ? formatRupiah(pnl.revenue) : "Rp —"}
              className="border-b border-border"
              labelClass="py-2 font-bold"
              valueClass="font-extrabold text-success"
            />
            <StatementRow
              label={t.laporan.pnl.expensesLabel}
              className="border-b-2 border-border"
              labelClass="py-2.5 font-bold text-destructive"
            />
            {pnl?.expenseBreakdown.map((item) => (
              <StatementRow
                key={item.categoryName}
                label={item.categoryName}
                value={formatRupiah(item.amount)}
                indent
              />
            ))}
            <StatementRow
              label={t.laporan.pnl.totalExpensesLabel}
              value={pnl ? formatRupiah(pnl.expenses) : "Rp —"}
              className="border-b border-border"
              labelClass="py-2 font-bold"
              valueClass="font-extrabold text-destructive"
            />
            <StatementRow
              label={t.laporan.pnl.netProfitLabel}
              value={pnl ? formatRupiah(pnl.netProfit) : "Rp —"}
              className="border-t-2 border-primary"
              labelClass="py-3 text-[15px] font-extrabold"
              valueClass={
                "text-[16px] font-black " +
                ((pnl?.netProfit ?? 0) >= 0
                  ? "text-success"
                  : "text-destructive")
              }
            />
            <StatementRow
              label={t.laporan.pnl.netMarginLabel}
              value={netMargin}
              labelClass="py-1 text-[11px] text-muted-foreground"
              valueClass="text-[11px] text-muted-foreground"
            />
          </tbody>
        </table>
        <div className="mt-2 text-right text-[11px] text-muted-foreground">
          {t.laporan.pnl.directionNotePrefix}{" "}
          <button
            type="button"
            onClick={() => router.push("/mastercoa")}
            className="cursor-pointer font-semibold text-primary hover:underline"
          >
            {t.laporan.pnl.masterCoaLink}
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Section: Balance Sheet ───────────────────────── */

function BalanceSection({
  balanceSheet,
  isLoading,
  dashboardNetWorth,
  isDashboardNetWorthLoading,
  reconciliationBridge,
  isBridgeLoading,
}: {
  balanceSheet?: BalanceSheetDto;
  isLoading?: boolean;
  /** Independently computed net worth from a different service/query path
   * (`/dashboard/net-worth`) — the only genuine cross-check available; see
   * computeBalanceSheetIdentity's doc comment for why an in-payload check
   * can never be falsifiable here. */
  dashboardNetWorth?: NetWorthDto;
  isDashboardNetWorthLoading?: boolean;
  /** EPIC-023 B3 (D24, US-RPT-11) — why profit and net-worth change disagree. */
  reconciliationBridge?: ReconciliationBridgeDto;
  isBridgeLoading?: boolean;
}) {
  const { t, locale } = useLocale();
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const hasData = balanceSheet ? balanceSheet.dataAvailable !== false : true;
  // EPIC-023 Task B retry (CRITICAL 2) — distinct from the generic "no
  // snapshot for this date" case: a snapshot DOES exist, it just cannot be
  // shown to this viewer (see `restrictedForViewer`'s doc comment on the
  // contract).
  const isRestrictedForViewer = balanceSheet?.restrictedForViewer === true;
  const asOf = balanceSheet
    ? formatLocaleDateLong(balanceSheet.asOfDate, locale)
    : "—";
  const debtRatio =
    balanceSheet && balanceSheet.totalAssets > 0
      ? `${Math.round((balanceSheet.totalLiabilities / balanceSheet.totalAssets) * 100 * 10) / 10}%`
      : "—";

  // EPIC-022 B1 — the "Total L+E" row always shows the real value (Total
  // Liabilities + Equity), never a re-display of totalAssets. The ✅/⚠️
  // banner below is a SEPARATE cross-source check — see
  // computeBalanceSheetIdentity's doc comment for why two prior in-payload
  // comparisons were both unfalsifiable, and why comparing against the
  // dashboard's independently computed net worth is the one that isn't.
  const { totalLiabilitiesPlusEquity, diff, isBalanced } =
    computeBalanceSheetIdentity(
      balanceSheet ?? { totalLiabilities: 0, netWorth: 0 },
      dashboardNetWorth,
    );
  // EPIC-023 Task B retry (HIGH) — `dashboardNetWorth` is always LIVE (no
  // date param on `/dashboard/net-worth`), so this cross-check is only
  // meaningful when `balanceSheet` is ALSO a live/current figure
  // (`isHistorical === false`). Comparing a historical snapshot against
  // today's live net worth would fire a false "⚠️ Tidak Seimbang" on every
  // past period, even when the books genuinely reconcile.
  const identityCheckApplicable =
    Boolean(balanceSheet) && hasData && balanceSheet?.isHistorical === false;
  const isCheckPending =
    identityCheckApplicable &&
    (isDashboardNetWorthLoading || isBalanced === null);

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div>
        <div className="text-[15px] font-bold">
          {t.laporan.balance.titlePrefix} {asOf}
        </div>
        {/* EPIC-023 B2 (closes EPIC-022 B11) — figures now come from a real
            `NetWorthSnapshot` when one exists (`isHistorical`); the "these
            are current balances, not historical" disclosure only applies to
            the live-fallback path (a family with no snapshot history yet). */}
        {balanceSheet && hasData && !balanceSheet.isHistorical && (
          <div className="text-[10.5px] text-muted-foreground">
            {t.laporan.balance.currentBalanceDisclosure}
          </div>
        )}
      </div>
      {balanceSheet && !hasData && (
        <div className="flex items-start gap-3 rounded-[12px] border border-border bg-muted/40 p-3.5">
          <div className="text-[22px]">
            {isRestrictedForViewer ? "🔒" : "🕘"}
          </div>
          <div>
            <div className="text-[13px] font-bold">
              {isRestrictedForViewer
                ? t.laporan.balance.restrictedForViewerTitle
                : t.laporan.balance.noDataTitle}
            </div>
            <div className="text-[12px] text-muted-foreground">
              {isRestrictedForViewer
                ? t.laporan.balance.restrictedForViewerDescription
                : t.laporan.balance.noDataDescription}
            </div>
          </div>
        </div>
      )}
      {/* EPIC-023 Task B retry (CRITICAL 3) — without real figures behind
          it, the asset/liability tables below used to render a fake
          "Total Aset: Rp 0" / "Net Worth: 0" over the honest banner above. */}
      {hasData && (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <SectionCard
            title={
              <span className="text-success">
                {t.laporan.balance.assetLabel}
              </span>
            }
          >
            <table className="w-full border-collapse text-[12.5px]">
              <tbody>
                {balanceSheet?.assets.map((group) => (
                  <Fragment key={`g-${group.category}`}>
                    <StatementRow
                      label={group.category}
                      labelClass="py-1.5 font-bold text-muted-foreground"
                    />
                    {group.items.map((item) => (
                      <StatementRow
                        key={item.name}
                        label={item.name}
                        value={formatJuta(item.amount)}
                        indent
                      />
                    ))}
                  </Fragment>
                ))}
                <StatementRow
                  label={t.laporan.totalAssetsLabel}
                  value={
                    balanceSheet ? formatJuta(balanceSheet.totalAssets) : "—"
                  }
                  className="border-t-2 border-success"
                  labelClass="py-2 font-extrabold"
                  valueClass="font-extrabold text-success"
                />
              </tbody>
            </table>
          </SectionCard>
          <SectionCard
            title={
              <span className="text-destructive">
                {t.laporan.balance.liabilityEquityLabel}
              </span>
            }
          >
            <table className="w-full border-collapse text-[12.5px]">
              <tbody>
                <StatementRow
                  label={t.laporan.balance.liabilitiesLabel}
                  labelClass="py-1.5 font-bold text-muted-foreground"
                />
                {balanceSheet?.liabilities.map((group) => (
                  <Fragment key={`g-${group.category}`}>
                    <StatementRow
                      label={group.category}
                      labelClass="py-1 text-[11px] text-muted-foreground"
                      indent
                    />
                    {group.items.map((item) => (
                      <StatementRow
                        key={item.name}
                        label={item.name}
                        value={formatJuta(item.amount)}
                        indent
                      />
                    ))}
                  </Fragment>
                ))}
                <StatementRow
                  label={t.laporan.totalLiabilitiesLabel}
                  value={
                    balanceSheet
                      ? formatJuta(balanceSheet.totalLiabilities)
                      : "—"
                  }
                  className="border-b border-border"
                  labelClass="py-1.5 font-bold"
                  valueClass="font-bold text-destructive"
                />
                <StatementRow
                  label={t.laporan.balance.equityLabel}
                  labelClass="py-1.5 font-bold text-muted-foreground"
                />
                <StatementRow
                  label={t.laporan.netWorthLabel}
                  value={balanceSheet ? formatJuta(balanceSheet.netWorth) : "—"}
                  indent
                />
                <StatementRow
                  label={t.laporan.balance.totalLPlusELabel}
                  value={
                    balanceSheet ? formatJuta(totalLiabilitiesPlusEquity) : "—"
                  }
                  className="border-t-2 border-primary"
                  labelClass="py-2 font-extrabold"
                  valueClass="font-extrabold text-primary"
                />
              </tbody>
            </table>
          </SectionCard>
        </div>
      )}
      {isCheckPending && (
        <div className="flex items-center gap-2 rounded-[12px] border border-border bg-muted/40 p-3 text-[12px] text-muted-foreground">
          {t.laporan.balance.checkingLabel}
        </div>
      )}
      {identityCheckApplicable && isBalanced === true && (
        <div className="flex items-start gap-3 rounded-[12px] border border-primary/20 bg-accent p-3.5">
          <div className="text-[22px]">✅</div>
          <div>
            <div className="text-[13px] font-bold text-primary-strong">
              {t.laporan.balance.balancedTitle}
            </div>
            <div className="text-[12px] text-muted-foreground">
              {t.laporan.balance.balancedDescPrefix} {debtRatio}.
            </div>
          </div>
        </div>
      )}
      {identityCheckApplicable && isBalanced === false && (
        <div className="flex items-start gap-3 rounded-[12px] border border-warning/30 bg-warning-soft p-3.5">
          <div className="text-[22px]">⚠️</div>
          <div>
            <div className="text-[13px] font-bold text-warning">
              {t.laporan.balance.imbalancedTitle}
            </div>
            <div className="text-[12px] text-muted-foreground">
              {t.laporan.balance.imbalancedDescPrefix}{" "}
              {formatRupiah(Math.abs(diff))}.
            </div>
          </div>
        </div>
      )}
      <ReconciliationBridgeCard
        bridge={reconciliationBridge}
        isLoading={isBridgeLoading}
      />
    </div>
  );
}

/**
 * EPIC-023 B3 (D24, US-RPT-11; rewrite, attempt 3) — answers "why is my
 * profit X but my wealth up Y" on screen: opening/closing net worth from
 * the snapshots, profit, a `contribution` figure, a single combined
 * asset+investment `holdingsChange` figure, and — only when non-zero — an
 * honestly-named `unexplained` residual (see `getReconciliationBridge`'s
 * doc comment on the API side for why the identity does not always hold,
 * e.g. a Receivable movement).
 *
 * EPIC-023 Task B3 review (HIGH x2, FIX 1) — every row from Opening through
 * Unexplained is now a real addend of the identity `opening + profit −
 * contribution + holdingsChange + unexplained = closing`, and reading the
 * table top to bottom sums to `bridgeClosingLabel`'s value. Previously
 * `contribution` was rendered as a small indented `↳` memo showing its raw
 * (unsubtracted) sign — reading the rows top to bottom produced a number
 * that did NOT match Closing. The contribution row now displays
 * `-bridge.contribution` (the amount it actually subtracts from the running
 * total), at full size, not as a memo.
 */
function ReconciliationBridgeCard({
  bridge,
  isLoading,
}: {
  bridge?: ReconciliationBridgeDto;
  isLoading?: boolean;
}) {
  const { t } = useLocale();
  if (!bridge) return null;
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  // EPIC-023 Task B retry (CRITICAL 2) — distinct from the generic "not
  // enough history" no-data case: a snapshot exists, it just cannot be
  // shown to this viewer (see `restrictedForViewer`'s doc comment).
  const isRestrictedForViewer = bridge.restrictedForViewer === true;
  // EPIC-023 Task B3 review (LOW, batch fix 6) — the `bridge.dataAvailable
  // &&` clause used to be here too, but this value is only ever read inside
  // the `bridge.dataAvailable === true` branch below, so it was dead.
  // `Number.isFinite` guards against a deploy-skew payload (an older API
  // build, or a network hiccup) delivering `undefined`/`NaN` for
  // `unexplained` — treat that as "no warning" rather than rendering NaN.
  const hasUnexplained =
    Number.isFinite(bridge.unexplained) && bridge.unexplained !== 0;
  const netWorthChange = bridge.closing - bridge.opening;

  return (
    <SectionCard
      title={t.laporan.balance.bridgeTitle}
      bodyClassName={loadingClass}
    >
      <div className="text-[11.5px] text-muted-foreground mb-2">
        {t.laporan.balance.bridgeDescription}
      </div>
      {!bridge.dataAvailable ? (
        <div className="text-[12px] text-muted-foreground">
          {isRestrictedForViewer
            ? t.laporan.balance.bridgeRestrictedDescription
            : t.laporan.balance.bridgeNoDataDescription}
        </div>
      ) : (
        <table className="w-full border-collapse text-[12.5px]">
          <tbody>
            <StatementRow
              label={t.laporan.balance.bridgeOpeningLabel}
              value={formatJuta(bridge.opening)}
              labelClass="py-1.5 font-semibold text-muted-foreground"
            />
            <StatementRow
              label={t.laporan.balance.bridgeProfitLabel}
              value={formatJuta(bridge.profit)}
              indent
            />
            {/* A real subtrahend now, not a memo — displays the SIGNED
                amount this row actually subtracts from the running total
                (`-bridge.contribution`), so it participates correctly in
                the top-to-bottom sum. */}
            <StatementRow
              label={t.laporan.balance.bridgeContributionLabel}
              value={formatJuta(-bridge.contribution)}
              indent
            />
            <StatementRow
              label={t.laporan.balance.bridgeHoldingsChangeLabel}
              value={formatJuta(bridge.holdingsChange)}
              indent
            />
            {/* Shown only when non-zero — an honest residual, not a term
                that is always present. See this component's doc comment.
                EPIC-023 Task B3 review (MEDIUM, FIX 5) — an icon and bold
                text carry the warning, not colour alone. */}
            {hasUnexplained && (
              <StatementRow
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true">⚠️</span>
                    <span className="font-bold">
                      <span className="sr-only">
                        {t.laporan.balance.bridgeUnexplainedWarningPrefix}{" "}
                      </span>
                      {t.laporan.balance.bridgeUnexplainedLabel}
                    </span>
                  </span>
                }
                value={formatJuta(bridge.unexplained)}
                indent
                labelClass="py-1.5 text-warning"
                valueClass="font-bold text-warning"
              />
            )}
            <StatementRow
              label={t.laporan.balance.bridgeClosingLabel}
              value={formatJuta(bridge.closing)}
              className="border-t-2 border-primary"
              labelClass="py-2 font-extrabold"
              valueClass="font-extrabold text-primary"
            />
            <StatementRow
              label={t.laporan.balance.bridgeNetWorthChangeLabel}
              value={formatJuta(netWorthChange)}
              labelClass="pt-2 text-muted-foreground"
              valueClass="text-muted-foreground"
            />
          </tbody>
        </table>
      )}
    </SectionCard>
  );
}

/* ───────────────────────── Section: Cashflow ───────────────────────── */

function CashflowSection({
  cashflow,
  isLoading,
  periodLabel,
}: {
  cashflow?: CashflowStatementDto;
  isLoading?: boolean;
  periodLabel: string;
}) {
  const { t } = useLocale();
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const bulan = periodLabel;
  // EPIC-022 B2 — a negative net figure must render with a real minus sign;
  // the previous inline `fmt()` silently turned every negative into a bare
  // positive number via `Math.abs()`, distinguished only by colour.
  const fmt = formatSignedRupiah;

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="text-[15px] font-bold">
        {t.laporan.cashflow.titlePrefix} {bulan}
      </div>
      <SectionCard>
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            <StatementRow
              label={t.laporan.cashflow.operatingLabel}
              className="border-b-2 border-border"
              labelClass="py-2.5 font-bold text-primary"
            />
            <StatementRow
              label={t.laporan.cashflow.totalInflowLabel}
              value={cashflow ? fmt(cashflow.operatingInflows) : "Rp —"}
              indent
              valueColor="var(--success)"
            />
            <StatementRow
              label={t.laporan.cashflow.totalOutflowLabel}
              value={
                cashflow
                  ? `-${formatRupiah(cashflow.operatingOutflows)}`
                  : "Rp —"
              }
              indent
              valueColor="var(--destructive)"
            />
            <StatementRow
              label={t.laporan.cashflow.netOperatingLabel}
              value={cashflow ? fmt(cashflow.netOperating) : "Rp —"}
              className="border-b border-border"
              labelClass="py-2 font-bold"
              valueClass={
                "font-extrabold " +
                ((cashflow?.netOperating ?? 0) >= 0
                  ? "text-success"
                  : "text-destructive")
              }
            />
            <StatementRow
              label={t.laporan.cashflow.investingLabel}
              className="border-b-2 border-border"
              labelClass="py-2.5 font-bold text-brand-purple"
            />
            {/* EPIC-022 B3 — investing cashflow is not tracked yet (always
                hard-coded to zero server-side); disclose that plainly
                instead of printing "Rp 0" as if it were measured. */}
            <StatementRow
              label={t.laporan.cashflow.netInvestingLabel}
              value={
                cashflow ? t.laporan.cashflow.investingUntrackedLabel : "Rp —"
              }
              className="border-b border-border"
              labelClass="py-2 font-bold"
              valueClass="font-extrabold text-muted-foreground"
            />
            <StatementRow
              label={t.laporan.cashflow.netCashflowLabel}
              value={cashflow ? fmt(cashflow.netChange) : "Rp —"}
              className="border-t-2 border-primary"
              labelClass="py-3 text-[15px] font-extrabold"
              valueClass={
                "text-[16px] font-black " +
                ((cashflow?.netChange ?? 0) >= 0
                  ? "text-success"
                  : "text-destructive")
              }
            />
          </tbody>
        </table>
        {cashflow && (
          <div className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
            {t.laporan.cashflow.investingDisclosure}
          </div>
        )}
      </SectionCard>
      {/* EPIC-022 B3 — Saldo Awal/Akhir moved out of the INVESTING block
          into their own section; they are derived backward from current
          account balances, not point-in-time historical values, so they get
          their own disclosure rather than sitting silently inside a cashflow
          statement's investing lines. */}
      {cashflow && (
        <SectionCard title={t.laporan.cashflow.balanceSectionTitle}>
          <table className="w-full border-collapse text-[13px]">
            <tbody>
              <StatementRow
                label={t.laporan.cashflow.openingBalanceLabel}
                value={formatRupiah(cashflow.openingBalance)}
                valueColor="var(--muted-foreground)"
              />
              <StatementRow
                label={t.laporan.cashflow.closingBalanceLabel}
                value={formatRupiah(cashflow.closingBalance)}
                valueColor="var(--muted-foreground)"
              />
            </tbody>
          </table>
          <div className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
            {t.laporan.cashflow.balanceDisclosure}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

/* ───────────────────────── Section: Arus Kas ───────────────────────── */

function KasSection({
  summary,
  isLoading,
}: {
  summary?: ReportSummaryDto;
  isLoading?: boolean;
}) {
  const { t } = useLocale();
  const chartMonths = summary?.points.map((p) => p.label) ?? [];
  // EPIC-025 N3-G2 — raw Rupiah series, same reasoning as `RingkasanSection`
  // above (the old /1_000_000 was a pixel-scale factor, not a data change).
  const chartIncome = summary?.points.map((p) => p.income) ?? [];
  const chartExpense = summary?.points.map((p) => p.expense) ?? [];
  const cashflowChartAriaLabel =
    summary && chartMonths.length > 0
      ? `${t.laporan.kas.title} ${chartMonths[chartMonths.length - 1]}: ${t.common.income} ${formatRupiah(chartIncome[chartIncome.length - 1] ?? 0)}, ${t.common.expense} ${formatRupiah(chartExpense[chartExpense.length - 1] ?? 0)}`
      : t.laporan.kas.title;

  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <SectionCard title={t.laporan.kas.title}>
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          <MoneyStat
            label={t.common.income}
            value={summary ? formatRupiah(summary.totalIncome) : "Rp —"}
            valueClass="text-success"
          />
          <MoneyStat
            label={t.common.expense}
            value={summary ? formatRupiah(summary.totalExpense) : "Rp —"}
            valueClass="text-destructive"
          />
          <MoneyStat
            label={t.laporan.surplusLabel}
            value={summary ? formatRupiah(summary.netSavings) : "Rp —"}
            valueClass="text-success"
          />
          <MoneyStat
            label={t.laporan.savingsRateLabel}
            value={summary ? `${summary.savingsRate}%` : "—"}
            valueClass="text-primary"
          />
        </div>
        {chartMonths.length > 0 && (
          <div className="mt-4">
            {/* EPIC-025 N3-G2 — BarChart → CashflowChart (Apex). */}
            <CashflowChart
              months={chartMonths}
              income={chartIncome}
              expense={chartExpense}
              height={110}
              ariaLabel={cashflowChartAriaLabel}
            />
          </div>
        )}
      </SectionCard>
      <SectionCard title={t.laporan.kas.incomeSourcesTitle}>
        {summary?.topIncomeCategories &&
        summary.topIncomeCategories.length > 0 ? (
          summary.topIncomeCategories.map((cat, i) => (
            <ActItem
              key={cat.categoryName}
              icon="💼"
              iconBg="#DCFCE7"
              name={cat.categoryName}
              right={
                <>
                  <div className="text-[13px] font-bold text-success">
                    {formatRupiah(cat.amount)}
                  </div>
                  <StatusBadge variant="success">{cat.percentage}%</StatusBadge>
                </>
              }
              last={i === summary.topIncomeCategories.length - 1}
            />
          ))
        ) : (
          <div className="py-4 text-center text-[12px] text-muted-foreground">
            {t.laporan.kas.emptyIncome}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Section: Investasi ───────────────────────── */

const INV_TYPE_COLORS: Record<InvestmentType, string> = {
  saham: "var(--brand-cyan)",
  reksa_dana: "var(--primary)",
  obligasi: "var(--success)",
  emas: "var(--warning)",
  kripto: "#F97316",
  lainnya: "#8B5CF6",
  // EPIC-024 C2/C3 (D10).
  deposito: "#0F766E",
};

function InvSection({
  investments,
  invSummary,
  isLoading,
  onAdd,
  onEdit,
  onDelete,
}: {
  investments?: InvestmentDto[];
  invSummary?: InvestmentSummaryDto;
  isLoading?: boolean;
  onAdd?: () => void;
  onEdit?: (inv: InvestmentDto) => void;
  onDelete?: (inv: InvestmentDto) => void;
}) {
  const { t } = useLocale();
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";

  const byType = new Map<InvestmentType, number>();
  for (const inv of investments ?? []) {
    // EPIC-022 B9 (CRITICAL fix) — inv.currentValue is already the total
    // position value; only the costBasisPerUnit fallback is per-unit. See
    // investmentCurrentValue's doc comment for the exact inflation bug this
    // replaces (price × quantity² whenever a market price existed).
    const val = investmentCurrentValue(inv);
    byType.set(inv.type, (byType.get(inv.type) ?? 0) + val);
  }

  const totalValue = parseFloat(invSummary?.totalCurrentValue ?? "0");
  const totalReturnRp = parseFloat(invSummary?.totalReturnRp ?? "0");
  const totalReturnPct = invSummary?.totalReturnPct ?? 0;

  const typeRows = Array.from(byType.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([type, value]) => ({
      label: t.laporan.investasi.typeLabels[type],
      color: INV_TYPE_COLORS[type],
      value,
      pct: totalValue > 0 ? Math.round((value / totalValue) * 100) : 0,
    }));

  const maxValue = typeRows[0]?.value ?? 0;

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="flex items-center justify-between">
        <div className="text-[15px] font-bold">
          {t.laporan.investasi.sectionTitle}
        </div>
        {onAdd && (
          <button
            onClick={onAdd}
            className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:opacity-90"
          >
            + {t.common.add}
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <div className="rounded-[12px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">
            {t.laporan.investasi.totalPortfolioLabel}
          </div>
          <div className="text-[22px] font-black text-primary">
            {invSummary ? formatRupiah(totalValue) : "Rp —"}
          </div>
          {invSummary && totalValue > 0 && (
            <div
              className={
                "mt-1 text-[12px] " +
                (totalReturnRp >= 0 ? "text-success" : "text-destructive")
              }
            >
              {totalReturnRp >= 0 ? "▲" : "▼"}{" "}
              {Math.abs(totalReturnPct).toFixed(2)}% ·{" "}
              {totalReturnRp >= 0 ? "+" : "-"}
              {formatRupiah(Math.abs(totalReturnRp))}
            </div>
          )}
        </div>
        <div className="rounded-[12px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">
            {t.laporan.investasi.totalReturnLabel}
          </div>
          <div
            className={
              "text-[22px] font-black " +
              (totalReturnPct >= 0 ? "text-success" : "text-destructive")
            }
          >
            {invSummary
              ? `${totalReturnPct >= 0 ? "+" : ""}${totalReturnPct.toFixed(2)}%`
              : "—"}
          </div>
          <div className="mt-1 text-[12px] text-muted-foreground">
            {investments
              ? `${investments.length} ${t.laporan.investasi.instrumentCountSuffix}`
              : "—"}
          </div>
        </div>
      </div>
      <SectionCard title={t.laporan.investasi.portfolioByTypeTitle}>
        {typeRows.length > 0 ? (
          <div className="flex flex-col gap-3.5">
            {/* EPIC-026 Wave 3 — prototype's `#c-rinv` mount is the Apex
                donut preset (J3 FOLD), over the SAME by-type totals the
                allocation rows below already sum; the rows stay, matching
                the prototype's donut + allocation-row pairing. Legend
                hidden — the rows below are the one legend for this card. */}
            <div className="[&_.apexcharts-legend]:hidden">
              <DonutChart
                segments={typeRows.map((row) => ({
                  label: row.label,
                  value: row.value,
                  color: row.color,
                }))}
                centerLabel={t.laporan.investasi.totalPortfolioLabel}
                height={230}
                ariaLabel={`${t.laporan.investasi.portfolioByTypeTitle}: ${typeRows
                  .map((row) => `${row.label} ${row.pct}%`)
                  .join(", ")}`}
              />
            </div>
            <div className="flex flex-col gap-2.5">
              {typeRows.map((row) => (
                <BarRow
                  key={row.label}
                  label={row.label}
                  right={
                    <span className="font-bold" style={{ color: row.color }}>
                      {formatRupiah(row.value)} · {row.pct}%
                    </span>
                  }
                  value={
                    maxValue > 0 ? Math.round((row.value / maxValue) * 100) : 0
                  }
                  color={row.color}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="py-4 text-center text-[12px] text-muted-foreground">
            {t.laporan.investasi.emptyInvestment}{" "}
            {onAdd && (
              <button
                onClick={onAdd}
                className="text-primary underline underline-offset-2"
              >
                {t.laporan.investasi.addNowLink}
              </button>
            )}
          </div>
        )}
      </SectionCard>
      {investments && investments.length > 0 && (
        <SectionCard title={t.laporan.investasi.instrumentListTitle}>
          <div className="w-full overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-semibold">
                    {t.laporan.investasi.colName}
                  </th>
                  <th className="py-2 font-semibold">
                    {t.laporan.investasi.colType}
                  </th>
                  <th className="py-2 font-semibold">
                    {t.laporan.investasi.colValue}
                  </th>
                  <th className="py-2 font-semibold">
                    {t.laporan.investasi.colReturn}
                  </th>
                  {(onEdit ?? onDelete) && (
                    <th className="py-2 font-semibold"></th>
                  )}
                </tr>
              </thead>
              <tbody>
                {investments.map((inv) => {
                  // EPIC-022 B9 — use the same current-value basis as the
                  // portfolio-by-type breakdown above and `invSummary` (see
                  // investmentCurrentValue: currentValue is already a total,
                  // not per-unit — do NOT multiply it by quantity again), so
                  // this table never disagrees with the totals shown
                  // elsewhere on this tab.
                  const val = investmentCurrentValue(inv);
                  const ret = parseFloat(inv.returnRp ?? "0");
                  const typeLabel = t.laporan.investasi.typeLabels[inv.type];
                  return (
                    <tr key={inv.id} className="border-b last:border-0">
                      <td className="py-2.5">
                        <div className="font-semibold">{inv.ticker}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {inv.name}
                        </div>
                      </td>
                      <td className="py-2.5 text-[11px]">
                        {typeLabel ?? inv.type}
                      </td>
                      <td className="mono py-2.5">
                        {val > 0 ? formatRupiah(val) : "—"}
                      </td>
                      <td
                        className={
                          "mono py-2.5 " +
                          (ret >= 0 ? "text-success" : "text-destructive")
                        }
                      >
                        {inv.returnPct !== null
                          ? `${ret >= 0 ? "+" : ""}${(inv.returnPct ?? 0).toFixed(1)}%`
                          : "—"}
                      </td>
                      {(onEdit ?? onDelete) && (
                        <td className="py-2.5">
                          <div className="flex gap-2">
                            {onEdit && (
                              <button
                                onClick={() => onEdit(inv)}
                                className="text-[11px] text-primary hover:underline"
                              >
                                {t.laporan.investasi.editLink}
                              </button>
                            )}
                            {onDelete && (
                              <button
                                onClick={() => onDelete(inv)}
                                className="text-[11px] text-destructive hover:underline"
                              >
                                {t.common.delete}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

/* ───────────────────────── Section: Aset & Liabilitas ───────────────────────── */

function AslSection({
  balanceSheet,
  isLoading,
}: {
  balanceSheet?: BalanceSheetDto;
  isLoading?: boolean;
}) {
  const { t } = useLocale();
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const debtRatio =
    balanceSheet && balanceSheet.totalAssets > 0
      ? Math.round(
          (balanceSheet.totalLiabilities / balanceSheet.totalAssets) * 100 * 10,
        ) / 10
      : null;

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <div className="rounded-[12px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">
            {t.laporan.totalAssetsLabel}
          </div>
          <div className="text-[22px] font-black text-success">
            {balanceSheet ? formatRupiah(balanceSheet.totalAssets) : "Rp —"}
          </div>
        </div>
        <div className="rounded-[12px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">
            {t.laporan.totalLiabilitiesLabel}
          </div>
          <div className="text-[22px] font-black text-destructive">
            {balanceSheet
              ? `-${formatRupiah(balanceSheet.totalLiabilities)}`
              : "Rp —"}
          </div>
        </div>
      </div>
      {/* EPIC-026 Wave 3 — prototype's `#c-rasl` mount is the Apex hbar
          preset (J3 FOLD): every asset category then every liability
          category side by side, from the same balance-sheet breakdown
          this section already fetches. */}
      {balanceSheet &&
        (balanceSheet.assets.length > 0 ||
          balanceSheet.liabilities.length > 0) && (
          <SectionCard title={t.shell.reportTabs.rasl}>
            <HBarChart
              categories={[
                ...balanceSheet.assets.map((g) => g.category),
                ...balanceSheet.liabilities.map((g) => g.category),
              ]}
              data={[
                ...balanceSheet.assets.map((g) => g.amount),
                ...balanceSheet.liabilities.map((g) => g.amount),
              ]}
              ariaLabel={`${t.shell.reportTabs.rasl}: ${[
                ...balanceSheet.assets,
                ...balanceSheet.liabilities,
              ]
                .map((g) => `${g.category} ${formatRupiah(g.amount)}`)
                .join(", ")}`}
            />
          </SectionCard>
        )}
      <SectionCard title={t.laporan.asetLiabilitas.ratioTitle}>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md bg-muted p-3">
            <div className="text-[10.5px] text-muted-foreground">
              {t.laporan.asetLiabilitas.debtRatioLabel}
            </div>
            <div
              className="text-[20px] font-extrabold"
              style={{
                color:
                  debtRatio !== null && debtRatio < 30
                    ? "var(--success)"
                    : "var(--warning)",
              }}
            >
              {debtRatio !== null ? `${debtRatio}%` : "—"}
            </div>
            <div
              className="text-[10.5px]"
              style={{
                color:
                  debtRatio !== null && debtRatio < 30
                    ? "var(--success)"
                    : "var(--warning)",
              }}
            >
              {debtRatio !== null && debtRatio < 30
                ? t.laporan.asetLiabilitas.safeLabel
                : t.laporan.asetLiabilitas.warningLabel}
            </div>
          </div>
          <div className="rounded-md bg-muted p-3">
            <div className="text-[10.5px] text-muted-foreground">
              {t.laporan.netWorthLabel}
            </div>
            <div
              className="text-[20px] font-extrabold"
              style={{ color: "var(--success)" }}
            >
              {balanceSheet ? formatJuta(balanceSheet.netWorth) : "—"}
            </div>
            <div className="text-[10.5px]" style={{ color: "var(--success)" }}>
              {t.laporan.asetLiabilitas.netWorthDesc}
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Section: Performa ───────────────────────── */

function PerfSection({
  summary,
  invSummary,
  isLoading,
}: {
  summary?: ReportSummaryDto;
  invSummary?: InvestmentSummaryDto;
  isLoading?: boolean;
}) {
  const { t } = useLocale();
  const savingsRate = summary?.savingsRate ?? null;
  const invReturn = invSummary?.totalReturnPct ?? null;
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <SectionCard title={t.laporan.performa.title}>
        {/* EPIC-026 Wave 3 — prototype's `#c-rperf` mount is the Apex
            radial preset (J3 FOLD) beside the indicator list. The
            prototype's own radial ("Dana Darurat", months of emergency
            fund) needs a liquid-balance-vs-monthly-expense figure this
            section does not fetch — the radial gauges the savings rate,
            the same indicator the first row below tracks. */}
        {savingsRate !== null && (
          <div className="mb-3.5">
            <RadialChart
              value={Math.max(0, Math.min(100, savingsRate))}
              label={t.laporan.savingsRateLabel}
              height={200}
              ariaLabel={`${t.laporan.performa.savingsRateTargetLabel}: ${savingsRate}%`}
            />
          </div>
        )}
        <div className="flex flex-col gap-2.5">
          {savingsRate !== null && (
            <BarRow
              label={t.laporan.performa.savingsRateTargetLabel}
              right={
                <StatusBadge
                  variant={
                    savingsRate >= 30
                      ? "success"
                      : savingsRate >= 20
                        ? "warning"
                        : "danger"
                  }
                >
                  {savingsRate}%
                  {savingsRate >= 30
                    ? t.laporan.performa.achievedSuffix
                    : t.laporan.performa.needsImprovementSuffix}
                </StatusBadge>
              }
              value={Math.min(savingsRate, 100)}
              color={
                savingsRate >= 30
                  ? "var(--success)"
                  : savingsRate >= 20
                    ? "var(--warning)"
                    : "var(--destructive)"
              }
            />
          )}
          {invReturn !== null && (
            <BarRow
              label={t.laporan.performa.investReturnTargetLabel}
              right={
                <StatusBadge
                  variant={
                    invReturn >= 12
                      ? "success"
                      : invReturn >= 0
                        ? "warning"
                        : "danger"
                  }
                >
                  {invReturn.toFixed(1)}%
                  {invReturn >= 12 ? t.laporan.performa.exceededSuffix : ""}
                </StatusBadge>
              }
              value={Math.min(Math.max(invReturn, 0), 100)}
              color={invReturn >= 12 ? "var(--success)" : "var(--warning)"}
            />
          )}
          {savingsRate === null && invReturn === null && (
            <div className="py-6 text-center text-[12px] text-muted-foreground">
              {t.laporan.performa.emptyPerf}
            </div>
          )}
        </div>
        <div className="mt-3 text-[11px] text-muted-foreground">
          {t.laporan.performa.noteText}
        </div>
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Section: Pajak ───────────────────────── */

function PajakSection({
  pph21,
  grossIncome,
  isLoading,
}: {
  pph21?: Pph21ResultDto;
  grossIncome?: number;
  isLoading?: boolean;
}) {
  const { t } = useLocale();
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const hasIncome = grossIncome != null && grossIncome > 0;

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="text-[15px] font-bold">{t.laporan.pajak.title}</div>

      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <StatTile
          label={t.laporan.pajak.grossYearLabel}
          value={grossIncome != null ? formatRupiah(grossIncome) : "Rp —"}
        />
        <StatTile
          label={t.laporan.pajak.pkpLabel}
          value={pph21 ? formatRupiah(pph21.pkp) : "Rp —"}
        />
        <StatTile
          label={t.laporan.pajak.estimatedTaxLabel}
          value={pph21 ? formatRupiah(pph21.totalTax) : "Rp —"}
          valueClass="text-destructive"
        />
        <StatTile
          label={t.laporan.pajak.effectiveRateLabel}
          value={pph21 ? `${(pph21.effectiveRate * 100).toFixed(2)}%` : "—"}
          valueClass="text-primary"
        />
      </div>

      <SectionCard title={t.laporan.pajak.calcTitle}>
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            <StatementRow
              label={t.laporan.pajak.grossIncomeLabel}
              value={grossIncome != null ? formatRupiah(grossIncome) : "Rp —"}
            />
            <StatementRow
              label={t.laporan.pajak.laborCostLabel}
              value={pph21 ? `-${formatRupiah(pph21.biayaJabatan)}` : "Rp —"}
              indent
            />
            <StatementRow
              label={t.laporan.pajak.ptkpLabel}
              value={pph21 ? `-${formatRupiah(pph21.ptkp)}` : "Rp —"}
              indent
            />
            {pph21 && pph21.zakatDeduction > 0 && (
              <StatementRow
                label={t.laporan.pajak.zakatDeductionLabel}
                value={`-${formatRupiah(pph21.zakatDeduction)}`}
                indent
              />
            )}
            <StatementRow
              label={t.laporan.pajak.pkpFullLabel}
              value={pph21 ? formatRupiah(pph21.pkp) : "Rp —"}
              className="border-t border-border"
              labelClass="py-2 font-bold"
              valueClass="font-extrabold"
            />
          </tbody>
        </table>
      </SectionCard>

      {pph21 && pph21.taxBreakdown.length > 0 && (
        <SectionCard title={t.laporan.pajak.bracketBreakdownTitle}>
          <div className="w-full overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-semibold">
                    {t.laporan.pajak.colBracket}
                  </th>
                  <th className="py-2 font-semibold">
                    {t.laporan.pajak.colTaxBase}
                  </th>
                  <th className="py-2 font-semibold">
                    {t.laporan.pajak.colRate}
                  </th>
                  <th className="py-2 text-right font-semibold">
                    {t.laporan.pajak.colTax}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pph21.taxBreakdown.map((b) => (
                  <tr key={b.bracket} className="border-b last:border-0">
                    <td className="py-2.5">{b.bracket}</td>
                    <td className="mono py-2.5">
                      {formatRupiah(b.taxableAmount)}
                    </td>
                    <td className="py-2.5">{(b.rate * 100).toFixed(0)}%</td>
                    <td className="mono py-2.5 text-right text-destructive">
                      {formatRupiah(b.tax)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-primary">
                  <td className="py-2.5 font-extrabold" colSpan={3}>
                    {t.laporan.pajak.totalTaxYearLabel}
                  </td>
                  <td className="mono py-2.5 text-right text-[14px] font-black text-destructive">
                    {formatRupiah(pph21.totalTax)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {!isLoading && !hasIncome && (
        <div className="rounded-[12px] border p-6 text-center text-[12px] text-muted-foreground">
          {t.laporan.pajak.emptyIncomeNote}
        </div>
      )}

      <div className="flex items-start gap-3 rounded-[12px] border border-primary/20 bg-accent p-3.5">
        <div className="text-[20px]">🧾</div>
        <div className="flex-1 text-[12px] text-muted-foreground">
          {t.laporan.pajak.estimateNoteBefore}{" "}
          <strong>{t.laporan.pajak.estimateNoteBold}</strong>{" "}
          {t.laporan.pajak.estimateNoteAfter}{" "}
          <a
            href="/kalkulator"
            className="font-bold text-primary hover:underline"
          >
            {t.laporan.pajak.calculatorLinkLabel}
          </a>
          .
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── COA Matrix Section ───────────────────────── */

// EPIC-024 Task M (M2, D16, US-RPT-14) — Laporan COA: yearly matrix per COA
// account, columns Jan-Des, rows tanggal 1-31, cell click shows the day's
// transactions. Reuses the same `Dialog`/table primitives every other
// section in this file already imports (no new shared component).

type CoaAccountOption = { id: string; code: string; name: string };

const COA_MATRIX_YEAR_WINDOW = 6;

function CoaSection({
  coaAccounts,
  coaAccountId,
  onCoaAccountIdChange,
  year,
  onYearChange,
  matrix,
  isLoading,
}: {
  coaAccounts: CoaAccountOption[];
  coaAccountId: string;
  onCoaAccountIdChange: (id: string) => void;
  year: number;
  onYearChange: (year: number) => void;
  matrix?: CoaMatrixDto;
  isLoading?: boolean;
}) {
  const { t } = useLocale();
  const currentYear = new Date().getFullYear();
  const [activeCell, setActiveCell] = useState<{
    month: number;
    day: number;
  } | null>(null);

  const monthShortLabels = t.laporan.months.map((label) => label.slice(0, 3));
  const yearOptions = Array.from(
    { length: COA_MATRIX_YEAR_WINDOW },
    (_, i) => currentYear - (COA_MATRIX_YEAR_WINDOW - 2) + i,
  );

  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const hasCells = matrix ? Object.keys(matrix.cells).length > 0 : false;
  const activeCellTxs =
    matrix && activeCell
      ? (matrix.cells[activeCell.month]?.[activeCell.day] ?? [])
      : [];

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="text-[15px] font-bold">{t.laporan.coa.title}</div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1">
          <label
            htmlFor="coa-matrix-account"
            className="text-[11.5px] font-semibold text-muted-foreground"
          >
            {t.laporan.coa.accountLabel}
          </label>
          <select
            id="coa-matrix-account"
            className="w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card"
            value={coaAccountId}
            onChange={(e) => {
              onCoaAccountIdChange(e.target.value);
              setActiveCell(null);
            }}
          >
            <option value="">{t.laporan.coa.accountPlaceholder}</option>
            {coaAccounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.code} — {acc.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="coa-matrix-year"
            className="text-[11.5px] font-semibold text-muted-foreground"
          >
            {t.laporan.coa.yearLabel}
          </label>
          <select
            id="coa-matrix-year"
            className="rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card"
            value={year}
            onChange={(e) => {
              onYearChange(Number(e.target.value));
              setActiveCell(null);
            }}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!coaAccountId ? (
        <SectionCard>
          <div className="py-8 text-center text-[13px] text-muted-foreground">
            {t.laporan.coa.emptyAccount}
          </div>
        </SectionCard>
      ) : (
        <>
          <SectionCard>
            <MoneyStat
              label={t.laporan.coa.totalLabel}
              value={formatRupiah(matrix?.total ?? 0)}
            />
          </SectionCard>

          <SectionCard>
            {!hasCells ? (
              <div className="py-8 text-center text-[13px] text-muted-foreground">
                {t.laporan.coa.emptyMatrix}
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[900px] text-[11px]">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="sticky left-0 bg-card py-2 pr-2 font-semibold">
                        {t.laporan.coa.colTanggal}
                      </th>
                      {monthShortLabels.map((label) => (
                        <th
                          key={label}
                          className="px-1.5 py-2 text-right font-semibold"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <tr key={day} className="border-b last:border-0">
                        <td className="mono sticky left-0 bg-card py-1.5 pr-2 font-semibold">
                          {day}
                        </td>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(
                          (month) => {
                            const cellTxs = matrix?.cells[month]?.[day] ?? [];
                            if (cellTxs.length === 0) {
                              return (
                                <td
                                  key={month}
                                  className="px-1.5 py-1.5 text-right text-muted-foreground"
                                >
                                  —
                                </td>
                              );
                            }
                            const cellTotal = cellTxs.reduce(
                              (s, c) => s + c.amount,
                              0,
                            );
                            return (
                              <td
                                key={month}
                                className="px-1.5 py-1.5 text-right"
                              >
                                <button
                                  type="button"
                                  onClick={() => setActiveCell({ month, day })}
                                  className="mono w-full rounded px-1 py-0.5 text-right font-semibold text-primary hover:bg-accent"
                                >
                                  {formatJuta(cellTotal)}
                                  {cellTxs.length > 1
                                    ? ` (${cellTxs.length}x)`
                                    : ""}
                                </button>
                              </td>
                            );
                          },
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}

      <Dialog
        open={activeCell !== null}
        onOpenChange={(open) => {
          if (!open) setActiveCell(null);
        }}
      >
        <DialogContent className="max-w-[min(480px,calc(100%-2rem))]">
          <DialogHeader>
            <DialogTitle>
              {activeCell
                ? `${t.laporan.coa.dialogTitlePrefix} ${activeCell.day} ${
                    monthShortLabels[activeCell.month - 1]
                  } ${year}`
                : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {activeCellTxs.map((tx) => (
              <div
                key={tx.txId}
                className="flex items-center justify-between gap-3 border-b pb-2 last:border-0"
              >
                <div className="text-[13px]">
                  {tx.description ?? t.laporan.coa.dialogNoDesc}
                </div>
                <div className="mono shrink-0 text-[13px] font-semibold">
                  {formatRupiah(tx.amount)}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───────────────────────── Export Section ───────────────────────── */

const EXPORT_REPORT_TYPE_IDS: ExportReportType[] = [
  "summary",
  "bank",
  "detail",
  "pnl",
  "balance-sheet",
  "cashflow",
];

/**
 * EPIC-025 N3-J1 — export job logic extracted from `ExportSection` into a
 * hook so the prototype's header "Excel"/"PDF" buttons (gap 1) can trigger
 * the SAME real export job as the detailed export card below the tabs,
 * instead of a second, disconnected implementation. Behaviour is unchanged
 * from the original `ExportSection` — only the state moved up one level.
 */
function useExportJob({
  familyGroupId,
  accessToken,
  startDate,
  endDate,
}: {
  familyGroupId: string;
  accessToken: string | undefined;
  /** Selected /laporan period bounds — threaded into the export job so the
   * downloaded report reflects the same period the user is viewing. */
  startDate: string;
  endDate: string;
}) {
  const { t } = useLocale();
  const [reportType, setReportType] = useState<ExportReportType>("summary");
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<ExportJobStatusDto | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const pollStatus = useCallback(
    async (id: string) => {
      if (!familyGroupId || !accessToken) return;
      try {
        const res = await apiFetch<ExportJobStatusDto>(
          `/family-groups/${familyGroupId}/exports/${id}`,
          { token: accessToken },
        );
        setStatus(res);
        if (res.status === "done" || res.status === "failed") {
          stopPolling();
          if (res.status === "done") {
            toast.success(t.laporan.export.toastExportDone);
          } else {
            toast.error(
              `${t.laporan.export.toastExportFailedPrefix} ${res.errorMessage ?? t.laporan.export.unknownErrorFallback}`,
            );
          }
        }
      } catch {
        stopPolling();
        toast.error(t.laporan.export.toastFetchStatusFailed);
      }
    },
    [familyGroupId, accessToken, stopPolling, t],
  );

  const startExport = useCallback(
    async (format: "pdf" | "excel") => {
      if (!familyGroupId || !accessToken) {
        toast.error(t.laporan.export.toastInvalidSession);
        return;
      }
      stopPolling();
      setIsSubmitting(true);
      setJobId(null);
      setStatus(null);

      const reqBody: ExportJobRequestDto = {
        type: reportType,
        format,
        startDate,
        endDate,
      };

      try {
        const res = await apiFetch<ExportJobStatusDto>(
          `/family-groups/${familyGroupId}/exports`,
          {
            token: accessToken,
            method: "POST",
            body: JSON.stringify(reqBody),
          },
        );
        setJobId(res.id);
        setStatus(res);
        toast(
          `${t.laporan.export.creatingExportPrefix} ${format.toUpperCase()}${t.laporan.export.creatingExportSuffix}`,
        );

        pollRef.current = setInterval(() => {
          void pollStatus(res.id);
        }, 2000);
      } catch {
        toast.error(t.laporan.export.toastExportCreateFailed);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      familyGroupId,
      accessToken,
      reportType,
      startDate,
      endDate,
      stopPolling,
      pollStatus,
      t,
    ],
  );

  const handleDownload = useCallback(() => {
    if (!status?.downloadUrl) return;
    const url = status.downloadUrl;
    if (!url.startsWith("data:") && !url.startsWith("https://")) {
      // invalid scheme — do not set href
      return;
    }
    const mimeToExt: Record<string, string> = {
      "data:text/csv": "csv",
      "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        "xlsx",
      "data:application/pdf": "pdf",
      "data:text/plain": "txt",
    };
    const prefix = Object.keys(mimeToExt).find((k) => url.startsWith(k));
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-${reportType}.${prefix ? mimeToExt[prefix] : "bin"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [status, reportType]);

  const isActive =
    status && status.status !== "done" && status.status !== "failed";
  const isDone = status?.status === "done";

  return {
    reportType,
    setReportType,
    jobId,
    status,
    isSubmitting,
    startExport,
    handleDownload,
    isActive,
    isDone,
  };
}

/* ───────────────────────── Export Section ───────────────────────── */

type ExportJobState = ReturnType<typeof useExportJob>;

function ExportSection({ exportJob }: { exportJob: ExportJobState }) {
  const { t } = useLocale();
  const {
    reportType,
    setReportType,
    jobId,
    status,
    isSubmitting,
    startExport,
    handleDownload,
    isActive,
    isDone,
  } = exportJob;

  return (
    <div className="rounded-[12px] border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] font-bold">{t.laporan.export.title}</div>
        {isDone && status?.downloadUrl && (
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground transition-colors hover:opacity-90"
          >
            <Download className="size-3.5" /> {t.laporan.export.downloadButton}
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-muted-foreground">
            {t.laporan.export.reportTypeLabel}
          </label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ExportReportType)}
            disabled={!!isActive || isSubmitting}
            className="rounded-md border bg-background px-3 py-[7px] text-[13px] outline-none focus:border-primary disabled:opacity-50"
          >
            {EXPORT_REPORT_TYPE_IDS.map((id) => (
              <option key={id} value={id}>
                {t.laporan.export.reportTypeLabels[id]}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => void startExport("pdf")}
          disabled={!!isActive || isSubmitting}
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3.5 py-[8px] text-[12px] font-semibold transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="size-3.5" /> {t.laporan.export.pdfButton}
        </button>
        <button
          onClick={() => void startExport("excel")}
          disabled={!!isActive || isSubmitting}
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3.5 py-[8px] text-[12px] font-semibold transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FileSpreadsheet className="size-3.5" /> {t.laporan.export.csvButton}
        </button>
      </div>
      {status && (
        <div className="mt-3 flex items-center gap-2 text-[12px]">
          <span className="text-muted-foreground">
            {t.laporan.export.statusLabel}
          </span>
          <span
            className={
              status.status === "done"
                ? "font-semibold text-success"
                : status.status === "failed"
                  ? "font-semibold text-destructive"
                  : "font-semibold text-primary"
            }
          >
            {status.status === "pending" && t.laporan.export.statusPending}
            {status.status === "processing" &&
              t.laporan.export.statusProcessing}
            {status.status === "done" && t.laporan.export.statusDone}
            {status.status === "failed" &&
              `${t.laporan.export.statusFailedPrefix} ${status.errorMessage ?? ""}`}
          </span>
          {jobId && <span className="text-muted-foreground">#{jobId}</span>}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Shared period filter ───────────────────────── */

/** Native-input year/month/day filter that drives every /laporan section. */
function PeriodFilter({
  period,
  onChange,
}: {
  period: ReportPeriodSelection;
  onChange: (next: ReportPeriodSelection) => void;
}) {
  const { t } = useLocale();
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);
  const maxDay = daysInMonth(period.year, period.month);
  const fieldClass =
    "rounded-md border bg-background px-3 py-[7px] text-[13.5px] outline-none focus:border-primary";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={t.laporan.periodFilter.yearAriaLabel}
        value={period.year}
        onChange={(e) => {
          const year = Number(e.target.value);
          const day = period.day
            ? clampDayToMonth(year, period.month, period.day)
            : null;
          onChange({ ...period, year, day });
        }}
        className={fieldClass}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <select
        aria-label={t.laporan.periodFilter.monthAriaLabel}
        value={period.month}
        onChange={(e) => {
          const month = Number(e.target.value);
          const day = period.day
            ? clampDayToMonth(period.year, month, period.day)
            : null;
          onChange({ ...period, month, day });
        }}
        className={fieldClass}
      >
        {t.laporan.months.map((label, i) => (
          <option key={label} value={i + 1}>
            {label}
          </option>
        ))}
      </select>
      <select
        aria-label={t.laporan.periodFilter.dayAriaLabel}
        value={period.day ?? ""}
        onChange={(e) => {
          const value = e.target.value;
          onChange({ ...period, day: value === "" ? null : Number(value) });
        }}
        className={fieldClass}
      >
        <option value="">{t.laporan.periodFilter.allDatesOption}</option>
        {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * EPIC-023 Task B (B1, US-RPT-12) — date-range presets, applied across every
 * /laporan sub-view. Selecting a preset other than "Custom" overrides the
 * year/month/day `PeriodFilter` above; picking "Custom" hands control back
 * to it (see `LaporanInner`'s `rangeStart`/`rangeEnd` derivation).
 */
const RANGE_PRESET_IDS: ReportRangePreset[] = [
  "thisMonth",
  "lastMonth",
  "last3Months",
  "last6Months",
  "last12Months",
  "thisYear",
  "lastYear",
  "custom",
];

/** Shared preset → label map (EPIC-023 Task B retry, MEDIUM — this used to
 * be duplicated verbatim in `RangePresetSelect` and in `LaporanInner`'s
 * `periodLabel` derivation; one source now feeds both). */
function buildRangePresetLabels(
  t: I18nDictionary,
): Record<ReportRangePreset, string> {
  return {
    thisMonth: t.laporan.periodFilter.presetThisMonth,
    lastMonth: t.laporan.periodFilter.presetLastMonth,
    last3Months: t.laporan.periodFilter.presetLast3Months,
    last6Months: t.laporan.periodFilter.presetLast6Months,
    last12Months: t.laporan.periodFilter.presetLast12Months,
    thisYear: t.laporan.periodFilter.presetThisYear,
    lastYear: t.laporan.periodFilter.presetLastYear,
    custom: t.laporan.periodFilter.presetCustom,
  };
}

function RangePresetSelect({
  preset,
  onChange,
}: {
  preset: ReportRangePreset;
  onChange: (next: ReportRangePreset) => void;
}) {
  const { t } = useLocale();
  const fieldClass =
    "rounded-md border bg-background px-3 py-[7px] text-[13.5px] outline-none focus:border-primary";
  const labels = buildRangePresetLabels(t);

  return (
    <select
      aria-label={t.laporan.periodFilter.presetAriaLabel}
      value={preset}
      onChange={(e) => onChange(e.target.value as ReportRangePreset)}
      className={fieldClass}
    >
      {RANGE_PRESET_IDS.map((id) => (
        <option key={id} value={id}>
          {labels[id]}
        </option>
      ))}
    </select>
  );
}

/* ───────────────────────── Page shell ───────────────────────── */

function LaporanInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const tab = sp.get("tab") ?? "rsum";
  const { t, locale } = useLocale();

  const { data: session } = useSession();
  const familyGroupId = session?.familyGroupId ?? "";
  const accessToken = session?.accessToken;

  const SUMMARY_MONTHS = 6;
  const enabled = Boolean(familyGroupId) && Boolean(session?.accessToken);
  const token = session?.accessToken;

  // Shared year/month(/day) period filter (EPIC-020 Task B) — one native
  // control set in the page header drives every report section below.
  // Default = current month/year (today's prior hard-coded behavior).
  const [period, setPeriod] = useState<ReportPeriodSelection>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1, day: null };
  });

  // EPIC-023 Task B (B1, US-RPT-12) — date-range presets, applied across
  // every /laporan sub-view. "custom" hands control back to the year/
  // month/day `PeriodFilter` above (today's prior default behavior);
  // anything else overrides `rangeStart`/`rangeEnd` below. `now` is frozen
  // per preset selection (not recomputed every render) so the derived
  // query keys stay stable instead of refetching on every re-render.
  const [rangePreset, setRangePreset] = useState<ReportRangePreset>("custom");
  // EPIC-023 Task B retry (MEDIUM) — the "to-date" presets (This Month/
  // Year, Last N Months) end at `now`, frozen at the moment `resolvePreset`
  // last ran. Recompute it when the tab regains focus/visibility so a long-
  // lived session doesn't keep showing yesterday's "today" after a day
  // rollover — a full re-derivation on every render would defeat the
  // "stable query keys" reason `now` is frozen in the first place, so this
  // is bounded to focus/visibility events only, not every render.
  const [focusTick, setFocusTick] = useState(0);
  useEffect(() => {
    function recompute() {
      setFocusTick((n) => n + 1);
    }
    window.addEventListener("focus", recompute);
    document.addEventListener("visibilitychange", recompute);
    return () => {
      window.removeEventListener("focus", recompute);
      document.removeEventListener("visibilitychange", recompute);
    };
  }, []);
  // `focusTick` is an intentional recompute trigger (not a value
  // `resolvePreset` itself reads), so it is force-included in the deps
  // array below to invalidate the memo on focus/visibility change.
  const presetRange = useMemo(
    () => (rangePreset === "custom" ? null : resolvePreset(rangePreset)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rangePreset, focusTick],
  );

  // Range-style sections (Bank/Detail/PNL/Cashflow/Aliran Dana, Balance
  // Sheet's as-of date, and the Reconciliation Bridge) narrow to a single
  // day when the filter pins one; otherwise they span the whole selected
  // month, or the active preset's window when one is selected.
  const { startDate: periodRangeStart, endDate: periodRangeEnd } =
    getPeriodDateRange(period);
  const rangeStart = presetRange?.startDate ?? periodRangeStart;
  const rangeEnd = presetRange?.endDate ?? periodRangeEnd;
  // Trend-style "N months back" summary queries are always monthly-bucketed
  // server-side — they anchor on the selected month's end regardless of any
  // pinned day (a single day has no meaning for a multi-month trend).
  const { endDate: monthAnchorEnd } = getPeriodDateRange({
    year: period.year,
    month: period.month,
    day: null,
  });
  // Tahunan re-queries the same trend anchored at the selected year's end.
  const { endDate: yearAnchorEnd } = getYearDateRange(period.year);
  // EPIC-023 Task B retry (HIGH) — B1 previously only drove
  // rbank/rdetail/rpnl/rbalance/rasl/rcashflow/raliran via `rangeStart`/
  // `rangeEnd`; rsum/rbulanan/rkas/rperf/rtahunan/rpajak still anchored on
  // the year/month/day filter alone, so picking a preset on those tabs
  // (rsum is the DEFAULT landing tab) silently changed nothing. Every
  // trend-style ("N months/years back") query below now anchors on the
  // active preset's own end date when one is selected, falling back to the
  // year/month/day filter's anchor for "custom".
  const summaryAnchorEnd = presetRange ? rangeEnd : monthAnchorEnd;
  const tahunanAnchorEnd = presetRange ? rangeEnd : yearAnchorEnd;
  const presetLabels = buildRangePresetLabels(t);
  // Human-readable caption for the range-based sections (Aliran Dana/PNL/
  // Cashflow) so their heading always matches the period actually queried —
  // the active preset's own label when one is selected, else the year/
  // month/day filter's period.
  const periodLabel =
    rangePreset !== "custom"
      ? presetLabels[rangePreset]
      : period.day
        ? new Date(
            period.year,
            period.month - 1,
            period.day,
          ).toLocaleDateString(localeTag(locale), {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : new Date(period.year, period.month - 1, 1).toLocaleDateString(
            localeTag(locale),
            { month: "long", year: "numeric" },
          );

  const { data: summary, isLoading: isSummaryLoading } =
    useQuery<ReportSummaryDto>({
      // EPIC-023 Task B retry (HIGH) — feeds rsum (the default landing
      // tab), rbulanan, rkas, and rperf; anchored on the active preset's
      // end date (`summaryAnchorEnd`) so those tabs actually change when a
      // preset is selected, not just Bank/Detail/PNL/Cashflow/Aliran Dana.
      queryKey: queryKeys.reports.summary(
        familyGroupId,
        SUMMARY_MONTHS,
        "monthly",
        summaryAnchorEnd,
      ),
      queryFn: () =>
        apiFetch<ReportSummaryDto>(
          `/family-groups/${familyGroupId}/reports/summary?months=${SUMMARY_MONTHS}&endDate=${summaryAnchorEnd}`,
          { token },
        ),
      enabled,
      staleTime: 60_000,
    });

  // EPIC-025 N3-J1 (gap 7) — Ringkasan's "Pemasukan vs Pengeluaran" chart
  // segmented toggle (6 Bln / 12 Bln, prototype's `.segmented`). A second,
  // independent query — NOT a mutation of `SUMMARY_MONTHS` above — so every
  // other tab that shares `summary` (Bulanan, Arus Kas, Performa) keeps its
  // existing trailing-6-month window regardless of what the Ringkasan chart
  // toggle is set to. Only fetched when the 12-month view is actually
  // selected on the Ringkasan tab.
  const [ringkasanChartRange, setRingkasanChartRange] = useState<6 | 12>(6);
  const { data: summary12, isLoading: isSummary12Loading } =
    useQuery<ReportSummaryDto>({
      queryKey: queryKeys.reports.summary(
        familyGroupId,
        12,
        "monthly",
        summaryAnchorEnd,
      ),
      queryFn: () =>
        apiFetch<ReportSummaryDto>(
          `/family-groups/${familyGroupId}/reports/summary?months=12&endDate=${summaryAnchorEnd}`,
          { token },
        ),
      enabled: enabled && tab === "rsum" && ringkasanChartRange === 12,
      staleTime: 60_000,
    });
  const ringkasanChartSummary =
    ringkasanChartRange === 12 ? summary12 : summary;
  const isRingkasanChartLoading =
    ringkasanChartRange === 12 ? isSummary12Loading : isSummaryLoading;

  // Laporan Harian always needs one specific day. Default to "today's
  // day-of-month" (clamped into the selected month) until the shared filter
  // pins a day, so the tab keeps showing today's data by default and stays
  // in sync with the header filter once the user picks a period.
  const harianDay =
    period.day ??
    clampDayToMonth(period.year, period.month, new Date().getDate());
  const harianDate = `${period.year}-${String(period.month).padStart(2, "0")}-${String(harianDay).padStart(2, "0")}`;
  const { startDate: harianStart, endDate: harianEnd } = getPeriodDateRange({
    year: period.year,
    month: period.month,
    day: harianDay,
  });

  // Intentional cross-tab effect: picking a Harian date pins `period.day`
  // globally (not just for this tab), so Bank/Detail/PNL/Cashflow/Sankey and
  // Balance Sheet's as-of date all narrow to that same single day too — the
  // header filter and the Harian date input are the same shared state. This
  // stays pinned until the user resets it via the header's "Semua Tanggal".
  function handleHarianDateChange(dateStr: string) {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return;
    setPeriod({ year: y, month: m, day: d });
  }

  const { data: bankReport, isLoading: isBankLoading } =
    useQuery<BankReportDto>({
      queryKey: queryKeys.reports.bank(familyGroupId, rangeStart, rangeEnd),
      queryFn: () =>
        apiFetch<BankReportDto>(
          `/family-groups/${familyGroupId}/reports/bank?startDate=${rangeStart}&endDate=${rangeEnd}`,
          { token },
        ),
      enabled: enabled && tab === "rbank",
      staleTime: 60_000,
    });

  const { data: detailReport, isLoading: isDetailLoading } =
    useQuery<DetailReportDto>({
      queryKey: queryKeys.reports.detail(familyGroupId, rangeStart, rangeEnd),
      queryFn: () =>
        apiFetch<DetailReportDto>(
          `/family-groups/${familyGroupId}/reports/detail?startDate=${rangeStart}&endDate=${rangeEnd}`,
          { token },
        ),
      enabled: enabled && tab === "rdetail",
      staleTime: 60_000,
    });

  const { data: dailyReport, isLoading: isDailyLoading } =
    useQuery<DetailReportDto>({
      queryKey: queryKeys.reports.detail(familyGroupId, harianStart, harianEnd),
      queryFn: () =>
        apiFetch<DetailReportDto>(
          `/family-groups/${familyGroupId}/reports/detail?startDate=${harianStart}&endDate=${harianEnd}`,
          { token },
        ),
      enabled: enabled && tab === "rharian",
      staleTime: 30_000,
    });

  const { data: pnl, isLoading: isPnlLoading } = useQuery<PnlDto>({
    queryKey: queryKeys.reports.pnl(familyGroupId, rangeStart, rangeEnd),
    queryFn: () =>
      apiFetch<PnlDto>(
        `/family-groups/${familyGroupId}/reports/pnl?startDate=${rangeStart}&endDate=${rangeEnd}`,
        { token },
      ),
    enabled: enabled && tab === "rpnl",
    staleTime: 60_000,
  });

  const { data: balanceSheet, isLoading: isBalanceLoading } =
    useQuery<BalanceSheetDto>({
      // Balance Sheet is point-in-time: `asOfDate` uses the selected period's
      // end bound (the pinned day, or the selected month's last day).
      queryKey: queryKeys.reports.balanceSheet(familyGroupId, rangeEnd),
      queryFn: () =>
        apiFetch<BalanceSheetDto>(
          `/family-groups/${familyGroupId}/reports/balance-sheet?asOfDate=${rangeEnd}`,
          { token },
        ),
      enabled:
        enabled && (tab === "rbalance" || tab === "rasl" || tab === "rsum"),
      staleTime: 60_000,
    });

  // EPIC-023 Task B (B3, D24, US-RPT-11) — reconciles the period's profit
  // against its actual net-worth change, surfaced on the Balance Sheet tab.
  const { data: reconciliationBridge, isLoading: isBridgeLoading } =
    useQuery<ReconciliationBridgeDto>({
      queryKey: queryKeys.reports.reconciliationBridge(
        familyGroupId,
        rangeStart,
        rangeEnd,
      ),
      queryFn: () =>
        apiFetch<ReconciliationBridgeDto>(
          `/family-groups/${familyGroupId}/reports/reconciliation-bridge?startDate=${rangeStart}&endDate=${rangeEnd}`,
          { token },
        ),
      enabled: enabled && tab === "rbalance",
      staleTime: 60_000,
    });

  const { data: cashflow, isLoading: isCashflowLoading } =
    useQuery<CashflowStatementDto>({
      queryKey: queryKeys.reports.cashflow(familyGroupId, rangeStart, rangeEnd),
      queryFn: () =>
        apiFetch<CashflowStatementDto>(
          `/family-groups/${familyGroupId}/reports/cashflow?startDate=${rangeStart}&endDate=${rangeEnd}`,
          { token },
        ),
      enabled: enabled && tab === "rcashflow",
      staleTime: 60_000,
    });

  const { data: sankeyData, isLoading: isSankeyLoading } = useQuery<SankeyDto>({
    queryKey: queryKeys.reports.sankey(familyGroupId, rangeStart, rangeEnd),
    queryFn: () =>
      apiFetch<SankeyDto>(
        `/family-groups/${familyGroupId}/reports/sankey?startDate=${rangeStart}&endDate=${rangeEnd}`,
        { token },
      ),
    enabled: enabled && tab === "raliran",
    staleTime: 60_000,
  });

  // EPIC-023 Task B retry (HIGH) — like rfamily below, rinv's holdings list
  // has no period semantics: `/investments` returns the family's CURRENT
  // portfolio (no `asOfDate`/`startDate`/`endDate` param on the endpoint),
  // so there is no "last month's holdings" to show. Left un-wired,
  // deliberately, same reasoning as the rfamily comment further down; the
  // preset selector's inapplicability is disclosed on-screen for both tabs
  // (see `periodNotApplicableNote` usage in the header below).
  const { data: investments, isLoading: isInvLoading } = useQuery<
    InvestmentDto[]
  >({
    queryKey: queryKeys.investments.all(familyGroupId),
    queryFn: () =>
      apiFetch<InvestmentDto[]>(`/family-groups/${familyGroupId}/investments`, {
        token,
      }),
    enabled: enabled && tab === "rinv",
    staleTime: 60_000,
  });

  const { data: invSummary } = useQuery<InvestmentSummaryDto>({
    queryKey: queryKeys.investments.summary(familyGroupId),
    queryFn: () =>
      apiFetch<InvestmentSummaryDto>(
        `/family-groups/${familyGroupId}/investments/summary`,
        { token },
      ),
    enabled: enabled && (tab === "rinv" || tab === "rsum" || tab === "rperf"),
    staleTime: 60_000,
  });

  // Tahunan (year granularity): re-anchors the same trend endpoint at the
  // selected year's end instead of always ending at "now" — or, when a
  // range preset is active, at that preset's own end (EPIC-023 Task B
  // retry, HIGH — rtahunan used to ignore the preset selector entirely).
  const { data: yearlySummary, isLoading: isYearlyLoading } =
    useQuery<ReportSummaryDto>({
      queryKey: queryKeys.reports.summary(
        familyGroupId,
        3,
        "yearly",
        tahunanAnchorEnd,
      ),
      queryFn: () =>
        apiFetch<ReportSummaryDto>(
          `/family-groups/${familyGroupId}/reports/summary?months=3&period=yearly&endDate=${tahunanAnchorEnd}`,
          { token },
        ),
      enabled: enabled && tab === "rtahunan",
      staleTime: 300_000,
    });

  // T-902: Group Family consolidated report (member roster + group totals).
  // The member roster and group net-worth snapshot have no period semantics
  // (roster is point-in-time membership; net-worth has no date param on the
  // current /dashboard/net-worth endpoint) — left un-wired, documented here.
  const { data: familyMembers, isLoading: isFamilyLoading } = useQuery<
    FamilyMember[]
  >({
    queryKey: queryKeys.familyGroups.members(familyGroupId),
    queryFn: () =>
      apiFetch<FamilyMember[]>(`/family-groups/${familyGroupId}/members`, {
        token,
      }),
    enabled: enabled && tab === "rfamily",
    staleTime: 60_000,
  });

  // EPIC-022 (adversarial review round 3, item 2) — also enabled for
  // "rbalance": BalanceSection cross-checks the balance sheet's `netWorth`
  // against this dashboard figure, a genuinely independent computation
  // (different service, different query path — DashboardService's
  // computeNetWorthBreakdown vs ReportsService's getBalanceSheet) instead of
  // an in-payload identity that can never disagree with itself.
  const { data: familyNetWorth, isLoading: isNetWorthLoading } =
    useQuery<NetWorthDto>({
      queryKey: queryKeys.netWorth.summary(familyGroupId),
      queryFn: () =>
        apiFetch<NetWorthDto>(
          `/family-groups/${familyGroupId}/dashboard/net-worth`,
          { token },
        ),
      enabled: enabled && (tab === "rfamily" || tab === "rbalance"),
      staleTime: 60_000,
    });

  // T-903: PPh 21 estimate from the trailing 12 months. Anchoring the trend
  // on `summaryAnchorEnd` makes the estimate re-query for the selected
  // period (EPIC-023 Task B retry, HIGH — rpajak used to ignore the
  // preset selector entirely).
  const { data: annualSummary, isLoading: isAnnualLoading } =
    useQuery<ReportSummaryDto>({
      queryKey: queryKeys.reports.summary(
        familyGroupId,
        12,
        "monthly",
        summaryAnchorEnd,
      ),
      queryFn: () =>
        apiFetch<ReportSummaryDto>(
          `/family-groups/${familyGroupId}/reports/summary?months=12&period=monthly&endDate=${summaryAnchorEnd}`,
          { token },
        ),
      enabled: enabled && tab === "rpajak",
      staleTime: 300_000,
    });

  const annualGross = annualSummary?.totalIncome;

  const { data: pph21, isLoading: isPph21Loading } = useQuery<Pph21ResultDto>({
    queryKey: ["calculators", "pph21", familyGroupId, annualGross ?? 0],
    queryFn: () =>
      apiFetch<Pph21ResultDto>("/calculators/pph21", {
        method: "POST",
        token,
        body: JSON.stringify({ grossIncome: annualGross ?? 0 }),
      }),
    enabled:
      enabled && tab === "rpajak" && annualGross != null && annualGross > 0,
    staleTime: 300_000,
  });

  // EPIC-024 Task M (M2, D16, US-RPT-14) — Laporan COA picker state + queries.
  const [coaAccountId, setCoaAccountId] = useState("");
  const [coaYear, setCoaYear] = useState(() => new Date().getFullYear());

  const { data: coaAccounts = [], isLoading: isCoaAccountsLoading } = useQuery<
    CoaAccountOption[]
  >({
    queryKey: ["coa-accounts", familyGroupId],
    queryFn: () =>
      apiFetch<CoaAccountOption[]>(
        `/family-groups/${familyGroupId}/coa-accounts`,
        { token },
      ),
    enabled: enabled && tab === "rcoa",
    staleTime: 60_000,
  });

  const { data: coaMatrix, isLoading: isCoaMatrixLoading } =
    useQuery<CoaMatrixDto>({
      queryKey: queryKeys.reports.coaMatrix(
        familyGroupId,
        coaAccountId,
        coaYear,
      ),
      queryFn: () =>
        apiFetch<CoaMatrixDto>(
          `/family-groups/${familyGroupId}/reports/coa-matrix?coaAccountId=${coaAccountId}&year=${coaYear}`,
          { token },
        ),
      enabled: enabled && tab === "rcoa" && Boolean(coaAccountId),
      staleTime: 60_000,
    });

  const queryClient = useQueryClient();
  const [showAddInv, setShowAddInv] = useState(false);
  const [editingInv, setEditingInv] = useState<InvestmentDto | null>(null);
  const [deletingInv, setDeletingInv] = useState<InvestmentDto | null>(null);
  const [invForm, setInvForm] = useState({
    ticker: "",
    name: "",
    type: "saham" as InvestmentType,
    quantity: "",
    costBasisPerUnit: "",
  });
  const [invSubmitting, setInvSubmitting] = useState(false);

  function openAdd() {
    setInvForm({
      ticker: "",
      name: "",
      type: "saham",
      quantity: "",
      costBasisPerUnit: "",
    });
    setShowAddInv(true);
  }
  function openEdit(inv: InvestmentDto) {
    setInvForm({
      ticker: inv.ticker,
      name: inv.name,
      type: inv.type,
      quantity: inv.quantity,
      costBasisPerUnit: inv.costBasisPerUnit,
    });
    setEditingInv(inv);
  }

  async function handleInvSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInvSubmitting(true);
    const isEdit = editingInv !== null;
    const url = isEdit
      ? `/family-groups/${familyGroupId}/investments/${editingInv.id}`
      : `/family-groups/${familyGroupId}/investments`;
    try {
      await apiFetch(url, {
        method: isEdit ? "PATCH" : "POST",
        token,
        body: JSON.stringify(invForm),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investments.all(familyGroupId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investments.summary(familyGroupId),
      });
      toast.success(
        isEdit ? t.laporan.investasi.toastUpdated : t.investasi.toastAdded,
      );
      setShowAddInv(false);
      setEditingInv(null);
    } catch {
      toast.error(
        isEdit ? t.investasi.toastUpdateFailed : t.investasi.toastAddFailed,
      );
    } finally {
      setInvSubmitting(false);
    }
  }

  async function handleInvDelete() {
    if (!deletingInv) return;
    setInvSubmitting(true);
    try {
      await apiFetch(
        `/family-groups/${familyGroupId}/investments/${deletingInv.id}`,
        {
          method: "DELETE",
          token,
        },
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investments.all(familyGroupId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investments.summary(familyGroupId),
      });
      toast.success(t.laporan.investasi.toastDeleted);
      setDeletingInv(null);
    } catch {
      toast.error(t.laporan.investasi.toastDeleteFailed);
    } finally {
      setInvSubmitting(false);
    }
  }

  const go = (id: string) =>
    router.push("/laporan?tab=" + id, { scroll: false });

  // EPIC-025 N3-J1 (gap 1) — the header's "Excel"/"PDF" buttons reuse this
  // SAME export job the detailed export card below the tabs uses, instead
  // of new controls that do nothing.
  const exportJob = useExportJob({
    familyGroupId,
    accessToken,
    startDate: rangeStart,
    endDate: rangeEnd,
  });

  // EPIC-025 N3-J1 (gap 4) — pill tab strip with scroll arrows.
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  function scrollReportTabs(direction: number) {
    const el = tabsScrollRef.current;
    if (!el) return;
    const amount = Math.max(280, Math.round(el.clientWidth * 0.72));
    el.scrollBy({ left: direction * amount, behavior: "smooth" });
  }
  const tabIndex = REPORT_TABS.findIndex((item) => item.id === tab);
  function handleTabKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const delta = e.key === "ArrowRight" ? 1 : -1;
    const next =
      REPORT_TABS[(tabIndex + delta + REPORT_TABS.length) % REPORT_TABS.length];
    go(next.id);
    document.getElementById(`laporan-tab-${next.id}`)?.focus();
  }

  function renderSection() {
    switch (tab) {
      case "rharian":
        return (
          <HarianSection
            dailyReport={dailyReport}
            isLoading={isDailyLoading}
            date={harianDate}
            onDateChange={handleHarianDateChange}
          />
        );
      case "rbulanan":
        return (
          <BulananSection summary={summary} isLoading={isSummaryLoading} />
        );
      case "rtahunan":
        return (
          <TahunanSection yearly={yearlySummary} isLoading={isYearlyLoading} />
        );
      case "rfamily":
        return (
          <FamilySection
            members={familyMembers}
            netWorth={familyNetWorth}
            summary={summary}
            isLoading={isFamilyLoading || isNetWorthLoading || isSummaryLoading}
          />
        );
      case "rbank":
        return (
          <BankSection bankReport={bankReport} isLoading={isBankLoading} />
        );
      case "rdetail":
        return (
          <DetailSection
            detailReport={detailReport}
            isLoading={isDetailLoading}
          />
        );
      case "raliran":
        return (
          <AliranSection
            sankeyData={sankeyData}
            isLoading={isSankeyLoading}
            periodLabel={periodLabel}
          />
        );
      case "rpnl":
        return (
          <PnlSection
            pnl={pnl}
            isLoading={isPnlLoading}
            periodLabel={periodLabel}
          />
        );
      case "rbalance":
        return (
          <BalanceSection
            balanceSheet={balanceSheet}
            isLoading={isBalanceLoading}
            dashboardNetWorth={familyNetWorth}
            isDashboardNetWorthLoading={isNetWorthLoading}
            reconciliationBridge={reconciliationBridge}
            isBridgeLoading={isBridgeLoading}
          />
        );
      case "rcashflow":
        return (
          <CashflowSection
            cashflow={cashflow}
            isLoading={isCashflowLoading}
            periodLabel={periodLabel}
          />
        );
      case "rkas":
        return <KasSection summary={summary} isLoading={isSummaryLoading} />;
      case "rinv":
        return (
          <InvSection
            investments={investments}
            invSummary={invSummary}
            isLoading={isInvLoading}
            onAdd={openAdd}
            onEdit={openEdit}
            onDelete={setDeletingInv}
          />
        );
      case "rasl":
        return (
          <AslSection
            balanceSheet={balanceSheet}
            isLoading={isBalanceLoading}
          />
        );
      case "rperf":
        return (
          <PerfSection
            summary={summary}
            invSummary={invSummary}
            isLoading={isSummaryLoading}
          />
        );
      case "rpajak":
        return (
          <PajakSection
            pph21={pph21}
            grossIncome={annualGross}
            isLoading={isAnnualLoading || isPph21Loading}
          />
        );
      case "rcoa":
        return (
          <CoaSection
            coaAccounts={coaAccounts}
            coaAccountId={coaAccountId}
            onCoaAccountIdChange={setCoaAccountId}
            year={coaYear}
            onYearChange={setCoaYear}
            matrix={coaMatrix}
            isLoading={isCoaAccountsLoading || isCoaMatrixLoading}
          />
        );
      case "rsum":
      default:
        return (
          <RingkasanSection
            go={go}
            summary={summary}
            invSummary={invSummary}
            balanceSheet={balanceSheet}
            isLoading={isSummaryLoading}
            chartSummary={ringkasanChartSummary}
            isChartLoading={isRingkasanChartLoading}
            chartRange={ringkasanChartRange}
            onChartRangeChange={setRingkasanChartRange}
            periodLabel={periodLabel}
          />
        );
    }
  }

  return (
    <div className="space-y-4">
      {/* Page lead — prototype's `.page-lead` (gap 1): H1 + subtitle with an
          accent underline, and header export buttons that trigger the SAME
          real job as the detailed export card below the tabs (`exportJob`,
          shared with `ExportSection`) — never a second, dead control. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="border-l-4 border-primary pl-3 text-[20px] font-extrabold tracking-tight sm:text-[22px]">
            {t.laporan.header.title}
          </h1>
          <p className="mt-1.5 max-w-xl pl-3 text-[13px] text-muted-foreground">
            {t.laporan.header.subtitle}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => void exportJob.startExport("excel")}
            disabled={!!exportJob.isActive || exportJob.isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3.5 py-[8px] text-[12px] font-semibold transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileSpreadsheet className="size-3.5" />
            {t.laporan.header.exportExcelButton}
          </button>
          <button
            type="button"
            onClick={() => void exportJob.startExport("pdf")}
            disabled={!!exportJob.isActive || exportJob.isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3.5 py-[8px] text-[12px] font-semibold transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileText className="size-3.5" />
            {t.laporan.header.exportPdfButton}
          </button>
        </div>
      </div>

      {/* Filter Laporan card (gap 2) — wraps the existing preset/period
          selectors; logic is unchanged, only the presentation moved into a
          proper card matching the prototype. */}
      <div className="rounded-[12px] border bg-card p-4">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[13px] font-bold">
            {t.laporan.filterCard.title}
          </div>
          <span className="text-[11px] text-muted-foreground">
            {t.laporan.filterCard.appliesAllTabsCaption}
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[200px] flex-col gap-1">
            <label className="text-[11px] font-semibold text-muted-foreground">
              {t.laporan.filterCard.periodeLabel}
            </label>
            {/* EPIC-023 Task B (B1, US-RPT-12) — quick-range presets applied
                across every /laporan sub-view. "Custom" hands control back
                to the year/month/day filter below it. */}
            <RangePresetSelect preset={rangePreset} onChange={setRangePreset} />
          </div>
          {rangePreset === "custom" && (
            <div className="flex min-w-[220px] flex-col gap-1">
              <label className="text-[11px] font-semibold text-muted-foreground">
                {t.laporan.filterCard.dateRangeLabel}
              </label>
              <PeriodFilter period={period} onChange={setPeriod} />
            </div>
          )}
        </div>
        {/* EPIC-022 B7 — report boundaries are pinned to WIB (never the
            viewer's local offset); disclose the pin instead of leaving it
            silent. */}
        <div className="mt-2 text-[10.5px] text-muted-foreground">
          {t.laporan.periodFilter.timezoneNotePrefix}
          {REPORT_TIMEZONE_LABEL}
          {t.laporan.periodFilter.timezoneNoteSuffix}
        </div>
        {/* EPIC-023 Task B retry (HIGH) — rfamily (roster + net worth)
            and rinv (current holdings) have no period semantics to
            filter by (see the query comments above); say so plainly
            instead of rendering a selector that silently does nothing. */}
        {(tab === "rfamily" || tab === "rinv") && (
          <div className="mt-1 text-[10.5px] text-warning">
            {t.laporan.periodFilter.periodNotApplicableNote}
          </div>
        )}

        {/* Cash-basis disclosure callout (gap 3) — active period rendered
            from the real `periodLabel` derivation above, not a static
            string. */}
        <div className="mt-3.5 flex items-start gap-2.5 rounded-md border border-primary/20 bg-accent/50 p-3 text-[12px] text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            <strong className="text-foreground">
              {t.laporan.cashBasisNotice.title}
            </strong>{" "}
            {t.laporan.cashBasisNotice.body}{" "}
            {t.laporan.cashBasisNotice.activePeriodPrefix}{" "}
            <span className="mono font-semibold text-foreground">
              {periodLabel}
            </span>
            .
          </span>
        </div>
      </div>

      {/* Pill tab strip with scroll arrows (gap 4) — a single mounted panel
          per active tab (SPA pattern), so `role="tabpanel"` targets the one
          rendered panel rather than the prototype's N hidden siblings. */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => scrollReportTabs(-1)}
          aria-label={t.laporan.tabStrip.scrollLeftAriaLabel}
          className="shrink-0 rounded-full border bg-card p-1.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div
          ref={tabsScrollRef}
          role="tablist"
          aria-label={t.laporan.tabStrip.ariaLabel}
          className="hide-scrollbar flex flex-1 gap-1.5 overflow-x-auto scroll-smooth"
        >
          {REPORT_TABS.map((tabItem) => {
            const active = tabItem.id === tab;
            return (
              <button
                key={tabItem.id}
                id={`laporan-tab-${tabItem.id}`}
                role="tab"
                aria-selected={active}
                aria-controls="laporan-panel"
                tabIndex={active ? 0 : -1}
                onClick={() => go(tabItem.id)}
                onKeyDown={handleTabKeyDown}
                className={
                  "shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors " +
                  (active
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-accent")
                }
              >
                {t.shell.reportTabs[tabItem.id]}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => scrollReportTabs(1)}
          aria-label={t.laporan.tabStrip.scrollRightAriaLabel}
          className="shrink-0 rounded-full border bg-card p-1.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Export (detailed card — report type, status, download) */}
      {familyGroupId && <ExportSection exportJob={exportJob} />}

      {/* Active section */}
      <div
        id="laporan-panel"
        role="tabpanel"
        aria-labelledby={`laporan-tab-${tab}`}
      >
        {renderSection()}
      </div>

      {/* Investment Add/Edit Dialog */}
      <Dialog
        open={showAddInv || editingInv !== null}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddInv(false);
            setEditingInv(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingInv
                ? t.investasi.modalTitleEdit
                : t.investasi.modalTitleAdd}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              void handleInvSubmit(e);
            }}
            className="space-y-3"
          >
            {(["ticker", "name"] as const).map((field) => (
              <div key={field} className="space-y-1">
                <label className="text-[12px] text-muted-foreground capitalize">
                  {field === "ticker"
                    ? t.investasi.fieldTickerLabel
                    : t.investasi.fieldNameLabel}
                </label>
                <input
                  required
                  value={invForm[field]}
                  onChange={(e) =>
                    setInvForm((f) => ({ ...f, [field]: e.target.value }))
                  }
                  placeholder={
                    field === "ticker"
                      ? t.investasi.fieldTickerPlaceholder
                      : t.investasi.fieldNamePlaceholder
                  }
                  className="w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            ))}
            <div className="space-y-1">
              <label className="text-[12px] text-muted-foreground">
                {t.investasi.fieldTypeLabel}
              </label>
              <select
                value={invForm.type}
                onChange={(e) =>
                  setInvForm((f) => ({
                    ...f,
                    type: e.target.value as InvestmentType,
                  }))
                }
                className="w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
              >
                {(
                  [
                    "saham",
                    "reksa_dana",
                    "obligasi",
                    "emas",
                    "kripto",
                    "lainnya",
                  ] as InvestmentType[]
                ).map((typeOption) => (
                  <option key={typeOption} value={typeOption}>
                    {typeOption.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            {(["quantity", "costBasisPerUnit"] as const).map((field) => (
              <div key={field} className="space-y-1">
                <label className="text-[12px] text-muted-foreground">
                  {field === "quantity"
                    ? t.investasi.fieldQuantityLabel
                    : t.investasi.fieldCostBasisLabel}
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  value={invForm[field]}
                  onChange={(e) =>
                    setInvForm((f) => ({ ...f, [field]: e.target.value }))
                  }
                  className="w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            ))}
            <DialogFooter>
              <Button type="submit" disabled={invSubmitting} className="w-full">
                {invSubmitting ? t.investasi.saving : t.investasi.saveButton}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Investment Delete Confirm Dialog */}
      <Dialog
        open={deletingInv !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingInv(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.laporan.investasi.deleteDialogTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-muted-foreground">
            {t.laporan.investasi.deleteConfirmPrefix}{" "}
            <span className="font-semibold text-foreground">
              {deletingInv?.ticker} — {deletingInv?.name}
            </span>
            {t.laporan.investasi.deleteConfirmSuffix}
          </p>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setDeletingInv(null)}
              disabled={invSubmitting}
            >
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void handleInvDelete();
              }}
              disabled={invSubmitting}
            >
              {invSubmitting
                ? t.laporan.investasi.deletingLabel
                : t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LaporanInner />
    </Suspense>
  );
}
