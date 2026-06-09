"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { SectionCard, StatusBadge, ProgressBar } from "@/components/wm";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { formatRupiah, formatRupiahCompact } from "@/lib/format";
import type { DashboardSummaryDto } from "@wealthme/contracts";

// TODO: EPIC-002 — Replace with real category spending data when transactions groupBy endpoint is available
const TOP_SPENDING = [
  {
    icon: "🏠",
    iconBg: "#EEF2FF",
    name: "Kebutuhan",
    amt: "Rp 8.069.600",
    pct: "44%",
    variant: "info" as const,
  },
  {
    icon: "😊",
    iconBg: "#DCFCE7",
    name: "Gaya Hidup",
    amt: "Rp 4.585.000",
    pct: "25%",
    variant: "success" as const,
  },
  {
    icon: "🚗",
    iconBg: "#FEF9C3",
    name: "Transportasi",
    amt: "Rp 2.200.000",
    pct: "12%",
    variant: "warning" as const,
  },
  {
    icon: "🏥",
    iconBg: "#FEE2E2",
    name: "Kesehatan",
    amt: "Rp 1.467.000",
    pct: "8%",
    variant: "danger" as const,
  },
];

const COMPOSITION_COLOR: Record<string, string> = {
  bank: "var(--brand-cyan)",
  ewallet: "var(--success)",
  investment: "var(--primary)",
  property: "var(--warning)",
  cash: "var(--muted-foreground)",
};

