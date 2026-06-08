"use client";

import { Card } from "@/components/ui/card";
import { ProgressBar, StatusBadge } from "@/components/wm";

type MetaItem = { label: string; value: string; valueColor?: string };

type LiabilityCard = {
  icon: string;
  iconBg: string;
  name: string;
  bank: string;
  badge: { text: string; variant: "success" | "danger" | "warning" };
  meta: MetaItem[];
  progressLabel: string;
  progressPct: string;
  progressValue: number;
  progressColor: string;
};

const LIABILITIES: LiabilityCard[] = [
  {
    icon: "💳",
    iconBg: "#FEE2E2",
    name: "Kartu Kredit BCA",
    bank: "BCA · Visa Platinum",
    badge: { text: "Jatuh Tempo 15 Mei", variant: "warning" },
    meta: [
      { label: "Tagihan Berjalan", value: "Rp 8.170.000", valueColor: "var(--danger)" },
      { label: "Limit Kredit", value: "Rp 30.000.000" },
      { label: "Minimum Bayar", value: "Rp 817.000" },
      { label: "Bunga/Bulan", value: "2,25%", valueColor: "var(--danger)" },
    ],
    progressLabel: "Penggunaan Limit",
    progressPct: "27%",
    progressValue: 27,
    progressColor: "var(--warning)",
  },
  {
    icon: "💳",
    iconBg: "#FEE2E2",
    name: "Kartu Kredit Mandiri",
    bank: "Mandiri · Visa Gold",
    badge: { text: "Sudah Jatuh Tempo", variant: "danger" },
    meta: [
      { label: "Tagihan", value: "Rp 7.000.000", valueColor: "var(--danger)" },
      { label: "Limit", value: "Rp 20.000.000" },
    ],
    progressLabel: "Penggunaan Limit",
    progressPct: "35%",
    progressValue: 35,
    progressColor: "var(--danger)",
  },
  {
    icon: "📋",
    iconBg: "#FEE2E2",
    name: "Pinjaman KTA BNI",
    bank: "BNI · 36 Bulan",
    badge: { text: "Berjalan", variant: "success" },
    meta: [
      { label: "Sisa Pokok", value: "Rp 25.000.000", valueColor: "var(--danger)" },
      { label: "Cicilan/Bulan", value: "Rp 2.083.000" },
      { label: "Sisa Tenor", value: "12 Bulan" },
      { label: "Bunga", value: "10% per tahun" },
    ],
    progressLabel: "Progres Pelunasan",
    progressPct: "67%",
    progressValue: 67,
    progressColor: "var(--success)",
  },
];

function LiabilityItem({ item }: { item: LiabilityCard }) {
  return (
    <Card className="gap-0 p-[18px]">
      <div className="mb-3.5 flex items-center gap-2.5">
        <div
          className="flex size-[38px] shrink-0 items-center justify-center rounded-[10px] text-[17px]"
          style={{ background: item.iconBg }}
        >
          {item.icon}
        </div>
        <div>
          <div className="text-[14px] font-bold">{item.name}</div>
          <div className="text-[11.5px] text-muted-foreground">{item.bank}</div>
        </div>
        <div className="ml-auto">
          <StatusBadge variant={item.badge.variant}>{item.badge.text}</StatusBadge>
        </div>
      </div>

      <div className="mb-3.5 grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {item.meta.map((m) => (
          <div key={m.label}>
            <div className="mb-[3px] text-[11px] text-muted-foreground">{m.label}</div>
            <div className="text-[13.5px] font-bold" style={{ color: m.valueColor }}>
              {m.value}
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11.5px] font-semibold">{item.progressLabel}</span>
          <span className="text-[12px] font-bold" style={{ color: item.progressColor }}>
            {item.progressPct}
          </span>
        </div>
        <ProgressBar value={item.progressValue} color={item.progressColor} />
      </div>
    </Card>
  );
}

export default function LiabilitasPage() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3.5">
        <div className="rounded-[14px] border border-[#FECACA] bg-[#FEE2E2] p-4">
          <div className="mb-1 text-[11px] text-[#B91C1C]">Total Liabilitas</div>
          <div className="text-[22px] font-black text-destructive">Rp 40.170.000</div>
          <div className="text-[11px] text-[#B91C1C]">▼ Turun 1,08% (membaik)</div>
        </div>
        <div className="rounded-[14px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">Debt-to-Asset Ratio</div>
          <div className="text-[22px] font-black text-success">3,2%</div>
          <div className="text-[11px] text-success">Sangat Aman (&lt;30%)</div>
        </div>
      </div>

      {LIABILITIES.map((item) => (
        <LiabilityItem key={item.name} item={item} />
      ))}
    </div>
  );
}
