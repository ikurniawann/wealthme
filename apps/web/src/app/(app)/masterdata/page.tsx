"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CategoryDto } from "@wealthme/contracts";
import { useSession } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { SectionCard, CardLink, StatusBadge } from "@/components/wm";
import {
  ConfirmDeleteDialog,
  CrudModal,
  type CrudEntity,
  type CrudMode,
  type CrudModalState,
} from "@/components/crud";

interface MasterDataGroup {
  entity: CrudEntity;
  title: string;
  label: string;
  items: string[];
}

/**
 * System reference lists. These are fixed enums / conventions with no backend
 * master table, so they are shown for reference and managed locally only.
 * (Kategori is handled separately below — it is the one entity with a real API.)
 */
const REFERENCE_GROUPS: MasterDataGroup[] = [
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
  const { data: session } = useSession();
  const familyGroupId = session?.familyGroupId ?? "";
  const token = session?.accessToken;
  const enabled = Boolean(familyGroupId) && Boolean(token);

  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: categories, isLoading: isCategoriesLoading } = useQuery<
    CategoryDto[]
  >({
    queryKey: queryKeys.categories.all(familyGroupId),
    queryFn: () =>
      apiFetch<CategoryDto[]>(`/family-groups/${familyGroupId}/categories`, {
        token,
      }),
    enabled,
    staleTime: 60_000,
  });

  const [groups, setGroups] = useState<MasterDataGroup[]>(REFERENCE_GROUPS);
  const [crud, setCrud] = useState<CrudModalState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    label: string;
    entity: CrudEntity;
    item: string;
  } | null>(null);
  const [pendingCatDelete, setPendingCatDelete] = useState<CategoryDto | null>(
    null,
  );

  // Local-only removal for the reference lists (no backend master table).
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

  // Real category creation via the categories API.
  const handleCrudSubmit = (
    entity: CrudEntity,
    _mode: CrudMode,
    values: Record<string, string>,
  ) => {
    if (entity !== "mdkategori") {
      // Reference lists have no backend — say so instead of faking success.
      toast.info(
        "Daftar referensi ini bawaan sistem — penambahan belum didukung.",
      );
      return;
    }
    if (!enabled) {
      toast.error("Sesi tidak valid, silakan login ulang.");
      return;
    }
    const name = values.nama?.trim();
    if (!name) {
      toast.error("Nama kategori wajib diisi.");
      return;
    }
    const kindMap: Record<string, "income" | "expense"> = {
      Pemasukan: "income",
      Pengeluaran: "expense",
    };
    const kind = kindMap[values.tipe];
    if (!kind) {
      toast.error("Tipe kategori tidak valid.");
      return;
    }
    const icon = values.icon || undefined;

    void (async () => {
      try {
        await apiFetch(`/family-groups/${familyGroupId}/categories`, {
          method: "POST",
          token,
          body: JSON.stringify({ name, kind, icon }),
        });
        toast.success("Kategori ditambahkan");
        void queryClient.invalidateQueries({
          queryKey: queryKeys.categories.all(familyGroupId),
        });
      } catch {
        toast.error("Gagal menambahkan kategori");
      }
    })();
  };

  const handleCategoryDelete = (cat: CategoryDto) => {
    if (!enabled) {
      toast.error("Sesi tidak valid, silakan login ulang.");
      return;
    }
    void (async () => {
      try {
        await apiFetch(`/family-groups/${familyGroupId}/categories/${cat.id}`, {
          method: "DELETE",
          token,
        });
        toast.success("Kategori dihapus");
        void queryClient.invalidateQueries({
          queryKey: queryKeys.categories.all(familyGroupId),
        });
      } catch {
        toast.error("Gagal menghapus kategori");
      }
    })();
  };

  const categoryList = categories ?? [];

  return (
    <div>
      <div className="mb-[18px]">
        <div className="text-[15px] font-bold">🗄️ Setup Master Data</div>
        <div className="text-[12px] text-muted-foreground">
          Kelola data referensi yang dipakai di seluruh aplikasi
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {/* Kategori — backed by the real categories API */}
        <SectionCard
          title="🏷️ Kategori"
          action={
            <span className="flex items-center gap-3">
              <CardLink onClick={() => router.push("/mastercoa")}>
                Master COA
              </CardLink>
              <CardLink
                onClick={() => setCrud({ entity: "mdkategori", mode: "add" })}
              >
                + Tambah
              </CardLink>
            </span>
          }
        >
          {isCategoriesLoading || !enabled ? (
            <div className="py-2 text-[12px] text-muted-foreground">
              Memuat kategori…
            </div>
          ) : categoryList.length === 0 ? (
            <div className="py-2 text-[12px] text-muted-foreground">
              Belum ada kategori
            </div>
          ) : (
            <div className="flex flex-wrap">
              {categoryList.map((cat) => (
                <span
                  key={cat.id}
                  className="mr-1.5 mb-1.5 inline-flex items-center gap-1.5 rounded-[20px] border bg-background px-2.5 py-1.5 text-[12.5px] font-semibold"
                >
                  <span>
                    {cat.icon ?? "🏷️"} {cat.name}
                  </span>
                  <StatusBadge
                    variant={cat.kind === "income" ? "success" : "info"}
                  >
                    {cat.kind === "income" ? "Masuk" : "Keluar"}
                  </StatusBadge>
                  <button
                    type="button"
                    aria-label={`Hapus ${cat.name}`}
                    onClick={() => setPendingCatDelete(cat)}
                    className="inline-flex size-4 items-center justify-center rounded-full text-[15px] leading-none text-muted-foreground transition-colors hover:bg-destructive hover:text-white"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </SectionCard>

        {/* System reference lists (no backend master table) */}
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

      <div className="mt-3.5 rounded-[12px] border border-primary/20 bg-accent p-3.5 text-[12px] text-muted-foreground">
        <strong>Kategori</strong> tersimpan ke server dan dipakai di transaksi &
        laporan. Daftar lain (bank, jenis transaksi, dll.) adalah referensi
        sistem dan dikelola secara lokal.
      </div>

      <CrudModal
        state={crud}
        onClose={() => setCrud(null)}
        onSubmit={handleCrudSubmit}
      />
      <ConfirmDeleteDialog
        label={pendingDelete?.label ?? null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete)
            removeItem(pendingDelete.entity, pendingDelete.item);
        }}
      />
      <ConfirmDeleteDialog
        label={pendingCatDelete ? `kategori "${pendingCatDelete.name}"` : null}
        onClose={() => setPendingCatDelete(null)}
        onConfirm={() => {
          if (pendingCatDelete) handleCategoryDelete(pendingCatDelete);
        }}
      />
    </div>
  );
}
