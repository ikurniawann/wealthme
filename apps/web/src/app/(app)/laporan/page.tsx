"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, Download, FileSpreadsheet } from "lucide-react";
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
import type { DonutSegment } from "@/components/charts/donut";
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
  SankeyDto,
} from "@wealthme/contracts";
import {
  balanceSheetToWealthAlloc,
  buildInvChartData,
  categoryBreakdownToDonut,
  formatJuta,
  getMonthDateRange,
  getTodayDateRange,
  sankeyToFlowBars,
  txTypeToBadgeVariant,
} from "@/lib/laporan-utils";

/* ───────────────────────── Tab definitions ───────────────────────── */

const TABS: { id: string; label: string }[] = [
  { id: "rsum", label: "Ringkasan" },
  { id: "rharian", label: "Harian" },
  { id: "rbulanan", label: "Bulanan" },
  { id: "rtahunan", label: "Tahunan" },
  { id: "rfamily", label: "Group Family" },
  { id: "rbank", label: "Bank" },
  { id: "rdetail", label: "Detail" },
  { id: "raliran", label: "Aliran Dana" },
  { id: "rpnl", label: "PNL" },
  { id: "rbalance", label: "Balance Sheet" },
  { id: "rcashflow", label: "Cashflow" },
  { id: "rkas", label: "Arus Kas" },
  { id: "rinv", label: "Investasi" },
  { id: "rasl", label: "Aset & Liabilitas" },
  { id: "rperf", label: "Performa" },
  { id: "rpajak", label: "Pajak" },
];

/** Family group member (mirrors API MemberResponseDto). */
type FamilyMember = {
  id: string;
  userId: string;
  familyGroupId: string;
  role: string;
  name: string;
  email: string;
  createdAt: string;
};

const ROLE_META: Record<
  string,
  { label: string; variant: "success" | "info" | "purple" }
