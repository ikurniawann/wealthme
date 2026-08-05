"use client";

import {
  Fragment,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, FileSpreadsheet } from "lucide-react";
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
import { BarChart } from "@/components/charts/bar-chart";
import { Donut, DonutLegend } from "@/components/charts/donut";
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
import type { Locale } from "@/i18n";
import { REPORT_TABS } from "@/lib/nav";
import {
  clampDayToMonth,
  daysInMonth,
  getPeriodDateRange,
  getYearDateRange,
  REPORT_TIMEZONE_LABEL,
  type ReportPeriodSelection,
} from "@/lib/laporan-period";
import type {
  BalanceSheetDto,
  BankReportDto,
  CashflowStatementDto,
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

function RingkasanSection({
  go,
  summary,
  invSummary,
  balanceSheet,
  isLoading,
}: {
  go: (id: string) => void;
  summary?: ReportSummaryDto;
  invSummary?: InvestmentSummaryDto;
  balanceSheet?: BalanceSheetDto;
  isLoading?: boolean;
}) {
  const { t } = useLocale();
  const chartMonths = summary?.points.map((p) => p.label) ?? [];
  const chartIncome = summary?.points.map((p) => p.income / 1_000_000) ?? [];
  const chartExpense = summary?.points.map((p) => p.expense / 1_000_000) ?? [];
  const chartMax = Math.max(...chartIncome, ...chartExpense, 1);

  const expenseDonut = summary
    ? categoryBreakdownToDonut(summary.topExpenseCategories)
    : [];
  const expenseCenterValue = summary ? formatJuta(summary.totalExpense) : "—";

  const invChart = buildInvChartData(invSummary);

  const wealthAlloc = balanceSheet
    ? balanceSheetToWealthAlloc(balanceSheet.assets, balanceSheet.totalAssets)
    : [];
  const wealthCenterValue = balanceSheet
    ? formatJuta(balanceSheet.totalAssets)
    : "—";

  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <SectionCard title={t.laporan.ringkasan.financeTitle}>
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
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
          <div>
            <div className="mb-[3px] text-[11px] text-muted-foreground">
              {t.laporan.savingsRateLabel}
            </div>
            <div className="text-[17px] font-extrabold text-primary">
              {summary ? `${summary.savingsRate}%` : "—"}
            </div>
          </div>
        </div>
        {chartMonths.length > 0 && (
          <div className="mt-4">
            <BarChart
              months={chartMonths}
              income={chartIncome}
              expense={chartExpense}
              max={chartMax}
              height={100}
            />
          </div>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <SectionCard title={t.laporan.ringkasan.expenseAllocTitle}>
          <div className="flex flex-wrap items-center gap-3.5">
            {expenseDonut.length > 0 ? (
              <>
                <Donut
                  segments={expenseDonut}
                  size={110}
                  thickness={16}
                  centerValue={expenseCenterValue}
                  centerLabel={t.common.total}
                />
                <div className="min-w-[120px] flex-1">
                  <DonutLegend segments={expenseDonut} />
                </div>
              </>
            ) : (
              <div className="py-4 text-[12px] text-muted-foreground">
                {t.laporan.ringkasan.emptyExpenseAlloc}
              </div>
            )}
          </div>
        </SectionCard>
        <SectionCard title={t.laporan.ringkasan.wealthAllocTitle}>
          <div className="flex flex-wrap items-center gap-3.5">
            {wealthAlloc.length > 0 ? (
              <>
                <Donut
                  segments={wealthAlloc}
                  size={110}
                  thickness={16}
                  centerValue={wealthCenterValue}
                  centerLabel={t.common.total}
                />
                <div className="min-w-[120px] flex-1">
                  <DonutLegend segments={wealthAlloc} />
                </div>
              </>
            ) : (
              <div className="py-4 text-[12px] text-muted-foreground">
                {t.laporan.ringkasan.emptyWealthAlloc}
              </div>
            )}
          </div>
        </SectionCard>
      </div>

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

      <div className="flex items-start gap-3 rounded-[12px] border border-primary/20 bg-accent p-3.5">
        <div className="text-[24px]">🤖</div>
        <div className="flex-1">
          <div className="text-[13px] font-bold text-primary-strong">
            {t.laporan.ringkasan.aiInsightTitle}
          </div>
          <div className="text-[12px] text-muted-foreground">
            {t.laporan.ringkasan.aiInsightBody}
          </div>
        </div>
        <a
          href="/ai"
          className="self-center whitespace-nowrap text-[12px] font-bold text-primary hover:underline"
        >
          {t.laporan.ringkasan.aiInsightCta}
        </a>
      </div>
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
                name={tx.description ?? tx.accountName}
                cat={`${time} · ${tx.categoryName ?? tx.accountName}`}
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
  const chartIncome = summary?.points.map((p) => p.income / 1_000_000) ?? [];
  const chartExpense = summary?.points.map((p) => p.expense / 1_000_000) ?? [];
  const chartMax = Math.max(...chartIncome, ...chartExpense, 1);

  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[15px] font-bold">{t.laporan.bulanan.title}</div>
      </div>
      {chartMonths.length > 0 && (
        <SectionCard title={t.laporan.bulanan.trendTitle}>
          <BarChart
            months={chartMonths}
            income={chartIncome}
            expense={chartExpense}
            max={chartMax}
            height={110}
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
  const maxIncome = Math.max(...points.map((p) => p.income), 1);
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const YEAR_COLORS = [
    "var(--primary)",
    "var(--brand-cyan)",
    "var(--success)",
    "var(--warning)",
  ];

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
          <div className="flex flex-col gap-2.5">
            {points.map((p, i) => (
              <BarRow
                key={p.label}
                label={p.label}
                right={
                  <span
                    style={{ color: YEAR_COLORS[i % YEAR_COLORS.length] }}
                    className="font-bold"
                  >
                    {formatRupiah(p.income)}
                  </span>
                }
                value={Math.round((p.income / maxIncome) * 100)}
                color={YEAR_COLORS[i % YEAR_COLORS.length] ?? "var(--primary)"}
              />
            ))}
          </div>
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
                      <td className="py-2.5">{tx.accountName}</td>
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

function FlowBar({
  width,
  grad,
  label,
  amount,
}: {
  width: string;
  grad: string;
  label: string;
  amount: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-semibold">{label}</span>
        <span className="font-bold">{amount}</span>
      </div>
      <div className="h-[10px] w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width, background: grad }}
        />
      </div>
    </div>
  );
}

const FLOW_GRADS_INCOME = [
  "linear-gradient(90deg,var(--success),#34D399)",
  "linear-gradient(90deg,#8B5CF6,#A78BFA)",
  "linear-gradient(90deg,#06B6D4,#22D3EE)",
  "linear-gradient(90deg,#F59E0B,#FBBF24)",
];
const FLOW_GRADS_EXPENSE = [
  "linear-gradient(90deg,#4F46E5,#6366F1)",
  "linear-gradient(90deg,#10B981,#34D399)",
  "linear-gradient(90deg,#F59E0B,#FBBF24)",
  "linear-gradient(90deg,#EC4899,#F43F5E)",
];

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
          <div className="flex flex-col gap-3.5">
            <div>
              <div className="mb-2 text-[11px] font-bold text-success">
                {t.laporan.aliran.incomeSourceLabel}
              </div>
              <div className="flex flex-col gap-3">
                {incomeBars.map((b, i) => (
                  <FlowBar
                    key={b.label}
                    width={`${b.widthPct}%`}
                    grad={
                      FLOW_GRADS_INCOME[i % FLOW_GRADS_INCOME.length] ??
                      FLOW_GRADS_INCOME[0]!
                    }
                    label={b.label}
                    amount={formatJuta(b.amount)}
                  />
                ))}
              </div>
            </div>
            <div className="text-center text-[18px] text-muted-foreground">
              ⬇
            </div>
            <div>
              <div className="mb-2 text-[11px] font-bold text-destructive">
                {t.laporan.aliran.expenseAllocLabel}
              </div>
              <div className="flex flex-col gap-3">
                {expenseBars.map((b, i) => (
                  <FlowBar
                    key={b.label}
                    width={`${b.widthPct}%`}
                    grad={
                      FLOW_GRADS_EXPENSE[i % FLOW_GRADS_EXPENSE.length] ??
                      FLOW_GRADS_EXPENSE[0]!
                    }
                    label={b.label}
                    amount={formatJuta(b.amount)}
                  />
                ))}
              </div>
            </div>
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
}: {
  balanceSheet?: BalanceSheetDto;
  isLoading?: boolean;
  /** Independently computed net worth from a different service/query path
   * (`/dashboard/net-worth`) — the only genuine cross-check available; see
   * computeBalanceSheetIdentity's doc comment for why an in-payload check
   * can never be falsifiable here. */
  dashboardNetWorth?: NetWorthDto;
  isDashboardNetWorthLoading?: boolean;
}) {
  const { t, locale } = useLocale();
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
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
  const isCheckPending =
    Boolean(balanceSheet) &&
    (isDashboardNetWorthLoading || isBalanced === null);

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div>
        <div className="text-[15px] font-bold">
          {t.laporan.balance.titlePrefix} {asOf}
        </div>
        {/* EPIC-022 (adversarial review round 3, item 3) — asOfDate is
            accepted but there is no historical-balance data model; every
            figure below is the CURRENT balance, not a true point-in-time
            snapshot as of the date above. Disclose rather than silently
            imply otherwise (same pattern as B3's Saldo Awal/Akhir note). */}
        <div className="text-[10.5px] text-muted-foreground">
          {t.laporan.balance.currentBalanceDisclosure}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <SectionCard
          title={
            <span className="text-success">{t.laporan.balance.assetLabel}</span>
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
                  balanceSheet ? formatJuta(balanceSheet.totalLiabilities) : "—"
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
      {isCheckPending && (
        <div className="flex items-center gap-2 rounded-[12px] border border-border bg-muted/40 p-3 text-[12px] text-muted-foreground">
          {t.laporan.balance.checkingLabel}
        </div>
      )}
      {balanceSheet && isBalanced === true && (
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
      {balanceSheet && isBalanced === false && (
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
    </div>
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
  const chartIncome = summary?.points.map((p) => p.income / 1_000_000) ?? [];
  const chartExpense = summary?.points.map((p) => p.expense / 1_000_000) ?? [];
  const chartMax = Math.max(...chartIncome, ...chartExpense, 1);

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
            <BarChart
              months={chartMonths}
              income={chartIncome}
              expense={chartExpense}
              max={chartMax}
              height={110}
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

/* ───────────────────────── Export Section ───────────────────────── */

const EXPORT_REPORT_TYPE_IDS: ExportReportType[] = [
  "summary",
  "bank",
  "detail",
  "pnl",
  "balance-sheet",
  "cashflow",
];

function ExportSection({
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

  return (
    <div className="rounded-[12px] border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] font-bold">{t.laporan.export.title}</div>
        {isDone && status.downloadUrl && (
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

  // Range-style sections (Bank/Detail/PNL/Cashflow/Aliran Dana, and Balance
  // Sheet's as-of date) narrow to a single day when the filter pins one;
  // otherwise they span the whole selected month.
  const { startDate: rangeStart, endDate: rangeEnd } =
    getPeriodDateRange(period);
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
  // Human-readable caption for the range-based sections (Aliran Dana/PNL/
  // Cashflow) so their heading always matches the period actually queried.
  const periodLabel = period.day
    ? new Date(period.year, period.month - 1, period.day).toLocaleDateString(
        localeTag(locale),
        { day: "numeric", month: "long", year: "numeric" },
      )
    : new Date(period.year, period.month - 1, 1).toLocaleDateString(
        localeTag(locale),
        { month: "long", year: "numeric" },
      );

  const { data: summary, isLoading: isSummaryLoading } =
    useQuery<ReportSummaryDto>({
      queryKey: queryKeys.reports.summary(
        familyGroupId,
        SUMMARY_MONTHS,
        "monthly",
        monthAnchorEnd,
      ),
      queryFn: () =>
        apiFetch<ReportSummaryDto>(
          `/family-groups/${familyGroupId}/reports/summary?months=${SUMMARY_MONTHS}&endDate=${monthAnchorEnd}`,
          { token },
        ),
      enabled,
      staleTime: 60_000,
    });

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
  // selected year's end instead of always ending at "now".
  const { data: yearlySummary, isLoading: isYearlyLoading } =
    useQuery<ReportSummaryDto>({
      queryKey: queryKeys.reports.summary(
        familyGroupId,
        3,
        "yearly",
        yearAnchorEnd,
      ),
      queryFn: () =>
        apiFetch<ReportSummaryDto>(
          `/family-groups/${familyGroupId}/reports/summary?months=3&period=yearly&endDate=${yearAnchorEnd}`,
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
  // on `monthAnchorEnd` makes the estimate re-query for the selected period.
  const { data: annualSummary, isLoading: isAnnualLoading } =
    useQuery<ReportSummaryDto>({
      queryKey: queryKeys.reports.summary(
        familyGroupId,
        12,
        "monthly",
        monthAnchorEnd,
      ),
      queryFn: () =>
        apiFetch<ReportSummaryDto>(
          `/family-groups/${familyGroupId}/reports/summary?months=12&period=monthly&endDate=${monthAnchorEnd}`,
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
      case "rsum":
      default:
        return (
          <RingkasanSection
            go={go}
            summary={summary}
            invSummary={invSummary}
            balanceSheet={balanceSheet}
            isLoading={isSummaryLoading}
          />
        );
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] text-muted-foreground">
          {t.laporan.subtitle}
        </div>
        <div className="flex flex-col items-end gap-1">
          <PeriodFilter period={period} onChange={setPeriod} />
          {/* EPIC-022 B7 — report boundaries are pinned to WIB (never the
              viewer's local offset); disclose the pin instead of leaving it
              silent. */}
          <div className="text-[10.5px] text-muted-foreground">
            {t.laporan.periodFilter.timezoneNotePrefix}
            {REPORT_TIMEZONE_LABEL}
            {t.laporan.periodFilter.timezoneNoteSuffix}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="relative">
        <div className="hide-scrollbar flex gap-0.5 overflow-x-auto rounded-md border bg-background p-1">
          {REPORT_TABS.map((tabItem) => {
            const active = tabItem.id === tab;
            return (
              <button
                key={tabItem.id}
                onClick={() => go(tabItem.id)}
                className={
                  "whitespace-nowrap rounded px-3.5 py-2 text-[13px] font-semibold transition-colors " +
                  (active
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {t.shell.reportTabs[tabItem.id]}
              </button>
            );
          })}
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-md bg-gradient-to-l from-background to-transparent"
        />
      </div>

      {/* Export */}
      {familyGroupId && (
        <ExportSection
          familyGroupId={familyGroupId}
          accessToken={accessToken}
          startDate={rangeStart}
          endDate={rangeEnd}
        />
      )}

      {/* Active section */}
      {renderSection()}

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
