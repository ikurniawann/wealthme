"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Gem, Eye, ArrowUp, ArrowDown } from "lucide-react";
import { Sparkline } from "@/components/charts/sparkline";
import {
  Donut,
  DonutLegend,
  type DonutSegment,
} from "@/components/charts/donut";
import { BarChart } from "@/components/charts/bar-chart";
import {
  HeroCard,
  SectionCard,
  CardLink,
  SummaryCard,
  ProgressBar,
} from "@/components/wm";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { formatRupiah, formatRupiahCompact } from "@/lib/format";
import type { DashboardSummaryDto } from "@wealthme/contracts";

const PERIODS = ["1M", "3M", "6M", "1Y", "All"] as const;

const ACCOUNT_TYPE_ICON: Record<string, { icon: string; iconBg: string }> = {
  bank: { icon: "🏦", iconBg: "#DBEAFE" },
  ewallet: { icon: "💵", iconBg: "#DCFCE7" },
  investment: { icon: "📈", iconBg: "#EDE9FE" },
  property: { icon: "🏠", iconBg: "#FEF9C3" },
  cash: { icon: "💵", iconBg: "#DCFCE7" },
};

// TODO: EPIC-002 Task 5 — Replace with real data from /goals endpoint
const GOALS = [
  {
    icon: "🛡️",
    iconBg: "#EEF2FF",
    name: "Dana Darurat",
    pct: 80,
    color: "var(--success)",
    now: "Rp 24 jt",
    target: "Rp 30 jt",
  },
  {
    icon: "✈️",
    iconBg: "#DBEAFE",
    name: "Liburan Jepang",
    pct: 62,
    color: "var(--primary)",
    now: "Rp 15,6 jt",
    target: "Rp 25 jt",
  },
  {
    icon: "🏠",
    iconBg: "#FEF9C3",
    name: "DP Rumah",
    pct: 40,
    color: "var(--warning)",
    now: "Rp 120 jt",
    target: "Rp 300 jt",
  },
  {
    icon: "🏖️",
    iconBg: "#EDE9FE",
    name: "Dana Pensiun",
    pct: 25,
    color: "var(--brand-purple)",
    now: "Rp 250 jt",
    target: "Rp 1 M",
  },
];

const SPARK_LABELS = ["Hari 1", "Hari 8", "Hari 15", "Hari 22", "Hari 30"];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}