export default function RingkasanPage() {
  const { data: session } = useSession();
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

  const netWorth = summary?.netWorth ?? 0;
  const totalAssets = (summary?.accountSummary ?? []).reduce(
    (sum, s) => sum + (s.total > 0 ? s.total : 0),
    0,
  );
  const savingsRate = summary?.currentMonth.savingsRate ?? 0;
  const monthIncome = summary?.currentMonth.income ?? 0;
  const monthExpense = summary?.currentMonth.expense ?? 0;
  const monthNet = summary?.currentMonth.net ?? 0;

  const composition = (summary?.allocation ?? []).map((item) => ({
    label: item.label,
    value: `${formatRupiahCompact(item.amount)} · ${item.value}%`,
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
        Gagal memuat data ringkasan. Coba muat ulang halaman.
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {/* Top stat cards */}
      <div className="mb-[18px] grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <Card className="gap-0 border-none gradient-wealth p-5 text-white">
          <div className="mb-1.5 text-[11px] opacity-80">
            Total Kekayaan Bersih
          </div>
          <div className="text-[20px] font-black">
            {isLoading ? "..." : formatRupiahCompact(netWorth)}
          </div>
          <div className="mt-1 text-[11px] text-emerald-300">
            {isLoading
              ? "..."
              : monthNet >= 0
                ? `▲ ${formatRupiahCompact(monthNet)} bulan ini`
                : `▼ ${formatRupiahCompact(Math.abs(monthNet))} bulan ini`}
          </div>
        </Card>
        <Card className="gap-0 p-5">
          <div className="mb-1.5 text-[11px] text-muted-foreground">
            Total Aset
          </div>
          <div className="text-[20px] font-black text-success">
            {isLoading ? "..." : formatRupiahCompact(totalAssets)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {summary?.accountSummary.length
              ? `${summary.accountSummary.length} jenis akun`
              : "—"}
          </div>
        </Card>
        <Card className="gap-0 p-5">
          <div className="mb-1.5 text-[11px] text-muted-foreground">
            Surplus Bulan Ini
          </div>
          <div
            className={`text-[20px] font-black ${monthNet >= 0 ? "text-success" : "text-destructive"}`}
          >
            {isLoading ? "..." : formatRupiahCompact(monthNet)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {isLoading
              ? "..."
              : `Pemasukan ${formatRupiahCompact(monthIncome)}`}
          </div>
        </Card>
        <Card className="gap-0 p-5">
          <div className="mb-1.5 text-[11px] text-muted-foreground">
            Savings Rate
          </div>
          <div className="text-[20px] font-black text-primary">
            {isLoading ? "..." : `${savingsRate}%`}
          </div>
          <div className="text-[11px] text-success">
            {monthExpense > 0
              ? `Pengeluaran ${formatRupiahCompact(monthExpense)}`
              : "—"}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {/* Net worth trend — static SVG placeholder; real chart is Task 6 */}
        <SectionCard title="Tren Kekayaan Bersih (6 Bulan)">
          <svg
            viewBox="0 0 320 100"
            width="100%"
            height={90}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="ng" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(79,70,229,.15)" />
                <stop offset="100%" stopColor="rgba(79,70,229,.01)" />
              </linearGradient>
            </defs>
            <path
              d="M0,80 C30,75 60,70 80,65 C100,60 110,62 140,55 C160,50 170,45 200,38 C220,33 240,30 270,22 C285,18 300,15 320,8"
              fill="none"
              stroke="#4F46E5"
              strokeWidth="2.5"
            />
            <path
              d="M0,80 C30,75 60,70 80,65 C100,60 110,62 140,55 C160,50 170,45 200,38 C220,33 240,30 270,22 C285,18 300,15 320,8 L320,100 L0,100 Z"
              fill="url(#ng)"
            />
            <circle cx="320" cy="8" r="4" fill="#4F46E5" />
          </svg>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            {(
              summary?.cashflow.months ?? [
                "Nov",
                "Des",
                "Jan",
                "Feb",
                "Mar",
                "Apr",
              ]
            ).map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        </SectionCard>

        {/* Asset composition */}
        <SectionCard title="Komposisi Aset">
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
              Belum ada data
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {composition.map((c) => (
                <div key={c.label}>
                  <div className="mb-1 flex justify-between text-[12px]">
                    <span className="font-semibold">{c.label}</span>
                    <span className="font-bold" style={{ color: c.color }}>
                      {c.value}
                    </span>
                  </div>
                  <ProgressBar value={c.pct} color={c.color} height={8} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        {/* Cash Flow */}
        <SectionCard
          title={`Cash Flow ${summary?.cashflow.months.at(-1) ?? ""}`}
        >
          <div className="mb-2.5">
            <div className="text-[11px] text-muted-foreground">Pemasukan</div>
            <div className="text-[18px] font-extrabold text-success">
              {isLoading ? "..." : formatRupiah(monthIncome)}
            </div>
          </div>
          <div className="mb-2.5">
            <div className="text-[11px] text-muted-foreground">Pengeluaran</div>
            <div className="text-[18px] font-extrabold text-destructive">
              {isLoading ? "..." : formatRupiah(monthExpense)}
            </div>
          </div>
          <div className="border-t pt-2.5">
            <div className="text-[11px] text-muted-foreground">Surplus</div>
            <div
              className={`text-[18px] font-extrabold ${monthNet >= 0 ? "text-success" : "text-destructive"}`}
            >
              {isLoading ? "..." : formatRupiah(monthNet)}
            </div>
          </div>
        </SectionCard>

        {/* Top spending — TODO: replace with real category data */}
        <SectionCard title="Top Pengeluaran">
          <div className="divide-y">
            {TOP_SPENDING.map((t) => (
              <div
                key={t.name}
                className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
              >
                <div
                  className="flex size-[30px] items-center justify-center rounded-md text-[13px]"
                  style={{ background: t.iconBg }}
                >
                  {t.icon}
                </div>
                <div className="flex-1 text-[13px] font-semibold">{t.name}</div>
                <div className="text-right">
                  <div className="text-[13px] font-bold text-destructive">
                    {t.amt}
                  </div>
                  <StatusBadge variant={t.variant} className="mt-0.5">
                    {t.pct}
                  </StatusBadge>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Health Score */}
        <SectionCard title="Health Score">
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
                stroke="#4F46E5"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray="157"
                strokeDashoffset={
                  savingsRate > 0
                    ? Math.round(157 - (savingsRate / 100) * 157)
                    : 40
                }
              />
            </svg>
            <div className="-mt-3.5 text-[32px] font-black text-primary">
              {savingsRate > 0 ? savingsRate : 78}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Savings Rate Score
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
                  ? "Sehat"
                  : savingsRate >= 10
                    ? "Cukup"
                    : "Perlu Perhatian"}
              </StatusBadge>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
