"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
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
  PnlDto,
  ReportSummaryDto,
  SankeyDto,
} from "@wealthme/contracts";
import {
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

const WEALTH_ALLOC: DonutSegment[] = [
  { label: "Investasi", value: 45, color: "#4F46E5" },
  { label: "Properti", value: 25, color: "#10B981" },
  { label: "Cash", value: 20, color: "#F59E0B" },
  { label: "Bisnis", value: 8, color: "#8B5CF6" },
  { label: "Lainnya", value: 2, color: "#E2E8F0" },
];

function RingkasanSection({
  go,
  summary,
  isLoading,
}: {
  go: (id: string) => void;
  summary?: ReportSummaryDto;
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
            <Donut
              segments={WEALTH_ALLOC}
              size={110}
              thickness={16}
              centerValue="1,256 M"
              centerLabel="Total"
            />
            <div className="min-w-[120px] flex-1">
              <DonutLegend segments={WEALTH_ALLOC} />
            </div>
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
            <div className="text-[20px] font-black">Rp 565.551.000</div>
            <div className="mt-1 text-[12px] text-success">
              +Rp 75.551.000 ▲ 15,4%
            </div>
            <div className="text-[11px] text-success">
              Return hari ini: +Rp 1.250.000 (+0,22%)
            </div>
          </div>
          <div>
            <svg
              viewBox="0 0 260 80"
              width="100%"
              height={70}
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="ig-laporan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(79,70,229,.15)" />
                  <stop offset="100%" stopColor="rgba(79,70,229,.01)" />
                </linearGradient>
              </defs>
              <path
                d="M0,70 C30,65 60,58 90,50 C120,42 150,38 180,30 C210,22 230,18 260,10"
                fill="none"
                stroke="#4F46E5"
                strokeWidth={2}
              />
              <path
                d="M0,70 C30,65 60,58 90,50 C120,42 150,38 180,30 C210,22 230,18 260,10 L260,80 L0,80 Z"
                fill="url(#ig-laporan)"
              />
              <path
                d="M0,74 C30,72 60,68 90,64 C120,60 150,56 180,53 C210,50 230,47 260,44"
                fill="none"
                stroke="#10B981"
                strokeWidth={1.5}
                strokeDasharray="5,3"
              />
            </svg>
            <div className="mt-0.5 flex gap-2.5">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span
                  className="size-2 rounded-[2px]"
                  style={{ background: "#4F46E5" }}
                />{" "}
                Nilai
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span
                  className="size-2 rounded-[2px]"
                  style={{ background: "#10B981" }}
                />{" "}
                Modal
              </div>
            </div>
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

const BULANAN_ROWS = [
  { bulan: "April", masuk: "25,85 jt", keluar: "18,34 jt", net: "+7,51 jt" },
  { bulan: "Maret", masuk: "24,20 jt", keluar: "19,80 jt", net: "+4,40 jt" },
  { bulan: "Februari", masuk: "23,00 jt", keluar: "17,50 jt", net: "+5,50 jt" },
  { bulan: "Januari", masuk: "22,00 jt", keluar: "21,00 jt", net: "+1,00 jt" },
];

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
              {summary
                ? summary.points.map((p) => (
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
                : BULANAN_ROWS.map((r) => (
                    <tr key={r.bulan} className="border-b last:border-0">
                      <td className="py-2.5 font-semibold">{r.bulan}</td>
                      <td className="mono py-2.5 text-success">{r.masuk}</td>
                      <td className="mono py-2.5 text-destructive">
                        {r.keluar}
                      </td>
                      <td className="mono py-2.5 text-success">{r.net}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Section: Tahunan ───────────────────────── */

const TAHUNAN_GROWTH = [
  {
    year: "2025 (YTD)",
    value: "Rp 1.256.780.000",
    pct: 100,
    color: "var(--primary)",
  },
  {
    year: "2024",
    value: "Rp 1.085.000.000",
    pct: 86,
    color: "var(--brand-cyan)",
  },
  { year: "2023", value: "Rp 920.000.000", pct: 73, color: "var(--success)" },
];

function TahunanSection() {
  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[15px] font-bold">Laporan Tahunan</div>
        <select className="rounded-md border bg-background px-3 py-[7px] text-[13.5px] outline-none focus:border-primary">
          <option>2025 (YTD)</option>
          <option>2024</option>
          <option>2023</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <StatTile
          label="Total Pemasukan 2025"
          value="Rp 95.050.000"
          valueClass="text-success"
        />
        <StatTile
          label="Total Pengeluaran"
          value="Rp 76.640.000"
          valueClass="text-destructive"
        />
        <StatTile
          label="Net Tahunan"
          value="+Rp 18.410.000"
          valueClass="text-success"
        />
        <StatTile
          label="Avg Savings Rate"
          value="19,4%"
          valueClass="text-primary"
        />
      </div>
      <SectionCard title="Pertumbuhan Net Worth per Tahun">
        <div className="flex flex-col gap-2.5">
          {TAHUNAN_GROWTH.map((g) => (
            <BarRow
              key={g.year}
              label={g.year}
              right={
                <span style={{ color: g.color }} className="font-bold">
                  {g.value}
                </span>
              }
              value={g.pct}
              color={g.color}
            />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Section: Group Family ───────────────────────── */

const FAMILY_MEMBERS = [
  {
    initials: "IA",
    grad: "linear-gradient(135deg,var(--primary),var(--brand-purple))",
    name: "Irfan Arsandi",
    role: "Owner",
    amount: "Rp 12.500.000",
  },
  {
    initials: "SA",
    grad: "linear-gradient(135deg,#F97316,#FBBF24)",
    name: "Siti Arsandi",
    role: "Istri",
    amount: "Rp 9.800.000",
  },
  {
    initials: "BA",
    grad: "linear-gradient(135deg,#10B981,#06B6D4)",
    name: "Budi Arsandi",
    role: "Ayah",
    amount: "Rp 5.400.000",
  },
  {
    initials: "RA",
    grad: "linear-gradient(135deg,#8B5CF6,#EC4899)",
    name: "Rina Arsandi",
    role: "Adik",
    amount: "Rp 3.500.000",
  },
];

function FamilySection() {
  return (
    <div className="space-y-3.5">
      <div className="text-[15px] font-bold">
        Laporan Group Family — Arsandi Family
      </div>
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <StatTile
          label="Saldo Bersama"
          value="Rp 625.750.000"
          valueClass="text-primary"
        />
        <StatTile
          label="Pemasukan Family"
          value="Rp 42.000.000"
          valueClass="text-success"
        />
        <StatTile
          label="Pengeluaran Family"
          value="Rp 31.200.000"
          valueClass="text-destructive"
        />
        <StatTile
          label="Anggota Aktif"
          value="4 + 2 admin"
          valueClass="text-brand-purple"
        />
      </div>
      <SectionCard title="Pengeluaran per Anggota">
        {FAMILY_MEMBERS.map((m, i) => (
          <ActItem
            key={m.initials}
            icon={
              <span
                className="flex size-[38px] items-center justify-center rounded-full text-[12px] text-white"
                style={{ background: m.grad }}
              >
                {m.initials}
              </span>
            }
            iconBg="transparent"
            name={m.name}
            cat={m.role}
            right={
              <div className="text-[13px] font-bold text-destructive">
                {m.amount}
              </div>
            }
            last={i === FAMILY_MEMBERS.length - 1}
          />
        ))}
      </SectionCard>
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
    <div className="flex items-center gap-2">
      <div
        className="flex h-[28px] items-center rounded-[6px] px-2.5 text-[11px] font-bold text-white"
        style={{ width, background: grad }}
      >
        {label}
      </div>
      <span className="text-[11px] font-bold">{amount}</span>
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
              <div className="flex flex-col gap-1.5">
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
              <div className="flex flex-col gap-1.5">
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
}: {
  investments?: InvestmentDto[];
  invSummary?: InvestmentSummaryDto;
  isLoading?: boolean;
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
            Belum ada investasi. Tambah di menu Investasi.
          </div>
        )}
      </SectionCard>
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

const PERFORMA: {
  label: string;
  badge: string;
  badgeVariant: "success" | "warning" | "info" | "danger";
  pct: number;
  color: string;
}[] = [
  {
    label: "Savings Rate Target 30%",
    badge: "29% · Hampir",
    badgeVariant: "warning",
    pct: 29,
    color: "var(--warning)",
  },
  {
    label: "Investment Return Target 12%",
    badge: "15,4% · Terlampaui ✓",
    badgeVariant: "success",
    pct: 100,
    color: "var(--success)",
  },
  {
    label: "Net Worth Growth Target 10%",
    badge: "8,45% · Perlu Boost",
    badgeVariant: "info",
    pct: 84,
    color: "var(--primary)",
  },
  {
    label: "Budget Adherence Target 95%",
    badge: "88% · Perlu Perbaikan",
    badgeVariant: "danger",
    pct: 88,
    color: "var(--destructive)",
  },
];

function PerfSection() {
  return (
    <div className="space-y-3.5">
      <SectionCard title="Performa vs Target">
        <div className="flex flex-col gap-2.5">
          {PERFORMA.map((p) => (
            <BarRow
              key={p.label}
              label={p.label}
              right={
                <StatusBadge variant={p.badgeVariant}>{p.badge}</StatusBadge>
              }
              value={p.pct}
              color={p.color}
            />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Section: Pajak ───────────────────────── */

function PajakSection() {
  return (
    <div className="space-y-3.5">
      <SectionCard title="Estimasi Pajak 2025">
        <div className="mb-3 grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <div>
            <div className="mb-1 text-[11px] text-muted-foreground">
              Penghasilan Kena Pajak (est.)
            </div>
            <div className="text-[20px] font-extrabold">Rp 216.000.000</div>
          </div>
          <div>
            <div className="mb-1 text-[11px] text-muted-foreground">
              Estimasi PPh 21
            </div>
            <div className="text-[20px] font-extrabold text-destructive">
              Rp 21.600.000
            </div>
          </div>
        </div>
        <ActItem
          icon="💰"
          iconBg="#DBEAFE"
          iconSize="13px"
          name="PPh 21 (Gaji)"
          cat="Tarif 5%-15%"
          right={
            <div className="text-[13px] font-bold text-destructive">
              Rp 18.000.000
            </div>
          }
        />
        <ActItem
          icon="📊"
          iconBg="#EDE9FE"
          iconSize="13px"
          name="PPh Dividen"
          cat="Tarif final 10%"
          right={
            <div className="text-[13px] font-bold text-destructive">
              Rp 2.100.000
            </div>
          }
        />
        <ActItem
          icon="🏦"
          iconBg="#DCFCE7"
          iconSize="13px"
          name="PPh Bunga Deposito"
          cat="Tarif final 20%"
          right={
            <div className="text-[13px] font-bold text-destructive">
              Rp 1.500.000
            </div>
          }
          last
        />
      </SectionCard>
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
      enabled: enabled && (tab === "rbalance" || tab === "rasl"),
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
    enabled: enabled && tab === "rinv",
    staleTime: 60_000,
  });

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
        return <TahunanSection />;
      case "rfamily":
        return <FamilySection />;
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
        return <PerfSection />;
      case "rpajak":
        return <PajakSection />;
      case "rsum":
      default:
        return (
          <RingkasanSection
            go={go}
            summary={summary}
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