function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Hari ini";
  if (diffDays === 1) return "Kemarin";
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export default function BerandaPage() {
  const router = useRouter();
  const { data: session } = useSession();
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

  // Donut allocation segments
  const allocation: DonutSegment[] = (summary?.allocation ?? []).map(
    (item) => ({
      label: item.label,
      value: item.value,
      color: item.color,
      sub: formatRupiah(item.amount),
    }),
  );

  // Summary cards from account summary
  const summaryCards = (summary?.accountSummary ?? []).map((s) => {
    const cfg = ACCOUNT_TYPE_ICON[s.type] ?? { icon: "💰", iconBg: "#F3F4F6" };
    return {
      icon: cfg.icon,
      iconBg: cfg.iconBg,
      label: s.label,
      amount: formatRupiahCompact(s.total),
      delta: "—",
      up: true as boolean,
    };
  });

  // Add liabilities placeholder if not present (no liability type in schema)
  const hasLiability = false;
  if (!hasLiability) {
    summaryCards.push({
      icon: "🎯",
      iconBg: "#FEE2E2",
      label: "Liabilitas",
      amount: "Rp 0",
      delta: "—",
      up: false,
    });
  }

  // Activities from recent transactions
  const activities = (summary?.recentTransactions ?? []).map((tx) => ({
    icon: tx.type === "income" ? "📥" : tx.type === "expense" ? "💳" : "🔄",
    iconBg: tx.type === "income" ? "#DCFCE7" : "#FEE2E2",
    name: tx.description ?? tx.accountName,
    cat:
      tx.categoryName ??
      (tx.type === "income"
        ? "Pemasukan"
        : tx.type === "expense"
          ? "Pengeluaran"
          : "Transfer"),
    amt: (tx.type === "income" ? "+" : "-") + formatRupiah(tx.amount),
    inc: tx.type === "income",
    date: formatRelativeDate(tx.occurredAt),
  }));

  const sparklinePoints =
    summary?.sparkline && summary.sparkline.length > 0
      ? summary.sparkline
      : (Array(30).fill(50) as number[]);

  const cashflow = summary?.cashflow;
  const netWorth = summary?.netWorth ?? 0;
  const currentMonth = summary?.currentMonth;

  if (isError) {
    return (
      <div className="flex items-center justify-center py-16 text-[13px] text-muted-foreground">
        Gagal memuat data beranda. Coba muat ulang halaman.
      </div>
    );
  }

  // Net worth center label for donut (compact)
  const donutCenterValue =
    netWorth >= 1_000_000_000
      ? (netWorth / 1_000_000_000).toFixed(2).replace(".", ",") + "M"
      : netWorth >= 1_000_000
        ? (netWorth / 1_000_000).toFixed(0) + " jt"
        : formatRupiah(netWorth);

  return (
    <div className="space-y-3.5">
      <div className="mb-[18px]">
        <div className="text-[21px] font-extrabold">
          {getGreeting()}, {firstName} 👋
        </div>
        <div className="mt-0.5 text-[12.5px] text-muted-foreground">
          Yuk, lihat perkembangan keuanganmu hari ini.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {/* Wealth Hero */}
        <HeroCard className="gradient-wealth">
          <div className="flex items-center gap-1.5 text-[12.5px] font-semibold opacity-90">
            <Gem className="size-[13px] opacity-80" /> Total Kekayaan Bersih
            <Eye className="ml-0.5 size-[13px] cursor-pointer opacity-60" />
          </div>
          <div className="mt-1 text-[28px] font-extrabold tracking-tight">
            {isLoading ? "Memuat..." : formatRupiah(netWorth)}
          </div>
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
                {formatRupiah(Math.abs(currentMonth.net))} bulan ini
              </span>{" "}
              <span className="opacity-60">
                (tabungan {currentMonth.savingsRate}%)
              </span>
            </div>
          )}

          <div className="mt-3.5 flex gap-1.5">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
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
            <Sparkline points={sparklinePoints} />
            <div className="mt-1 flex justify-between px-[22px] text-[10px] opacity-60">
              {SPARK_LABELS.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
          </div>
        </HeroCard>

        {/* Allocation */}
        <SectionCard
          title="Alokasi Kekayaan"
          action={
            <CardLink onClick={() => router.push("/aset")}>
              Lihat detail
            </CardLink>
          }
        >
          {isLoading ? (
            <div className="flex h-[105px] items-center justify-center text-[13px] text-muted-foreground">
              Memuat...
            </div>
          ) : allocation.length === 0 ? (
            <div className="flex h-[105px] items-center justify-center text-[13px] text-muted-foreground">
              Belum ada data
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3.5">
              <Donut
                segments={allocation}
                size={105}
                thickness={17}
                centerValue={donutCenterValue}
                centerLabel="Total"
              />
              <div className="min-w-[110px] flex-1">
                <DonutLegend segments={allocation} total={100} />
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {isLoading
          ? Array(5)
              .fill(null)
              .map((_, i) => (
                <div
                  key={i}
                  className="h-[88px] animate-pulse rounded-[14px] bg-muted"
                />
              ))
          : summaryCards.slice(0, 5).map((s) => (
              <SummaryCard
                key={s.label}
                icon={s.icon}
                iconBg={s.iconBg}
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
            ))}
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        {/* Cashflow */}
        <SectionCard
          title="Arus Kas Bulanan"
          action={
            <select className="rounded-md border bg-background px-2 py-[3px] text-[11px] text-muted-foreground outline-none">
              <option>
                {cashflow?.months[cashflow.months.length - 1] ?? "—"} (terkini)
              </option>
            </select>
          }
        >
          <div className="mb-2.5 flex flex-wrap gap-4">
            <div>
              <div className="text-[10.5px] text-muted-foreground">
                Pemasukan
              </div>
              <div className="text-[15px] font-extrabold text-success">
                {isLoading ? "..." : formatRupiah(currentMonth?.income ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-[10.5px] text-muted-foreground">
                Pengeluaran
              </div>
              <div className="text-[15px] font-extrabold text-destructive">
                {isLoading ? "..." : formatRupiah(currentMonth?.expense ?? 0)}
              </div>
            </div>
          </div>
          <div className="mb-2 text-[11px] text-muted-foreground">
            Surplus:{" "}
            <span className="font-bold text-success">
              {isLoading ? "..." : formatRupiah(currentMonth?.net ?? 0)}
            </span>
          </div>
          {cashflow && (
            <BarChart
              months={cashflow.months}
              income={cashflow.income}
              expense={cashflow.expense}
              max={cashflow.max}
              height={90}
            />
          )}
        </SectionCard>

        {/* Recent activity */}
        <SectionCard
          title="Aktivitas Terbaru"
          action={
            <CardLink onClick={() => router.push("/transaksi")}>
              Lihat semua
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
              Belum ada transaksi
            </div>
          ) : (
            <div className="divide-y">
              {activities.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div
                    className="flex size-[34px] items-center justify-center rounded-md text-[15px]"
                    style={{ background: a.iconBg }}
                  >
                    {a.icon}
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold">{a.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {a.cat}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-[13px] font-bold ${a.inc ? "text-success" : "text-destructive"}`}
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

        {/* Goals — kept as mock until Task 5 */}
        <SectionCard
          title="Tujuan Keuangan"
          action={
            <CardLink onClick={() => router.push("/tujuan")}>
              Lihat semua
            </CardLink>
          }
        >
          <div className="space-y-3.5">
            {GOALS.map((g) => (
              <div key={g.name}>
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
                <ProgressBar value={g.pct} color={g.color} />
                <div className="mt-1 flex justify-between text-[10.5px] text-muted-foreground">
                  <span>{g.now}</span>
                  <span>{g.target}</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* AI insight banner */}
      <div className="flex items-center gap-3.5 rounded-[14px] bg-accent p-4">
        <div className="text-[26px]">📊</div>
        <div className="flex-1">
          <div className="text-[13px] font-bold text-primary-strong">
            Tingkatkan kesehatan keuanganmu!
          </div>
          <div className="mt-0.5 text-[12px] text-muted-foreground">
            Isi profil risiko untuk mendapatkan rekomendasi investasi yang
            sesuai tujuanmu.
          </div>
        </div>
        <button
          onClick={() => router.push("/ai")}
          className="cursor-pointer rounded-lg bg-primary px-3.5 py-2 text-[12px] font-semibold whitespace-nowrap text-primary-foreground hover:opacity-90"
        >
          Isi Profil Risiko →
        </button>
      </div>
    </div>
  );
}
