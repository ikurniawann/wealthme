"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SectionCard, CardLink } from "@/components/wm";
import {
  ConfirmDeleteDialog,
  CrudModal,
  type CrudEntity,
  type CrudModalState,
} from "@/components/crud";

interface MasterDataGroup {
  entity: CrudEntity;
  title: string;
  label: string;
  items: string[];
}

const INITIAL_GROUPS: MasterDataGroup[] = [
  {
    entity: "mdbank",
    title: "🏦 Bank",
    label: "Bank",
    items: ["BCA", "Mandiri", "BNI", "BRI", "CIMB Niaga", "Permata"],
  },
  {
    entity: "mdtxntype",
    title: "↕️ Jenis Transaksi",
    label: "Jenis Transaksi",
    items: ["Pemasukan", "Pengeluaran", "Transfer", "Kartu Kredit"],
  },
  {
    entity: "mdkategori",
    title: "🏷️ Kategori",
    label: "Kategori",
    items: [
      "🍽️ Makanan",
      "🚗 Transportasi",
      "🏥 Kesehatan",
      "🎮 Hiburan",
      "🛒 Belanja",
      "💡 Kebutuhan",
    ],
  },
  {
    entity: "mdinvtype",
    title: "📈 Jenis Investasi",
    label: "Jenis Investasi",
    items: ["Saham", "Reksa Dana", "Obligasi", "Emas", "Crypto"],
  },
  {
    entity: "mdewallet",
    title: "💳 E-Wallet",
    label: "E-Wallet",
    items: ["GoPay", "OVO", "DANA", "LinkAja", "ShopeePay"],
  },
  {
    entity: "mdlembaga",
    title: "🤲 Lembaga Donasi",
    label: "Lembaga",
    items: ["BAZNAS", "Dompet Dhuafa", "Gereja / Paroki", "Pura / Vihara"],
  },
  {
    entity: "mdasettype",
    title: "🏠 Kategori Aset",
    label: "Kategori Aset",
    items: ["Properti", "Kendaraan", "Elektronik", "Perhiasan"],
  },
  {
    entity: "mdinstype",
    title: "🛡️ Jenis Asuransi",
    label: "Jenis Asuransi",
    items: ["Jiwa", "Kesehatan", "Kendaraan", "Properti"],
  },
];

export default function MasterDataPage() {
  const [groups, setGroups] = useState<MasterDataGroup[]>(INITIAL_GROUPS);
  const [crud, setCrud] = useState<CrudModalState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    label: string;
    entity: CrudEntity;
    item: string;
  } | null>(null);

  const removeItem = (entity: CrudEntity, item: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.entity === entity
          ? { ...g, items: g.items.filter((i) => i !== item) }
          : g,
      ),
    );
    toast(`🗑️ ${item} dihapus.`);
  };

  return (
    <div>
      <div className="mb-[18px]">
        <div className="text-[15px] font-bold">🗄️ Setup Master Data</div>
        <div className="text-[12px] text-muted-foreground">
          Kelola data referensi yang dipakai di seluruh aplikasi
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <SectionCard
            key={group.entity}
            title={group.title}
            action={
              <CardLink
                onClick={() => setCrud({ entity: group.entity, mode: "add" })}
              >
                + Tambah
              </CardLink>
            }
          >
            <div className="flex flex-wrap">
              {group.items.length === 0 ? (
                <div className="py-2 text-[12px] text-muted-foreground">
                  Belum ada data
                </div>
              ) : (
                group.items.map((item) => (
                  <span
                    key={item}
                    className="mr-1.5 mb-1.5 inline-flex items-center gap-2 rounded-[20px] border bg-background px-2.5 py-1.5 text-[12.5px] font-semibold"
                  >
                    {item}
                    <button
                      type="button"
                      aria-label={`Hapus ${item}`}
                      onClick={() =>
                        setPendingDelete({
                          label: group.label,
                          entity: group.entity,
                          item,
                        })
                      }
                      className="inline-flex size-4 items-center justify-center rounded-full text-[15px] leading-none text-muted-foreground transition-colors hover:bg-destructive hover:text-white"
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
          </SectionCard>
        ))}
      </div>

      <CrudModal state={crud} onClose={() => setCrud(null)} />
      <ConfirmDeleteDialog
        label={pendingDelete?.label ?? null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete)
            removeItem(pendingDelete.entity, pendingDelete.item);
        }}
      />
    </div>
  );
}
