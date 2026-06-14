"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar, StatusBadge } from "@/components/wm";
import {
  CardSideActions,
  ConfirmDeleteDialog,
  CrudModal,
  type CrudModalState,
} from "@/components/crud";

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
      {
        label: "Tagihan Berjalan",
        value: "Rp 8.170.000",
        valueColor: "var(--danger)",
      },
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
      {
        label: "Sisa Pokok",
        value: "Rp 25.000.000",
        valueColor: "var(--danger)",
      },
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

const TOTAL_LABEL = "Rp 40.170.000";

interface LiabilityItemProps {
  item: LiabilityCard;
  onEdit: () => void;
  onPay: () => void;
  onDelete: () => void;
}

function LiabilityItem({ item, onEdit, onPay, onDelete }: LiabilityItemProps) {
  return (
    <Card className="gap-0 p-[18px]">
      <div className="flex items-stretch gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-3.5 flex items-center gap-2.5">
            <div
              className="flex size-[38px] shrink-0 items-center justify-center rounded-[10px] text-[17px]"
              style={{ background: item.iconBg }}
            >
              {item.icon}
            </div>
            <div>
              <div className="text-[14px] font-bold">{item.name}</div>
              <div className="text-[11.5px] text-muted-foreground">
                {item.bank}
              </div>
            </div>
            <div className="ml-auto">
              <StatusBadge variant={item.badge.variant}>
                {item.badge.text}
              </StatusBadge>
            </div>
          </div>

          <div className="mb-3.5 grid grid-cols-2 gap-3.5 md:grid-cols-4">
            {item.meta.map((m) => (
              <div key={m.label}>
                <div className="mb-[3px] text-[11px] text-muted-foreground">
                  {m.label}
                </div>
                <div
                  className="text-[13.5px] font-bold"
                  style={{ color: m.valueColor }}
                >
                  {m.value}
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11.5px] font-semibold">
                {item.progressLabel}
              </span>
              <span
                className="text-[12px] font-bold"
                style={{ color: item.progressColor }}
              >
                {item.progressPct}
              </span>
            </div>
            <ProgressBar
              value={item.progressValue}
              color={item.progressColor}
            />
          </div>
        </div>

        <CardSideActions onEdit={onEdit} onPay={onPay} onDelete={onDelete} />
      </div>
    </Card>
  );
}

export default function LiabilitasPage() {
  const [crudState, setCrudState] = useState<CrudModalState | null>(null);
  const [deleteLabel, setDeleteLabel] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="mb-[18px] flex items-center justify-between">
        <div>
          <div className="text-[13px] font-bold">Total Liabilitas</div>
          <div className="text-[11px] text-destructive">{TOTAL_LABEL}</div>
        </div>
        <Button
          className="h-auto px-4 py-[9px]"
          onClick={() => setCrudState({ entity: "liabilitas", mode: "add" })}
        >
          <Plus className="size-4" /> Tambah
        </Button>
      </div>

      {LIABILITIES.map((item) => (
        <LiabilityItem
          key={item.name}
          item={item}
          onEdit={() =>
            setCrudState({
              entity: "liabilitas",
              mode: "edit",
              initialValues: { nama: item.name },
            })
          }
          onPay={() => toast("💳 Bayar tagihan")}
          onDelete={() => setDeleteLabel("Liabilitas")}
        />
      ))}

      <CrudModal state={crudState} onClose={() => setCrudState(null)} />
      <ConfirmDeleteDialog
        label={deleteLabel}
        onClose={() => setDeleteLabel(null)}
        onConfirm={() => toast("🗑️ Liabilitas dihapus.")}
      />
    </div>
  );
}