> = {
  owner: { label: "Pemilik", variant: "success" },
  admin: { label: "Admin", variant: "purple" },
  member: { label: "Anggota", variant: "info" },
};

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
      <SectionCard title="Ringkasan Keuangan">
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          <MoneyStat
            label="Total Pemasukan"
            value={summary ? formatRupiah(summary.totalIncome) : "Rp —"}
            valueClass="text-success"
          />
          <MoneyStat
            label="Total Pengeluaran"
            value={summary ? formatRupiah(summary.totalExpense) : "Rp —"}
            valueClass="text-destructive"
          />
          <MoneyStat
            label="Surplus"
            value={summary ? formatRupiah(summary.netSavings) : "Rp —"}
            valueClass="text-success"
          />
          <div>
            <div className="mb-[3px] text-[11px] text-muted-foreground">
              Savings Rate
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
        <SectionCard title="Alokasi Pengeluaran">
          <div className="flex flex-wrap items-center gap-3.5">
            {expenseDonut.length > 0 ? (
              <>
                <Donut
                  segments={expenseDonut}
                  size={110}
                  thickness={16}
                  centerValue={expenseCenterValue}
                  centerLabel="Total"
                />
                <div className="min-w-[120px] flex-1">
                  <DonutLegend segments={expenseDonut} />
                </div>
              </>
            ) : (
              <div className="py-4 text-[12px] text-muted-foreground">
                Belum ada data pengeluaran
              </div>
            )}
          </div>
        </SectionCard>
        <SectionCard title="Wealth Allocation">
          <div className="flex flex-wrap items-center gap-3.5">
            {wealthAlloc.length > 0 ? (
              <>
                <Donut
                  segments={wealthAlloc}
                  size={110}
                  thickness={16}
                  centerValue={wealthCenterValue}
                  centerLabel="Total"
                />
                <div className="min-w-[120px] flex-1">
                  <DonutLegend segments={wealthAlloc} />
                </div>
              </>
            ) : (
              <div className="py-4 text-[12px] text-muted-foreground">
                Belum ada data aset
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Performa Investasi"
        action={<CardLink onClick={() => go("rinv")}>Lihat detail</CardLink>}
      >
        <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-2">
          <div>
            <div className="text-[11px] text-muted-foreground">Total Nilai</div>
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
                  Return hari ini:{" "}
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
                          style={{ background: "#4F46E5" }}
                        />
                        Nilai
                      </span>
                      <span>{invChart.nilaiPct}%</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${invChart.nilaiPct}%`,
                          background: "#4F46E5",
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
                        Modal
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
                    ? "▲ Portofolio untung"
                    : "▼ Portofolio rugi"}
                </div>
              </>
            ) : (
              <div className="flex h-[70px] items-center justify-center text-[12px] text-muted-foreground">
                Belum ada data investasi
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      <div className="flex items-start gap-3 rounded-[12px] border border-primary/20 bg-accent p-3.5">
        <div className="text-[24px]">🤖</div>
        <div className="flex-1">
          <div className="text-[13px] font-bold text-primary-strong">
            Insight AI
          </div>
          <div className="text-[12px] text-muted-foreground">
            Pengeluaran gaya hidupmu naik 18% dibanding bulan lalu. Coba atur
            budget agar savings rate tetap sehat.
          </div>
        </div>
        <a
          href="/ai"
          className="self-center whitespace-nowrap text-[12px] font-bold text-primary hover:underline"
        >
          Lihat Rekomendasi →
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
}: {
  dailyReport?: DetailReportDto;
  isLoading?: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const net =
    (dailyReport?.totalIncome ?? 0) - (dailyReport?.totalExpense ?? 0);

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[15px] font-bold">
          Laporan Harian —{" "}
          {new Date().toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>
        <input
          type="date"
          defaultValue={today}
          className="rounded-md border bg-background px-3 py-[7px] text-[13.5px] outline-none focus:border-primary"
        />
      </div>
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <StatTile
          label="Pemasukan Hari Ini"
          value={dailyReport ? formatRupiah(dailyReport.totalIncome) : "Rp —"}
          valueClass="text-success"
        />
        <StatTile
          label="Pengeluaran Hari Ini"
          value={dailyReport ? formatRupiah(dailyReport.totalExpense) : "Rp —"}
          valueClass="text-destructive"
        />
        <StatTile
          label="Net Harian"
          value={
            dailyReport ? `${net >= 0 ? "+" : ""}${formatRupiah(net)}` : "Rp —"
          }
          valueClass={net >= 0 ? "text-success" : "text-destructive"}
        />
        <StatTile
          label="Jumlah Transaksi"
          value={dailyReport ? String(dailyReport.count) : "—"}
          valueClass="text-primary"
        />
      </div>
      <SectionCard title="Transaksi Hari Ini">
        {dailyReport && dailyReport.transactions.length > 0 ? (
          dailyReport.transactions.map((tx, i) => {
            const isIncome = tx.type === "income";
            const time = new Date(tx.occurredAt).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            });
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
                      (isIncome ? "text-success" : "text-destructive")
                    }
                  >
                    {isIncome ? "+" : "-"}
                    {formatRupiah(tx.amount)}
                  </div>
                }
                last={i === dailyReport.transactions.length - 1}
              />
            );
          })
        ) : (
          <div className="py-4 text-center text-[12px] text-muted-foreground">
            Tidak ada transaksi hari ini
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
  const chartMonths = summary?.points.map((p) => p.label) ?? [];
  const chartIncome = summary?.points.map((p) => p.income / 1_000_000) ?? [];
  const chartExpense = summary?.points.map((p) => p.expense / 1_000_000) ?? [];
  const chartMax = Math.max(...chartIncome, ...chartExpense, 1);

  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[15px] font-bold">Laporan Bulanan</div>
      </div>
      {chartMonths.length > 0 && (
        <SectionCard title="Tren 6 Bulan Terakhir">
          <BarChart
            months={chartMonths}
            income={chartIncome}
            expense={chartExpense}
            max={chartMax}
            height={110}
          />
        </SectionCard>
      )}
      <SectionCard title="Rekap per Bulan">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 font-semibold">Bulan</th>
                <th className="py-2 font-semibold">Masuk</th>
                <th className="py-2 font-semibold">Keluar</th>
                <th className="py-2 font-semibold">Net</th>
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
                    Belum ada transaksi bulan ini
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
      <div className="text-[15px] font-bold">Laporan Tahunan</div>
      {latest ? (
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          <StatTile
            label={`Total Pemasukan ${latest.label}`}
            value={formatRupiah(latest.income)}
            valueClass="text-success"
          />
          <StatTile
            label="Total Pengeluaran"
            value={formatRupiah(latest.expense)}
            valueClass="text-destructive"
          />
          <StatTile
            label="Net Tahunan"
            value={(latest.net >= 0 ? "+" : "") + formatRupiah(latest.net)}
            valueClass={latest.net >= 0 ? "text-success" : "text-destructive"}
          />
          <StatTile
            label="Savings Rate"
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
          Belum ada data tahunan
        </div>
      )}
      {points.length > 0 && (
        <SectionCard title="Tren Pemasukan per Tahun">
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
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const memberList = members ?? [];

  const netWorthRows = netWorth
    ? [
        { label: "Rekening & Kas", value: netWorth.accountsTotal, neg: false },
        { label: "Investasi", value: netWorth.investmentsTotal, neg: false },
        { label: "Aset Lain", value: netWorth.assetsTotal, neg: false },
        { label: "Liabilitas", value: netWorth.liabilitiesTotal, neg: true },
      ]
    : [];

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="text-[15px] font-bold">Laporan Group Family</div>

      <SectionCard title="Konsolidasi Keuangan Keluarga">
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          <MoneyStat
            label="Total Net Worth"
            value={
              netWorth
                ? formatRupiah(parseFloat(netWorth.netWorth) || 0)
                : "Rp —"
            }
            valueClass="text-primary"
          />
          <MoneyStat
            label="Total Pemasukan"
            value={summary ? formatRupiah(summary.totalIncome) : "Rp —"}
            valueClass="text-success"
          />
          <MoneyStat
            label="Total Pengeluaran"
            value={summary ? formatRupiah(summary.totalExpense) : "Rp —"}
            valueClass="text-destructive"
          />
          <MoneyStat
            label="Surplus"
            value={summary ? formatRupiah(summary.netSavings) : "Rp —"}
            valueClass="text-success"
          />
        </div>
      </SectionCard>

      {netWorthRows.length > 0 && (
        <SectionCard title="Komposisi Kekayaan Keluarga">
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

      <SectionCard title={`Anggota Keluarga (${memberList.length})`}>
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
                <StatusBadge variant={ROLE_META[m.role]?.variant ?? "info"}>
                  {ROLE_META[m.role]?.label ?? m.role}
                </StatusBadge>
              }
              last={i === memberList.length - 1}
            />
          ))
        ) : (
          <div className="py-4 text-center text-[12px] text-muted-foreground">
            Belum ada anggota keluarga
          </div>
        )}
      </SectionCard>

      <div className="rounded-[12px] border border-primary/20 bg-accent p-3.5 text-[12px] text-muted-foreground">
        Konsolidasi ditampilkan pada level grup keluarga. Rincian saldo
        per-anggota berada di luar cakupan API saat ini.
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
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const banks = bankReport?.banks ?? [];
  const maxIncome = Math.max(...banks.map((b) => b.income), 1);

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="text-[15px] font-bold">
        Laporan Bank — Konsolidasi Rekening
      </div>
      <SectionCard title="Saldo per Rekening">
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
            Belum ada rekening
          </div>
        )}
      </SectionCard>
      {banks.length > 0 && (
        <SectionCard title="Mutasi Masuk vs Keluar per Bank">
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
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const txs = detailReport?.transactions ?? [];

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[15px] font-bold">Laporan Detail Transaksi</div>
        <button
          onClick={() => toast("📥 Export Excel...")}
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3.5 py-2 text-[12px] font-semibold transition-colors hover:bg-accent"
        >
          <FileSpreadsheet className="size-3.5" /> Export
        </button>
      </div>
      <SectionCard>
        <div className="w-full overflow-x-auto">
          <table className="min-w-[580px] w-full text-[12.5px]">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 font-semibold">Tanggal</th>
                <th className="py-2 font-semibold">Keterangan</th>
                <th className="py-2 font-semibold">Kategori</th>
                <th className="py-2 font-semibold">Akun</th>
                <th className="py-2 text-right font-semibold">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {txs.length > 0 ? (
                txs.map((tx) => {
                  const isIncome = tx.type === "income";
                  const tgl = new Date(tx.occurredAt).toLocaleDateString(
                    "id-ID",
                    { day: "2-digit", month: "2-digit" },
                  );
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
                          (isIncome ? "text-success" : "text-destructive")
                        }
                      >
                        {isIncome ? "+" : "-"}
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
                    Belum ada transaksi bulan ini
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
}: {
  sankeyData?: SankeyDto;
  isLoading?: boolean;
}) {
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const incomeBars = sankeyData ? sankeyToFlowBars(sankeyData, "income") : [];
  const expenseBars = sankeyData ? sankeyToFlowBars(sankeyData, "expense") : [];

  const now = new Date();
  const bulan = now.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="text-[15px] font-bold">Laporan Aliran Dana</div>
      <SectionCard title={`Aliran Dana — ${bulan}`}>
        {sankeyData && (incomeBars.length > 0 || expenseBars.length > 0) ? (
          <div className="flex flex-col gap-3.5">
            <div>
              <div className="mb-2 text-[11px] font-bold text-success">
                SUMBER DANA MASUK
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
                ALOKASI DANA KELUAR
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
            Belum ada data aliran dana bulan ini
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

function PnlSection({ pnl, isLoading }: { pnl?: PnlDto; isLoading?: boolean }) {
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const now = new Date();
  const bulan = now.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
  const netMargin =
    pnl && pnl.revenue > 0
      ? `${Math.round((pnl.netProfit / pnl.revenue) * 100 * 10) / 10}%`
      : "—";

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="text-[15px] font-bold">
        Profit &amp; Loss Statement — {bulan}
      </div>
      <SectionCard>
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            <StatementRow
              label="PENDAPATAN"
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
              label="Total Pendapatan"
              value={pnl ? formatRupiah(pnl.revenue) : "Rp —"}
              className="border-b border-border"
              labelClass="py-2 font-bold"
              valueClass="font-extrabold text-success"
            />
            <StatementRow
              label="BEBAN"
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
              label="Total Beban"
              value={pnl ? formatRupiah(pnl.expenses) : "Rp —"}
              className="border-b border-border"
              labelClass="py-2 font-bold"
              valueClass="font-extrabold text-destructive"
            />
            <StatementRow
              label="NET PROFIT"
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
              label="Net Margin"
              value={netMargin}
              labelClass="py-1 text-[11px] text-muted-foreground"
              valueClass="text-[11px] text-muted-foreground"
            />
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Section: Balance Sheet ───────────────────────── */

function BalanceSection({
  balanceSheet,
  isLoading,
}: {
  balanceSheet?: BalanceSheetDto;
  isLoading?: boolean;
}) {
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const asOf = balanceSheet
    ? new Date(balanceSheet.asOfDate).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";
  const debtRatio =
    balanceSheet && balanceSheet.totalAssets > 0
      ? `${Math.round((balanceSheet.totalLiabilities / balanceSheet.totalAssets) * 100 * 10) / 10}%`
      : "—";

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="text-[15px] font-bold">Balance Sheet — Per {asOf}</div>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <SectionCard title={<span className="text-success">ASET</span>}>
          <table className="w-full border-collapse text-[12.5px]">
            <tbody>
              {balanceSheet?.assets.map((group) => (
                <>
                  <StatementRow
                    key={`g-${group.category}`}
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
                </>
              ))}
              <StatementRow
                label="Total Aset"
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
            <span className="text-destructive">LIABILITAS &amp; EKUITAS</span>
          }
        >
          <table className="w-full border-collapse text-[12.5px]">
            <tbody>
              <StatementRow
                label="Liabilitas"
                labelClass="py-1.5 font-bold text-muted-foreground"
              />
              {balanceSheet?.liabilities.map((group) => (
                <>
                  <StatementRow
                    key={`g-${group.category}`}
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
                </>
              ))}
              <StatementRow
                label="Total Liabilitas"
                value={
                  balanceSheet ? formatJuta(balanceSheet.totalLiabilities) : "—"
                }
                className="border-b border-border"
                labelClass="py-1.5 font-bold"
                valueClass="font-bold text-destructive"
              />
              <StatementRow
                label="Ekuitas"
                labelClass="py-1.5 font-bold text-muted-foreground"
              />
              <StatementRow
                label="Net Worth"
                value={balanceSheet ? formatJuta(balanceSheet.netWorth) : "—"}
                indent
              />
              <StatementRow
                label="Total L + E"
                value={
                  balanceSheet ? formatJuta(balanceSheet.totalAssets) : "—"
                }
                className="border-t-2 border-primary"
                labelClass="py-2 font-extrabold"
                valueClass="font-extrabold text-primary"
              />
            </tbody>
          </table>
        </SectionCard>
      </div>
      {balanceSheet && (
        <div className="flex items-start gap-3 rounded-[12px] border border-primary/20 bg-accent p-3.5">
          <div className="text-[22px]">✅</div>
          <div>
            <div className="text-[13px] font-bold text-primary-strong">
              Balance Sheet Seimbang
            </div>
            <div className="text-[12px] text-muted-foreground">
              Total Aset = Total Liabilitas + Ekuitas. Debt-to-Asset ratio{" "}
              {debtRatio}.
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
}: {
  cashflow?: CashflowStatementDto;
  isLoading?: boolean;
}) {
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const now = new Date();
  const bulan = now.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
  const fmt = (n: number) => `${n >= 0 ? "+" : ""}${formatRupiah(Math.abs(n))}`;

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="text-[15px] font-bold">Cashflow Statement — {bulan}</div>
      <SectionCard>
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            <StatementRow
              label="ARUS KAS OPERASI"
              className="border-b-2 border-border"
              labelClass="py-2.5 font-bold text-primary"
            />
            <StatementRow
              label="Total Penerimaan"
              value={cashflow ? fmt(cashflow.operatingInflows) : "Rp —"}
              indent
              valueColor="var(--success)"
            />
            <StatementRow
              label="Total Pengeluaran"
              value={
                cashflow
                  ? `-${formatRupiah(cashflow.operatingOutflows)}`
                  : "Rp —"
              }
              indent
              valueColor="var(--destructive)"
            />
            <StatementRow
              label="Net Operasi"
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
              label="ARUS KAS INVESTASI"
              className="border-b-2 border-border"
              labelClass="py-2.5 font-bold text-brand-purple"
            />
            <StatementRow
              label="Net Investasi"
              value={cashflow ? fmt(cashflow.netInvesting) : "Rp —"}
              className="border-b border-border"
              labelClass="py-2 font-bold"
              valueClass="font-extrabold text-muted-foreground"
            />
            <StatementRow
              label="Saldo Awal"
              value={cashflow ? formatRupiah(cashflow.openingBalance) : "Rp —"}
              indent
              valueColor="var(--muted-foreground)"
            />
            <StatementRow
              label="Saldo Akhir"
              value={cashflow ? formatRupiah(cashflow.closingBalance) : "Rp —"}
              indent
              valueColor="var(--muted-foreground)"
            />
            <StatementRow
              label="NET CASHFLOW"
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
      </SectionCard>
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
  const chartMonths = summary?.points.map((p) => p.label) ?? [];
  const chartIncome = summary?.points.map((p) => p.income / 1_000_000) ?? [];
  const chartExpense = summary?.points.map((p) => p.expense / 1_000_000) ?? [];
  const chartMax = Math.max(...chartIncome, ...chartExpense, 1);

  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <SectionCard title="Arus Kas">
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          <MoneyStat
            label="Pemasukan"
            value={summary ? formatRupiah(summary.totalIncome) : "Rp —"}
            valueClass="text-success"
          />
          <MoneyStat
            label="Pengeluaran"
            value={summary ? formatRupiah(summary.totalExpense) : "Rp —"}
            valueClass="text-destructive"
          />
          <MoneyStat
            label="Surplus"
            value={summary ? formatRupiah(summary.netSavings) : "Rp —"}
            valueClass="text-success"
          />
          <MoneyStat
            label="Savings Rate"
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
      <SectionCard title="Sumber Pemasukan">
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
            Belum ada data pemasukan
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Section: Investasi ───────────────────────── */

const INV_TYPE_META: Record<InvestmentType, { label: string; color: string }> =
  {
    saham: { label: "📉 Saham", color: "var(--brand-cyan)" },
    reksa_dana: { label: "📊 Reksa Dana", color: "var(--primary)" },
    obligasi: { label: "🏛️ Obligasi", color: "var(--success)" },
    emas: { label: "🥇 Emas", color: "var(--warning)" },
    kripto: { label: "₿ Kripto", color: "#F97316" },
    lainnya: { label: "💼 Lainnya", color: "#8B5CF6" },
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
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";

  const byType = new Map<InvestmentType, number>();
  for (const inv of investments ?? []) {
    const val =
      parseFloat(inv.currentValue ?? inv.costBasisPerUnit) *
      parseFloat(inv.quantity);
    byType.set(inv.type, (byType.get(inv.type) ?? 0) + val);
  }

  const totalValue = parseFloat(invSummary?.totalCurrentValue ?? "0");
  const totalReturnRp = parseFloat(invSummary?.totalReturnRp ?? "0");
  const totalReturnPct = invSummary?.totalReturnPct ?? 0;

  const typeRows = Array.from(byType.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([type, value]) => ({
      ...INV_TYPE_META[type],
      value,
      pct: totalValue > 0 ? Math.round((value / totalValue) * 100) : 0,
    }));

  const maxValue = typeRows[0]?.value ?? 0;

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="flex items-center justify-between">
        <div className="text-[15px] font-bold">Portofolio Investasi</div>
        {onAdd && (
          <button
            onClick={onAdd}
            className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:opacity-90"
          >
            + Tambah
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <div className="rounded-[12px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">
            Total Portofolio
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
            Total Return
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
            {investments ? `${investments.length} instrumen` : "—"}
          </div>
        </div>
      </div>
      <SectionCard title="Portofolio per Jenis">
        {typeRows.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {typeRows.map((t) => (
              <BarRow
                key={t.label}
                label={t.label}
                right={
                  <span className="font-bold" style={{ color: t.color }}>
                    {formatRupiah(t.value)} · {t.pct}%
                  </span>
                }
                value={
                  maxValue > 0 ? Math.round((t.value / maxValue) * 100) : 0
                }
                color={t.color}
              />
            ))}
          </div>
        ) : (
          <div className="py-4 text-center text-[12px] text-muted-foreground">
            Belum ada investasi.{" "}
            {onAdd && (
              <button
                onClick={onAdd}
                className="text-primary underline underline-offset-2"
              >
                Tambah sekarang
              </button>
            )}
          </div>
        )}
      </SectionCard>
      {investments && investments.length > 0 && (
        <SectionCard title="Daftar Instrumen">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-semibold">Nama</th>
                  <th className="py-2 font-semibold">Jenis</th>
                  <th className="py-2 font-semibold">Nilai</th>
                  <th className="py-2 font-semibold">Return</th>
                  {(onEdit ?? onDelete) && (
                    <th className="py-2 font-semibold"></th>
                  )}
                </tr>
              </thead>
              <tbody>
                {investments.map((inv) => {
                  const val = parseFloat(inv.currentValue ?? "0");
                  const ret = parseFloat(inv.returnRp ?? "0");
                  const meta = INV_TYPE_META[inv.type];
                  return (
                    <tr key={inv.id} className="border-b last:border-0">
                      <td className="py-2.5">
                        <div className="font-semibold">{inv.ticker}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {inv.name}
                        </div>
                      </td>
                      <td className="py-2.5 text-[11px]">
                        {meta?.label ?? inv.type}
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
                                Edit
                              </button>
                            )}
                            {onDelete && (
                              <button
                                onClick={() => onDelete(inv)}
                                className="text-[11px] text-destructive hover:underline"
                              >
                                Hapus
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
            Total Aset
          </div>
          <div className="text-[22px] font-black text-success">
            {balanceSheet ? formatRupiah(balanceSheet.totalAssets) : "Rp —"}
          </div>
        </div>
        <div className="rounded-[12px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">
            Total Liabilitas
          </div>
          <div className="text-[22px] font-black text-destructive">
            {balanceSheet
              ? `-${formatRupiah(balanceSheet.totalLiabilities)}`
              : "Rp —"}
          </div>
        </div>
      </div>
      <SectionCard title="Rasio Keuangan">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md bg-muted p-3">
            <div className="text-[10.5px] text-muted-foreground">
              Debt-to-Asset Ratio
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
                ? "Sangat Aman (<30%)"
                : "Perlu Perhatian"}
            </div>
          </div>
          <div className="rounded-md bg-muted p-3">
            <div className="text-[10.5px] text-muted-foreground">Net Worth</div>
            <div
              className="text-[20px] font-extrabold"
              style={{ color: "var(--success)" }}
            >
              {balanceSheet ? formatJuta(balanceSheet.netWorth) : "—"}
            </div>
            <div className="text-[10.5px]" style={{ color: "var(--success)" }}>
              Aset - Liabilitas
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
  const savingsRate = summary?.savingsRate ?? null;
  const invReturn = invSummary?.totalReturnPct ?? null;
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <SectionCard title="Performa vs Target">
        <div className="flex flex-col gap-2.5">
          {savingsRate !== null && (
            <BarRow
              label="Savings Rate (Target 30%)"
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
                    ? " · Tercapai ✓"
                    : " · Perlu ditingkatkan"}
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
              label="Investment Return (Target 12%)"
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
                  {invReturn >= 12 ? " · Terlampaui ✓" : ""}
                </StatusBadge>
              }
              value={Math.min(Math.max(invReturn, 0), 100)}
              color={invReturn >= 12 ? "var(--success)" : "var(--warning)"}
            />
          )}
          {savingsRate === null && invReturn === null && (
            <div className="py-6 text-center text-[12px] text-muted-foreground">
              Belum ada data untuk menghitung performa
            </div>
          )}
        </div>
        <div className="mt-3 text-[11px] text-muted-foreground">
          Net Worth Growth dan Budget Adherence memerlukan data historis lebih
          lengkap
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
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const hasIncome = grossIncome != null && grossIncome > 0;

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="text-[15px] font-bold">
        Laporan Pajak — Estimasi PPh 21
      </div>

      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <StatTile
          label="Bruto Setahun"
          value={grossIncome != null ? formatRupiah(grossIncome) : "Rp —"}
        />
        <StatTile
          label="PKP"
          value={pph21 ? formatRupiah(pph21.pkp) : "Rp —"}
        />
        <StatTile
          label="Estimasi PPh 21"
          value={pph21 ? formatRupiah(pph21.totalTax) : "Rp —"}
          valueClass="text-destructive"
        />
        <StatTile
          label="Tarif Efektif"
          value={pph21 ? `${(pph21.effectiveRate * 100).toFixed(2)}%` : "—"}
          valueClass="text-primary"
        />
      </div>

      <SectionCard title="Perhitungan">
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            <StatementRow
              label="Penghasilan Bruto Setahun"
              value={grossIncome != null ? formatRupiah(grossIncome) : "Rp —"}
            />
            <StatementRow
              label="Biaya Jabatan (5%, maks Rp 6 jt)"
              value={pph21 ? `-${formatRupiah(pph21.biayaJabatan)}` : "Rp —"}
              indent
            />
            <StatementRow
              label="PTKP (TK/0)"
              value={pph21 ? `-${formatRupiah(pph21.ptkp)}` : "Rp —"}
              indent
            />
            {pph21 && pph21.zakatDeduction > 0 && (
              <StatementRow
                label="Pengurang Zakat"
                value={`-${formatRupiah(pph21.zakatDeduction)}`}
                indent
              />
            )}
            <StatementRow
              label="Penghasilan Kena Pajak (PKP)"
              value={pph21 ? formatRupiah(pph21.pkp) : "Rp —"}
              className="border-t border-border"
              labelClass="py-2 font-bold"
              valueClass="font-extrabold"
            />
          </tbody>
        </table>
      </SectionCard>

      {pph21 && pph21.taxBreakdown.length > 0 && (
        <SectionCard title="Rincian per Lapisan Tarif (UU HPP)">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-semibold">Lapisan</th>
                  <th className="py-2 font-semibold">Dasar Kena Pajak</th>
                  <th className="py-2 font-semibold">Tarif</th>
                  <th className="py-2 text-right font-semibold">Pajak</th>
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
                    Total PPh 21 Setahun
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
          Belum ada data penghasilan dalam 12 bulan terakhir untuk dihitung.
        </div>
      )}

      <div className="flex items-start gap-3 rounded-[12px] border border-primary/20 bg-accent p-3.5">
        <div className="text-[20px]">🧾</div>
        <div className="flex-1 text-[12px] text-muted-foreground">
          Estimasi sederhana berbasis penghasilan 12 bulan terakhir dengan
          asumsi status PTKP <strong>TK/0</strong> (lajang, tanpa tanggungan).
          Untuk status pernikahan/tanggungan lain, gunakan{" "}
          <a
            href="/kalkulator"
            className="font-bold text-primary hover:underline"
          >
            Kalkulator PPh 21
          </a>
          .
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Export Section ───────────────────────── */

const EXPORT_REPORT_TYPES: { id: ExportReportType; label: string }[] = [
  { id: "summary", label: "Ringkasan" },
  { id: "bank", label: "Bank" },
  { id: "detail", label: "Detail" },
  { id: "pnl", label: "PNL" },
  { id: "balance-sheet", label: "Balance Sheet" },
  { id: "cashflow", label: "Cashflow" },
];

function ExportSection({
  familyGroupId,
  accessToken,
}: {
  familyGroupId: string;
  accessToken: string | undefined;
}) {
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
            toast.success("Ekspor selesai! Klik Download untuk mengunduh.");
          } else {
            toast.error(`Ekspor gagal: ${res.errorMessage ?? "unknown error"}`);
          }
        }
      } catch {
        stopPolling();
        toast.error("Gagal mengambil status ekspor.");
      }
    },
    [familyGroupId, accessToken, stopPolling],
  );

  const startExport = useCallback(
    async (format: "pdf" | "excel") => {
      if (!familyGroupId || !accessToken) {
        toast.error("Sesi tidak valid.");
        return;
      }
      stopPolling();
      setIsSubmitting(true);
      setJobId(null);
      setStatus(null);

      const reqBody: ExportJobRequestDto = { type: reportType, format };

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
        toast(`Membuat ekspor ${format.toUpperCase()}...`);

        pollRef.current = setInterval(() => {
          void pollStatus(res.id);
        }, 2000);
      } catch {
        toast.error("Gagal membuat ekspor.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [familyGroupId, accessToken, reportType, stopPolling, pollStatus],
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
        <div className="text-[13px] font-bold">Export Laporan</div>
        {isDone && status.downloadUrl && (
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground transition-colors hover:opacity-90"
          >
            <Download className="size-3.5" /> Download
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-muted-foreground">
            Tipe Laporan
          </label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ExportReportType)}
            disabled={!!isActive || isSubmitting}
            className="rounded-md border bg-background px-3 py-[7px] text-[13px] outline-none focus:border-primary disabled:opacity-50"
          >
            {EXPORT_REPORT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => void startExport("pdf")}
          disabled={!!isActive || isSubmitting}
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3.5 py-[8px] text-[12px] font-semibold transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="size-3.5" /> Export PDF
        </button>
        <button
          onClick={() => void startExport("excel")}
          disabled={!!isActive || isSubmitting}
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3.5 py-[8px] text-[12px] font-semibold transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FileSpreadsheet className="size-3.5" /> Export Excel
        </button>
      </div>
      {status && (
        <div className="mt-3 flex items-center gap-2 text-[12px]">
          <span className="text-muted-foreground">Status:</span>
          <span
            className={
              status.status === "done"
                ? "font-semibold text-success"
                : status.status === "failed"
                  ? "font-semibold text-destructive"
                  : "font-semibold text-primary"
            }
          >
            {status.status === "pending" && "Menunggu..."}
            {status.status === "processing" && "Memproses..."}
            {status.status === "done" && "Selesai"}
            {status.status === "failed" &&
              `Gagal: ${status.errorMessage ?? ""}`}
          </span>
          {jobId && <span className="text-muted-foreground">#{jobId}</span>}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Page shell ───────────────────────── */

function LaporanInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const tab = sp.get("tab") ?? "rsum";

  const { data: session } = useSession();
  const familyGroupId = session?.familyGroupId ?? "";
  const accessToken = session?.accessToken;

  const SUMMARY_MONTHS = 6;
  const enabled = Boolean(familyGroupId) && Boolean(session?.accessToken);
  const token = session?.accessToken;

  const { data: summary, isLoading: isSummaryLoading } =
    useQuery<ReportSummaryDto>({
      queryKey: queryKeys.reports.summary(familyGroupId, SUMMARY_MONTHS),
      queryFn: () =>
        apiFetch<ReportSummaryDto>(
          `/family-groups/${familyGroupId}/reports/summary?months=${SUMMARY_MONTHS}`,
          { token },
        ),
      enabled,
      staleTime: 60_000,
    });

  const { startDate: monthStart, endDate: monthEnd } = getMonthDateRange();
  const { startDate: todayStart, endDate: todayEnd } = getTodayDateRange();

  const { data: bankReport, isLoading: isBankLoading } =
    useQuery<BankReportDto>({
      queryKey: queryKeys.reports.bank(familyGroupId, monthStart, monthEnd),
      queryFn: () =>
        apiFetch<BankReportDto>(
          `/family-groups/${familyGroupId}/reports/bank?startDate=${monthStart}&endDate=${monthEnd}`,
          { token },
        ),
      enabled: enabled && tab === "rbank",
      staleTime: 60_000,
    });

  const { data: detailReport, isLoading: isDetailLoading } =
    useQuery<DetailReportDto>({
      queryKey: queryKeys.reports.detail(familyGroupId, monthStart, monthEnd),
      queryFn: () =>
        apiFetch<DetailReportDto>(
          `/family-groups/${familyGroupId}/reports/detail?startDate=${monthStart}&endDate=${monthEnd}`,
          { token },
        ),
      enabled: enabled && tab === "rdetail",
      staleTime: 60_000,
    });

  const { data: dailyReport, isLoading: isDailyLoading } =
    useQuery<DetailReportDto>({
      queryKey: queryKeys.reports.detail(familyGroupId, todayStart, todayEnd),
      queryFn: () =>
        apiFetch<DetailReportDto>(
          `/family-groups/${familyGroupId}/reports/detail?startDate=${todayStart}&endDate=${todayEnd}`,
          { token },
        ),
      enabled: enabled && tab === "rharian",
      staleTime: 30_000,
    });

  const { data: pnl, isLoading: isPnlLoading } = useQuery<PnlDto>({
    queryKey: queryKeys.reports.pnl(familyGroupId, monthStart, monthEnd),
    queryFn: () =>
      apiFetch<PnlDto>(
        `/family-groups/${familyGroupId}/reports/pnl?startDate=${monthStart}&endDate=${monthEnd}`,
        { token },
      ),
    enabled: enabled && tab === "rpnl",
    staleTime: 60_000,
  });

  const { data: balanceSheet, isLoading: isBalanceLoading } =
    useQuery<BalanceSheetDto>({
      queryKey: queryKeys.reports.balanceSheet(familyGroupId, monthEnd),
      queryFn: () =>
        apiFetch<BalanceSheetDto>(
          `/family-groups/${familyGroupId}/reports/balance-sheet?asOfDate=${monthEnd}`,
          { token },
        ),
      enabled:
        enabled && (tab === "rbalance" || tab === "rasl" || tab === "rsum"),
      staleTime: 60_000,
    });

  const { data: cashflow, isLoading: isCashflowLoading } =
    useQuery<CashflowStatementDto>({
      queryKey: queryKeys.reports.cashflow(familyGroupId, monthStart, monthEnd),
      queryFn: () =>
        apiFetch<CashflowStatementDto>(
          `/family-groups/${familyGroupId}/reports/cashflow?startDate=${monthStart}&endDate=${monthEnd}`,
          { token },
        ),
      enabled: enabled && tab === "rcashflow",
      staleTime: 60_000,
    });

  const { data: sankeyData, isLoading: isSankeyLoading } = useQuery<SankeyDto>({
    queryKey: queryKeys.reports.sankey(familyGroupId, monthStart, monthEnd),
    queryFn: () =>
      apiFetch<SankeyDto>(
        `/family-groups/${familyGroupId}/reports/sankey?startDate=${monthStart}&endDate=${monthEnd}`,
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

  const { data: yearlySummary, isLoading: isYearlyLoading } =
    useQuery<ReportSummaryDto>({
      queryKey: queryKeys.reports.summary(familyGroupId, 3, "yearly"),
      queryFn: () =>
        apiFetch<ReportSummaryDto>(
          `/family-groups/${familyGroupId}/reports/summary?months=3&period=yearly`,
          { token },
        ),
      enabled: enabled && tab === "rtahunan",
      staleTime: 300_000,
    });

  // T-902: Group Family consolidated report (member roster + group totals)
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

  const { data: familyNetWorth, isLoading: isNetWorthLoading } =
    useQuery<NetWorthDto>({
      queryKey: queryKeys.netWorth.summary(familyGroupId),
      queryFn: () =>
        apiFetch<NetWorthDto>(
          `/family-groups/${familyGroupId}/dashboard/net-worth`,
          { token },
        ),
      enabled: enabled && tab === "rfamily",
      staleTime: 60_000,
    });

  // T-903: PPh 21 estimate from last-12-months income
  const { data: annualSummary, isLoading: isAnnualLoading } =
    useQuery<ReportSummaryDto>({
      queryKey: queryKeys.reports.summary(familyGroupId, 12, "monthly"),
      queryFn: () =>
        apiFetch<ReportSummaryDto>(
          `/family-groups/${familyGroupId}/reports/summary?months=12&period=monthly`,
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
      toast.success(isEdit ? "Investasi diperbarui" : "Investasi ditambahkan");
      setShowAddInv(false);
      setEditingInv(null);
    } catch {
      toast.error(
        isEdit ? "Gagal memperbarui investasi" : "Gagal menambahkan investasi",
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
      toast.success("Investasi dihapus");
      setDeletingInv(null);
    } catch {
      toast.error("Gagal menghapus investasi");
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
          <HarianSection dailyReport={dailyReport} isLoading={isDailyLoading} />
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
          <AliranSection sankeyData={sankeyData} isLoading={isSankeyLoading} />
        );
      case "rpnl":
        return <PnlSection pnl={pnl} isLoading={isPnlLoading} />;
      case "rbalance":
        return (
          <BalanceSection
            balanceSheet={balanceSheet}
            isLoading={isBalanceLoading}
          />
        );
      case "rcashflow":
        return (
          <CashflowSection cashflow={cashflow} isLoading={isCashflowLoading} />
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
          Pantau keuangan dan investasi kamu
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toast("📅 Pilih rentang tanggal")}
            className="flex size-9 items-center justify-center rounded-md border bg-card text-muted-foreground transition-colors hover:bg-accent"
            aria-label="Kalender"
          >
            <Calendar className="size-[15px]" />
          </button>
          <select className="rounded-md border bg-card px-3 py-[7px] text-xs text-foreground outline-none">
            <option>April 2025</option>
            <option>Maret 2025</option>
            <option>Februari 2025</option>
          </select>
          <button
            onClick={() => toast("📥 Mengunduh laporan...")}
            className="flex size-9 items-center justify-center rounded-md border bg-card text-muted-foreground transition-colors hover:bg-accent"
            aria-label="Unduh"
          >
            <Download className="size-[15px]" />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="hide-scrollbar flex gap-0.5 overflow-x-auto rounded-md border bg-background p-1">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              onClick={() => go(t.id)}
              className={
                "whitespace-nowrap rounded px-3.5 py-2 text-[13px] font-semibold transition-colors " +
                (active
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Export */}
      {familyGroupId && (
        <ExportSection
          familyGroupId={familyGroupId}
          accessToken={accessToken}
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
              {editingInv ? "Edit Investasi" : "Tambah Investasi"}
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
                  {field === "ticker" ? "Ticker" : "Nama"}
                </label>
                <input
                  required
                  value={invForm[field]}
                  onChange={(e) =>
                    setInvForm((f) => ({ ...f, [field]: e.target.value }))
                  }
                  placeholder={
                    field === "ticker"
                      ? "contoh: BBCA"
                      : "contoh: Bank Central Asia"
                  }
                  className="w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            ))}
            <div className="space-y-1">
              <label className="text-[12px] text-muted-foreground">Jenis</label>
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
                ).map((t) => (
                  <option key={t} value={t}>
                    {t.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            {(["quantity", "costBasisPerUnit"] as const).map((field) => (
              <div key={field} className="space-y-1">
                <label className="text-[12px] text-muted-foreground">
                  {field === "quantity"
                    ? "Jumlah (lot/unit)"
                    : "Harga Beli per Unit (Rp)"}
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
                {invSubmitting ? "Menyimpan..." : "Simpan"}
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
            <DialogTitle>Hapus Investasi</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-muted-foreground">
            Yakin ingin menghapus{" "}
            <span className="font-semibold text-foreground">
              {deletingInv?.ticker} — {deletingInv?.name}
            </span>
            ? Tindakan ini tidak dapat dibatalkan.
          </p>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setDeletingInv(null)}
              disabled={invSubmitting}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void handleInvDelete();
              }}
              disabled={invSubmitting}
            >
              {invSubmitting ? "Menghapus..." : "Hapus"}
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
