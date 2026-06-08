"use client";

import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/wm";

type MetaItem = { label: string; value: string };

type Policy = {
  icon: string;
  iconBg: string;
  name: string;
  provider: string;
  meta: MetaItem[];
};

const POLICIES: Policy[] = [
  {
    icon: "🏥",
    iconBg: "#DCFCE7",
    name: "Asuransi Jiwa & Kesehatan",
    provider: "Prudential · PRUlink Assurance",
    meta: [
      { label: "Uang Pertanggungan", value: "Rp 1.000.000.000" },
      { label: "Premi/Bulan", value: "Rp 1.500.000" },
      { label: "Jatuh Tempo", value: "15 Mei 2025" },
    ],
  },
  {
    icon: "🚗",
    iconBg: "#DBEAFE",
    name: "Asuransi Kendaraan",
    provider: "Astra Insurance · All Risk",
    meta: [
      { label: "Kendaraan", value: "Toyota Avanza 2022" },
      { label: "Premi/Bulan", value: "Rp 600.000" },
      { label: "Jatuh Tempo", value: "Oktober 2025" },
    ],
  },
  {
    icon: "🏠",
    iconBg: "#FEF9C3",
    name: "Asuransi Properti",
    provider: "Tokio Marine · Properti",
    meta: [
      { label: "Objek", value: "Apt Kelapa Gading" },
      { label: "Premi/Bulan", value: "Rp 300.000" },
      { label: "Jatuh Tempo", value: "Maret 2026" },
    ],
  },
];

function PolicyCard({ policy }: { policy: Policy }) {
  return (
    <Card className="gap-0 p-[18px]">
      <div className="mb-3.5 flex items-center gap-2.5">
        <div
          className="flex size-[38px] shrink-0 items-center justify-center rounded-[10px] text-[17px]"
          style={{ background: policy.iconBg }}
        >
          {policy.icon}
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-bold">{policy.name}</div>
          <div className="text-[11px] text-muted-foreground">{policy.provider}</div>
        </div>
        <StatusBadge variant="success">Aktif</StatusBadge>
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        {policy.meta.map((m) => (
          <div key={m.label}>
            <div className="mb-[3px] text-[11px] text-muted-foreground">{m.label}</div>
            <div className="text-[13.5px] font-bold">{m.value}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function AsuransiPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <div className="text-[15px] font-bold">3 Polis Aktif</div>
          <div className="text-xs text-muted-foreground">Total premi: Rp 2.400.000/bln</div>
        </div>
        <Button
          onClick={() => toast("➕ Tambah asuransi")}
          className="h-auto px-4 py-[9px]"
        >
          <Plus className="size-4" /> Tambah
        </Button>
      </div>

      {POLICIES.map((policy) => (
        <PolicyCard key={policy.name} policy={policy} />
      ))}
    </div>
  );
}
