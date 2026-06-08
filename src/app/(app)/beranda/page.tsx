"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gem, Eye, ArrowUp, ArrowDown } from "lucide-react";
import { CASHFLOW, SPARKLINE_POINTS } from "@/lib/data";
import { Sparkline } from "@/components/charts/sparkline";
import { Donut, DonutLegend, type DonutSegment } from "@/components/charts/donut";
import { BarChart } from "@/components/charts/bar-chart";
import {
  HeroCard,
  SectionCard,
  CardLink,
  SummaryCard,
  ProgressBar,
} from "@/components/wm";

const PERIODS = ["1M", "3M", "6M", "1Y", "All"] as const;

const ALLOCATION: DonutSegment[] = [
  { label: "Investasi", value: 46, color: "#4F46E5", sub: "Rp 577.200.000" },
  { label: "Rekening & Dana", value: 27, color: "#06B6D4", sub: "Rp 339.450.000" },
  { label: "Aset", value: 20, color: "#10B981", sub: "Rp 251.300.000" },
  { label: "Lainnya", value: 7, color: "#F59E0B" },
];

const SUMMARY = [
  { icon: "💵", iconBg: "#DCFCE7", label: "Dana Tersedia", amount: "Rp 68,45 jt", delta: "5,20%", up: true },
  { icon: "🏦", iconBg: "#DBEAFE", label: "Rekening", amount: "Rp 271 jt", delta: "3,15%", up: true },
  { icon: "📈", iconBg: "#EDE9FE", label: "Investasi", amount: "Rp 577,2 jt", delta: "12,40%", up: true },
  { icon: "🏠", iconBg: "#FEF9C3", label: "Aset", amount: "Rp 251,3 jt", delta: "6,37%", up: true },
  { icon: "🎯", iconBg: "#FEE2E2", label: "Liabilitas", amount: "-Rp 40,17 jt", delta: "1,08%", up: false, danger: true },
];

const ACTIVITIES = [
  { icon: "📥", iconBg: "#DCFCE7", name: "Transfer masuk BCA", cat: "Pemasukan", amt: "+Rp 5.000.000", inc: true, date: "Hari ini" },
  { icon: "💳", iconBg: "#FEE2E2", name: "Bayar Kartu Kredit", cat: "Pengeluaran", amt: "-Rp 1.250.000", inc: false, date: "Kemarin" },
  { icon: "👜", iconBg: "#FEE2E2", name: "Top up GoPay", cat: "Pengeluaran", amt: "-Rp 200.000", inc: false, date: "2 Mei" },
  { icon: "📊", iconBg: "#DCFCE7", name: "Dividen Saham BBCA", cat: "Pemasukan", amt: "+Rp 750.000", inc: true, date: "1 Mei" },
  { icon: "🏦", iconBg: "#FEE2E2", name: "Transfer ke Mandiri", cat: "Transfer", amt: "-Rp 2.000.000", inc: false, date: "30 Apr" },
];

const GOALS = [
  { icon: "🛡️", iconBg: "#EEF2FF", name: "Dana Darurat", pct: 80, color: "var(--success)", now: "Rp 24 jt", target: "Rp 30 jt" },
  { icon: "✈️", iconBg: "#DBEAFE", name: "Liburan Jepang", pct: 62, color: "var(--primary)", now: "Rp 15,6 jt", target: "Rp 25 jt" },
  { icon: "🏠", iconBg: "#FEF9C3", name: "DP Rumah", pct: 40, color: "var(--warning)", now: "Rp 120 jt", target: "Rp 300 jt" },
  { icon: "🏖️", iconBg: "#EDE9FE", name: "Dana Pensiun", pct: 25, color: "var(--brand-purple)", now: "Rp 250 jt", target: "Rp 1 M" },
];

const SPARK_LABELS = ["1 Apr", "8 Apr", "15 Apr", "22 Apr", "30 Apr"];

export default function BerandaPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("1M");

  return (
    <div className="space-y-3.5">
      <div className="mb-[18px]">
        <div className="text-[21px] font-extrabold">Selamat pagi, Irfan 👋</div>
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
          <div className="mt-1 text-[28px] font-extrabold tracking-tight">Rp 1.256.780.000</div>
          <div className="mt-1 text-[12.5px]">
            <span className="font-semibold text-emerald-300">▲ 8,45% (Rp 97.850.000)</span>{" "}
            <span className="opacity-60">dibanding bulan lalu</span>
          </div>

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
            <Sparkline points={SPARKLINE_POINTS} />
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
          action={<CardLink onClick={() => router.push("/aset")}>Lihat detail</CardLink>}
        >
          <div className="flex flex-wrap items-center gap-3.5">
            <Donut
              segments={ALLOCATION}
              size={105}
              thickness={17}
              centerValue="1.256M"
              centerLabel="Total"
            />
            <div className="min-w-[110px] flex-1">
              <DonutLegend segments={ALLOCATION} total={100} />
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Summary 5 cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {SUMMARY.map((s) => (
          <SummaryCard
            key={s.label}
            icon={s.icon}
            iconBg={s.iconBg}
            label={s.label}
            amount={s.amount}
            delta={
              <>
                {s.up ? <ArrowUp className="size-[9px]" /> : <ArrowDown className="size-[9px]" />}
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
              <option>April 2025</option>
              <option>Maret 2025</option>
            </select>
          }
        >
          <div className="mb-2.5 flex flex-wrap gap-4">
            <div>
              <div className="text-[10.5px] text-muted-foreground">Pemasukan</div>
              <div className="text-[15px] font-extrabold text-success">Rp 25.850.000</div>
            </div>
            <div>
              <div className="text-[10.5px] text-muted-foreground">Pengeluaran</div>
              <div className="text-[15px] font-extrabold text-destructive">Rp 18.340.000</div>
            </div>
          </div>
          <div className="mb-2 text-[11px] text-muted-foreground">
            Surplus: <span className="font-bold text-success">Rp 7.510.000</span>
          </div>
          <BarChart
            months={CASHFLOW.months}
            income={CASHFLOW.income}
            expense={CASHFLOW.expense}
            max={CASHFLOW.max}
            height={90}
          />
        </SectionCard>

        {/* Recent activity */}
        <SectionCard
          title="Aktivitas Terbaru"
          action={<CardLink onClick={() => router.push("/transaksi")}>Lihat semua</CardLink>}
        >
          <div className="divide-y">
            {ACTIVITIES.map((a, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div
                  className="flex size-[34px] items-center justify-center rounded-md text-[15px]"
                  style={{ background: a.iconBg }}
                >
                  {a.icon}
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold">{a.name}</div>
                  <div className="text-[11px] text-muted-foreground">{a.cat}</div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-[13px] font-bold ${a.inc ? "text-success" : "text-destructive"}`}
                  >
                    {a.amt}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{a.date}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Goals */}
        <SectionCard
          title="Tujuan Keuangan"
          action={<CardLink onClick={() => router.push("/tujuan")}>Lihat semua</CardLink>}
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
                  <div className="flex-1 text-[13px] font-semibold">{g.name}</div>
                  <div className="text-[13px] font-bold" style={{ color: g.color }}>
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
            Isi profil risiko untuk mendapatkan rekomendasi investasi yang sesuai tujuanmu.
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
