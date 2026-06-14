"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/wm";
import { CrudModal, RowActions, ConfirmDeleteDialog } from "@/components/crud";
import type { CrudModalState } from "@/components/crud";
import { formatRupiah } from "@/lib/format";

type AssetItem = {
  icon: string;
  iconBg: string;
  name: string;
  category: string;
  value: number;
};

const ASSET_ITEMS: AssetItem[] = [
  {
    icon: "🏠",
    iconBg: "#FEF9C3",
    name: "Apartemen Kelapa Gading",
    category: "Properti · SHM Sarusun",
    value: 200_000_000,
  },
  {
    icon: "🚗",
    iconBg: "#DBEAFE",
    name: "Toyota Avanza 2022",
    category: "Kendaraan · BPKB",
    value: 45_000_000,
  },
  {
    icon: "💻",
    iconBg: "#F3F4F6",
    name: "Elektronik & Lainnya",
    category: "Gadget, perabot",
    value: 6_300_000,
  },
];

const TOTAL = ASSET_ITEMS.reduce((sum, item) => sum + item.value, 0);

export default function AsetPage() {
  const [crudState, setCrudState] = useState<CrudModalState | null>(null);
  const [deleteLabel, setDeleteLabel] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between mb-[18px]">
        <div>
          <div className="text-[13px] font-bold">Total Aset Fisik</div>
          <div className="text-[11px] text-muted-foreground">
            {formatRupiah(TOTAL)}
          </div>
        </div>
        <Button
          className="h-auto px-4 py-[9px]"
          onClick={() => setCrudState({ entity: "aset", mode: "add" })}
        >
          <Plus className="size-4" /> Tambah Aset
        </Button>
      </div>

      {/* Asset list */}
      <SectionCard title="Daftar Aset">
        <div className="divide-y">
          {ASSET_ITEMS.map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div
                className="flex size-[34px] shrink-0 items-center justify-center rounded-md text-[16px]"
                style={{ background: item.iconBg }}
              >
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold truncate">
                  {item.name}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {item.category}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[13px] font-bold">
                  {formatRupiah(item.value)}
                </div>
              </div>
              <RowActions
                className="ml-2.5"
                onEdit={() =>
                  setCrudState({
                    entity: "aset",
                    mode: "edit",
                    initialValues: { nama: item.name },
                  })
                }
                onDelete={() => setDeleteLabel("Aset")}
              />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Dialogs */}
      <CrudModal state={crudState} onClose={() => setCrudState(null)} />
      <ConfirmDeleteDialog
        label={deleteLabel}
        onClose={() => setDeleteLabel(null)}
        onConfirm={() => toast("🗑️ Aset dihapus.")}
      />
    </div>
  );
}
