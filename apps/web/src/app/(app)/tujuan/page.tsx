"use client";

import { Plus } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge, ProgressBar } from "@/components/wm";
import { Button } from "@/components/ui/button";

type Goal = {
  icon: string;
  iconBg: string;
  name: string;
  target: string;
  badge: string;
  badgeVariant: "success" | "info" | "warning" | "purple";
  pct: number;
  color: string;
  collected: string;
  goal: string;
  remaining: string;
  autoDebit: string;
  borderColor: string;
};

const GOALS: Goal[] = [
  {
    icon: "🛡️",
    iconBg: "#DCFCE7",
    name: "Dana Darurat",
    target: "Target: Juni 2025",
    badge: "On Track",
    badgeVariant: "success",
    pct: 80,
    color: "var(--success)",
    collected: "Rp 24.000.000 terkumpul",
    goal: "Target Rp 30.000.000",
    remaining: "Sisa: Rp 6.000.000",
    autoDebit: "Auto-debit Rp 2 jt/bln",
    borderColor: "var(--success)",
  },
  {
    icon: "✈️",
    iconBg: "#DBEAFE",
    name: "Liburan ke Jepang",
    target: "Target: Desember 2025",
    badge: "On Track",
    badgeVariant: "info",
    pct: 62,
    color: "var(--primary)",
    collected: "Rp 15.600.000 terkumpul",
    goal: "Target Rp 25.000.000",
    remaining: "Sisa: Rp 9.400.000",
    autoDebit: "Auto-debit Rp 1,5 jt/bln",
    borderColor: "var(--primary)",
  },
  {
    icon: "🏠",
    iconBg: "#FEF9C3",
    name: "DP Rumah",
    target: "Target: 2027",
    badge: "Perlu Boost",
    badgeVariant: "warning",
    pct: 40,
    color: "var(--warning)",
    collected: "Rp 120.000.000 terkumpul",
    goal: "Target Rp 300.000.000",
    remaining: "Sisa: Rp 180.000.000",
    autoDebit: "Auto-debit Rp 5 jt/bln",
    borderColor: "var(--warning)",
  },
  {
    icon: "🏖️",
    iconBg: "#EDE9FE",
    name: "Dana Pensiun",
    target: "Target: 2045",
    badge: "Berjalan",
    badgeVariant: "purple",
    pct: 25,
    color: "var(--brand-purple)",
    collected: "Rp 250.000.000 terkumpul",
    goal: "Target Rp 1.000.000.000",
    remaining: "Sisa: Rp 750.000.000",
    autoDebit: "Auto-debit Rp 3 jt/bln",
    borderColor: "var(--brand-purple)",
  },
];

export default function TujuanPage() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <div className="text-[15px] font-bold">4 Tujuan Aktif</div>
          <div className="text-xs text-muted-foreground">
            Total dialokasikan: Rp 409.600.000
          </div>
        </div>
        <Button onClick={() => toast("➕ Form tambah tujuan")} className="h-auto px-[18px] py-2.5">
          <Plus className="size-4" /> Tambah Tujuan
        </Button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <div className="rounded-[14px] border border-[#86EFAC] bg-[#DCFCE7] p-4">
          <div className="text-[10.5px] text-[#15803D]">On Track</div>
          <div className="text-[22px] font-black text-[#15803D]">2</div>
          <div className="text-[11px] text-[#15803D]">tujuan berjalan baik</div>
        </div>
        <div className="rounded-[14px] border bg-card p-4">
          <div className="text-[10.5px] text-warning">Perlu Boost</div>
          <div className="text-[22px] font-black text-warning">1</div>
          <div className="text-[11px] text-muted-foreground">tujuan perlu percepatan</div>
        </div>
        <div className="rounded-[14px] border bg-card p-4">
          <div className="text-[10.5px] text-muted-foreground">Berjalan</div>
          <div className="text-[22px] font-black text-primary">1</div>
          <div className="text-[11px] text-muted-foreground">tujuan jangka panjang</div>
        </div>
      </div>

      {/* Goal cards */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {GOALS.map((g) => (
          <div
            key={g.name}
            className="rounded-[14px] border-2 bg-card p-[18px]"
            style={{ borderColor: g.borderColor }}
          >
            <div className="mb-3 flex items-center gap-2.5">
              <div
                className="flex size-[40px] shrink-0 items-center justify-center rounded-[11px] text-[18px]"
                style={{ background: g.iconBg }}
              >
                {g.icon}
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-bold">{g.name}</div>
                <div className="text-[11.5px] text-muted-foreground">{g.target}</div>
              </div>
              <StatusBadge variant={g.badgeVariant} className="ml-auto">
                {g.badge}
              </StatusBadge>
            </div>

            <div className="mb-1.5 text-[26px] font-black" style={{ color: g.color }}>
              {g.pct}%
            </div>
            <ProgressBar value={g.pct} color={g.color} height={9} />

            <div className="mt-2.5 flex items-center justify-between text-[11.5px] text-muted-foreground">
              <span>{g.collected}</span>
              <span>{g.goal}</span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t pt-3 text-[12px] font-semibold">
              <span>{g.remaining}</span>
              <span className="text-muted-foreground">{g.autoDebit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
