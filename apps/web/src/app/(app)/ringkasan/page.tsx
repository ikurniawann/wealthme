"use client";

import { useSession } from "@/lib/auth-compat";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { SectionCard, StatusBadge, ProgressBar } from "@/components/wm";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { formatRupiah, formatRupiahCompact } from "@/lib/format";
import { buildNetWorthTrendPath } from "@/lib/chart-utils";
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
            Total Liabilitas
          </div>
          <div className="text-[20px] font-black text-muted-foreground">
            {isLoading || isNetWorthLoading
              ? "..."
              : formatRupiahCompact(totalLiabilities)}
          </div>
          <div className="text-[11px] text-muted-foreground">Kewajiban</div>
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
        <SectionCard title="Tren Kekayaan Bersih (6 Bulan)">
          {isLoading ? (
            <div className="h-[90px] animate-pulse rounded-md bg-muted" />
          ) : trend.points.length === 0 ? (
            <div className="flex h-[90px] items-center justify-center text-[12px] text-muted-foreground">
              Belum ada data cashflow
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
              Tambah saldo akun untuk melihat komposisi aset.
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

        <SectionCard title="Top Pengeluaran">
          <div className="divide-y">
            {isLoading && (
              <div className="py-4 text-center text-[13px] text-muted-foreground">
                Memuat...
              </div>
            )}
            {!isLoading && topExpenses.length === 0 && (
              <div className="py-4 text-center text-[13px] text-muted-foreground">
                Belum ada pengeluaran bulan ini.
              </div>
            )}
            {topExpenses.slice(0, 5).map((t, idx) => (
              <div
                key={t.categoryName}
                className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
              >
                <div
                  className="flex size-[30px] shrink-0 items-center justify-center rounded-md text-[13px]"
                  style={{
                    background:
                      t.color ??
                      ["#EEF2FF", "#DCFCE7", "#FEF9C3", "#FEE2E2", "#F3F4F6"][
                        idx % 5
                      ],
                  }}
                >
                  {["🏠", "😊", "🚗", "🏥", "💡"][idx % 5]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">
                    {t.categoryName}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge variant="gray">{t.percentage}%</StatusBadge>
                  <div className="text-right">
                    <div className="text-[13px] font-bold text-destructive">
                      {formatRupiah(t.amount)}
                    </div>
                  </div>
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
                stroke="var(--primary)"
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
              Financial Health Score
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
