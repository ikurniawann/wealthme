"use client";

import { Card } from "@/components/ui/card";
import { SectionCard, StatusBadge, ProgressBar } from "@/components/wm";

const COMPOSITION = [
  { label: "Investasi", value: "Rp 577 jt · 46%", pct: 46, color: "var(--primary)" },
  { label: "Rekening & Dana", value: "Rp 339 jt · 27%", pct: 27, color: "var(--brand-cyan)" },
  { label: "Aset Fisik", value: "Rp 251 jt · 20%", pct: 20, color: "var(--success)" },
  { label: "Lainnya", value: "Rp 88 jt · 7%", pct: 7, color: "var(--warning)" },
];

const TOP_SPENDING = [
  { icon: "🏠", iconBg: "#EEF2FF", name: "Kebutuhan", amt: "Rp 8.069.600", pct: "44%", variant: "info" as const },
  { icon: "😊", iconBg: "#DCFCE7", name: "Gaya Hidup", amt: "Rp 4.585.000", pct: "25%", variant: "success" as const },
  { icon: "🚗", iconBg: "#FEF9C3", name: "Transportasi", amt: "Rp 2.200.000", pct: "12%", variant: "warning" as const },
  { icon: "🏥", iconBg: "#FEE2E2", name: "Kesehatan", amt: "Rp 1.467.000", pct: "8%", variant: "danger" as const },
];

export default function RingkasanPage() {
  return (
    <div className="space-y-3.5">
      {/* Top stat cards */}
      <div className="mb-[18px] grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <Card className="gap-0 border-none gradient-wealth p-5 text-white">
          <div className="mb-1.5 text-[11px] opacity-80">Total Kekayaan Bersih</div>
          <div className="text-[20px] font-black">Rp 1,256 M</div>
          <div className="mt-1 text-[11px] text-emerald-300">▲ 8,45% bulan ini</div>
        </Card>
        <Card className="gap-0 p-5">
          <div className="mb-1.5 text-[11px] text-muted-foreground">Total Aset</div>
          <div className="text-[20px] font-black text-success">Rp 1,169 M</div>
          <div className="text-[11px] text-muted-foreground">▲ 8,45%</div>
        </Card>
        <Card className="gap-0 p-5">
          <div className="mb-1.5 text-[11px] text-muted-foreground">Total Liabilitas</div>
          <div className="text-[20px] font-black text-destructive">-Rp 40,17 jt</div>
          <div className="text-[11px] text-muted-foreground">▼ 1,08%</div>
        </Card>
        <Card className="gap-0 p-5">
          <div className="mb-1.5 text-[11px] text-muted-foreground">Savings Rate</div>
          <div className="text-[20px] font-black text-primary">29%</div>
          <div className="text-[11px] text-success">▲ 6% vs bulan lalu</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {/* Net worth trend */}
        <SectionCard title="Tren Kekayaan Bersih (6 Bulan)">
          <svg viewBox="0 0 320 100" width="100%" height={90} preserveAspectRatio="none">
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
            {["Nov", "Des", "Jan", "Feb", "Mar", "Apr"].map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        </SectionCard>

        {/* Asset composition */}
        <SectionCard title="Komposisi Aset">
          <div className="flex flex-col gap-2">
            {COMPOSITION.map((c) => (
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
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        {/* Cash Flow */}
        <SectionCard title="Cash Flow Apr 2025">
          <div className="mb-2.5">
            <div className="text-[11px] text-muted-foreground">Pemasukan</div>
            <div className="text-[18px] font-extrabold text-success">Rp 25.850.000</div>
          </div>
          <div className="mb-2.5">
            <div className="text-[11px] text-muted-foreground">Pengeluaran</div>
            <div className="text-[18px] font-extrabold text-destructive">Rp 18.340.000</div>
          </div>
          <div className="border-t pt-2.5">
            <div className="text-[11px] text-muted-foreground">Surplus</div>
            <div className="text-[18px] font-extrabold text-success">Rp 7.510.000</div>
          </div>
        </SectionCard>

        {/* Top spending */}
        <SectionCard title="Top Pengeluaran">
          <div className="divide-y">
            {TOP_SPENDING.map((t) => (
              <div key={t.name} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                <div
                  className="flex size-[30px] items-center justify-center rounded-md text-[13px]"
                  style={{ background: t.iconBg }}
                >
                  {t.icon}
                </div>
                <div className="flex-1 text-[13px] font-semibold">{t.name}</div>
                <div className="text-right">
                  <div className="text-[13px] font-bold text-destructive">{t.amt}</div>
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
            <svg viewBox="0 0 120 70" width="140" height="80" className="mx-auto">
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
                strokeDashoffset="40"
              />
            </svg>
            <div className="-mt-3.5 text-[32px] font-black text-primary">78</div>
            <div className="text-[11px] text-muted-foreground">Financial Health Score</div>
            <div className="mt-2">
              <StatusBadge variant="info">Sehat</StatusBadge>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
