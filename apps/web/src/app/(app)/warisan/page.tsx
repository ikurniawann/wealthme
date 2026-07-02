"use client";

import { useState } from "react";
import { CloudUpload, Plus, Save, Scroll } from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { HeroCard } from "@/components/wm";
import { ConfirmDeleteDialog, RowActions } from "@/components/crud";
import { apiFetch } from "@/lib/api-client";
import { formatAmountInput, formatRupiah } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

import type {
  CreateInheritanceAssetDto,
  InheritanceAssetDto,
  InheritanceVisibility,
  UpdateInheritanceAssetDto,
} from "@wealthme/contracts";

const FIELD_CLASS =
  "w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card";

const ASSET_TYPE_OPTIONS = [
  "Aset / Properti",
  "Cash / Tunai",
  "Surat Berharga",
  "Saham",
  "Lainnya",
];

const ASSET_TYPE_ICON: Record<string, string> = {
  "Aset / Properti": "🏠",
  "Cash / Tunai": "💵",
  "Surat Berharga": "📜",
  Saham: "📈",
  Lainnya: "📋",
};

const ASSET_TYPE_BG: Record<string, string> = {
  "Aset / Properti": "#FEF9C3",
  "Cash / Tunai": "#DCFCE7",
  "Surat Berharga": "#DBEAFE",
  Saham: "#EDE9FE",
  Lainnya: "#F3F4F6",
};

function visibilityToBoolean(v: InheritanceVisibility): boolean {
  return v !== "private";
}

function booleanToVisibility(v: boolean): InheritanceVisibility {
  return v ? "heirs_only" : "private";
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3.5 text-[13.5px] font-bold text-muted-foreground">
      {children}
    </div>
  );
}

interface AssetRowProps {
  item: InheritanceAssetDto;
  onEdit: () => void;
  onDelete: () => void;
  onVisibilityToggle: (visible: boolean) => void;
  last: boolean;
}

function AssetRow({
  item,
  onEdit,
  onDelete,
  onVisibilityToggle,
  last,
}: AssetRowProps) {
  const icon = ASSET_TYPE_ICON[item.assetType] ?? "📋";
  const iconBg = ASSET_TYPE_BG[item.assetType] ?? "#F3F4F6";
  const heirSummary =
    item.heirs.length > 0
      ? item.heirs.map((h) => `${h.name} (${h.sharePercent}%)`).join(", ")
      : null;

  return (
    <div
      className={"flex items-center gap-2.5 py-3 " + (last ? "" : "border-b")}
    >
      <div
        className="flex size-[36px] shrink-0 items-center justify-center rounded-[10px] text-[15px]"
        style={{ background: iconBg }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold truncate">{item.name}</div>
        <div className="text-[11.5px] text-muted-foreground truncate">
          {item.assetType}
          {heirSummary ? ` · ${heirSummary}` : ""}
        </div>
      </div>
      <div className="text-right text-[13.5px] font-bold shrink-0">
        {formatRupiah(Number(BigInt(item.estimatedValue)))}
      </div>
      <Switch
        checked={visibilityToBoolean(item.visibility)}
        onCheckedChange={onVisibilityToggle}
        className="shrink-0"
      />
      <RowActions className="ml-1" onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

function AssetSkeleton() {
  return (
    <div className="animate-pulse space-y-3 py-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-2.5">
          <div className="size-[36px] rounded-[10px] bg-muted shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-40 rounded bg-muted" />
            <div className="h-2.5 w-28 rounded bg-muted" />
          </div>
          <div className="h-4 w-24 rounded bg-muted shrink-0" />
        </div>
      ))}
    </div>
  );
}

export default function WarisanPage() {
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  const familyGroupId = session?.familyGroupId ?? undefined;

  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InheritanceAssetDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InheritanceAssetDto | null>(
    null,
  );
  const [assetType, setAssetType] = useState(ASSET_TYPE_OPTIONS[0]);
  const [name, setName] = useState("");
  const [valueInput, setValueInput] = useState("");
  const [notes, setNotes] = useState("");
  const [visible, setVisible] = useState(true);

  const listKey = familyGroupId
    ? queryKeys.inheritance.list(familyGroupId)
    : null;

  const { data: assets = [], isLoading } = useQuery<InheritanceAssetDto[]>({
    queryKey: listKey ?? ["inheritance", "disabled"],
    enabled: !!familyGroupId && !!token,
    queryFn: () =>
      apiFetch<InheritanceAssetDto[]>(
        `/family-groups/${familyGroupId}/inheritance`,
        { token },
      ),
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateInheritanceAssetDto) =>
      apiFetch<InheritanceAssetDto>(
        `/family-groups/${familyGroupId}/inheritance`,
        { method: "POST", body: JSON.stringify(dto), token },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKey ?? [] });
      toast.success("Aset warisan ditambahkan!");
      setOpen(false);
      resetForm();
    },
    onError: () => toast.error("Gagal menyimpan aset warisan."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateInheritanceAssetDto }) =>
      apiFetch<InheritanceAssetDto>(
        `/family-groups/${familyGroupId}/inheritance/${id}`,
        { method: "PATCH", body: JSON.stringify(dto), token },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKey ?? [] });
      toast.success("Aset warisan diperbarui!");
      setOpen(false);
      setEditing(null);
      resetForm();
    },
    onError: () => toast.error("Gagal memperbarui aset warisan."),
  });

  const updateVisibilityMutation = useMutation({
    mutationFn: ({
      id,
      visibility,
    }: {
      id: string;
      visibility: InheritanceVisibility;
    }) =>
      apiFetch<InheritanceAssetDto>(
        `/family-groups/${familyGroupId}/inheritance/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            visibility,
          } satisfies UpdateInheritanceAssetDto),
          token,
        },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKey ?? [] });
    },
    onError: () => toast.error("Gagal memperbarui visibilitas."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/family-groups/${familyGroupId}/inheritance/${id}`, {
        method: "DELETE",
        token,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKey ?? [] });
      toast.success("Aset warisan dihapus.");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Gagal menghapus aset warisan."),
  });

  function resetForm() {
    setAssetType(ASSET_TYPE_OPTIONS[0] ?? "");
    setName("");
    setValueInput("");
    setNotes("");
    setVisible(true);
  }

  function openEditAsset(item: InheritanceAssetDto) {
    setEditing(item);
    setAssetType(item.assetType);
    setName(item.name);
    setValueInput(Number(BigInt(item.estimatedValue)).toLocaleString("id-ID"));
    setNotes(item.notes ?? "");
    setVisible(visibilityToBoolean(item.visibility));
    setOpen(true);
  }

  function handleSave() {
    const raw = valueInput.replace(/\D/g, "");
    const estimatedValue = parseInt(raw, 10);
    if (!name.trim()) {
      toast.error("Nama aset wajib diisi.");
      return;
    }
    if (isNaN(estimatedValue) || estimatedValue < 0) {
      toast.error("Nilai estimasi tidak valid.");
      return;
    }
    const dto = {
      name: name.trim(),
      assetType,
      estimatedValue,
      notes: notes.trim() || undefined,
      visibility: booleanToVisibility(visible),
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, dto });
    } else {
      createMutation.mutate(dto);
    }
  }

  // Group assets by assetType
  const grouped = assets.reduce<Record<string, InheritanceAssetDto[]>>(
    (acc, item) => {
      const key = item.assetType;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {},
  );

  const totalValue = assets.reduce(
    (sum, a) => sum + BigInt(a.estimatedValue),
    BigInt(0),
  );

  const heirNames = Array.from(
    new Set(assets.flatMap((a) => a.heirs.map((h) => h.name))),
  );

  return (
    <div className="space-y-4">
      {/* Hero */}
      <HeroCard className="gradient-wealth">
        <div className="mb-1.5 flex items-center gap-2 text-[12px] opacity-85">
          <Scroll className="size-3.5" /> Total Nilai Warisan
        </div>
        <div className="text-[30px] font-black tracking-[-1px]">
          {formatRupiah(Number(totalValue))}
        </div>
        <div className="mt-1.5 text-[12px] opacity-85">
          {assets.length} aset terdaftar
          {heirNames.length > 0 ? ` · ${heirNames.length} ahli waris` : ""}
        </div>
        <div className="pointer-events-none absolute -top-5 -right-5 text-[140px] opacity-10">
          🏛️
        </div>
      </HeroCard>

      {/* Header action */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] text-muted-foreground">
          Catatan aset warisan yang dapat dilihat seluruh ahli waris
        </div>
        <Button onClick={() => setOpen(true)} className="h-auto px-4 py-[9px]">
          <Plus className="size-4" /> Tambah Aset Warisan
        </Button>
      </div>

      {/* Asset list grouped by type */}
      {isLoading && (
        <Card className="gap-0 p-5">
          <AssetSkeleton />
        </Card>
      )}

      {!isLoading && assets.length === 0 && (
        <Card className="gap-0 p-5">
          <div className="py-8 text-center text-[13px] text-muted-foreground">
            Belum ada aset warisan. Klik &quot;Tambah Aset Warisan&quot; untuk
            mulai.
          </div>
        </Card>
      )}

      {!isLoading &&
        Object.entries(grouped).map(([type, items]) => (
          <Card key={type} className="gap-0 p-5">
            <CardTitle>
              {ASSET_TYPE_ICON[type] ?? "📋"} {type}
            </CardTitle>
            {items.map((item, i) => (
              <AssetRow
                key={item.id}
                item={item}
                last={i === items.length - 1}
                onEdit={() => openEditAsset(item)}
                onDelete={() => setDeleteTarget(item)}
                onVisibilityToggle={(v) =>
                  updateVisibilityMutation.mutate({
                    id: item.id,
                    visibility: booleanToVisibility(v),
                  })
                }
              />
            ))}
          </Card>
        ))}

      {/* Insight banner */}
      <div className="flex items-center gap-3 rounded-[14px] border border-primary/20 bg-accent p-4">
        <div className="text-[24px]">🛡️</div>
        <div className="flex-1">
          <div className="text-[13px] font-bold text-primary-strong">
            Catatan Warisan Aman & Transparan
          </div>
          <div className="mt-0.5 text-[12px] text-muted-foreground">
            Seluruh ahli waris dapat melihat daftar ini kapan saja. Tambahkan
            dokumen pendukung (sertifikat, BPKB, polis) agar lebih lengkap.
          </div>
        </div>
        <button
          onClick={() =>
            toast("Upload dokumen: coming soon (StoragePort belum tersedia)")
          }
          className="shrink-0 cursor-pointer text-[12.5px] font-bold text-primary hover:underline"
        >
          Upload Dokumen →
        </button>
      </div>

      {/* Confirm delete */}
      <ConfirmDeleteDialog
        label={deleteTarget?.name ?? null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />

      {/* Tambah Aset Warisan modal */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            setEditing(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-[480px] p-6 sm:max-w-[480px]">
          <DialogTitle className="mb-4 text-[17px] font-extrabold">
            {editing ? "Edit Aset Warisan" : "Tambah Aset Warisan"}
          </DialogTitle>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                Kategori
              </label>
              <select
                value={assetType}
                onChange={(e) => setAssetType(e.target.value)}
                className={FIELD_CLASS}
              >
                {ASSET_TYPE_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                Nama Aset
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="cth: Rumah Utama, Deposito BCA..."
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                Nilai Estimasi
              </label>
              <div className="flex items-center gap-2 rounded-md border bg-background px-3.5 py-2.5 transition-colors focus-within:border-primary focus-within:bg-card">
                <span className="text-[13.5px] text-muted-foreground">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={valueInput}
                  onChange={(e) =>
                    setValueInput(formatAmountInput(e.target.value))
                  }
                  placeholder="0"
                  className="w-full bg-transparent text-[13.5px] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                Catatan / Keterangan
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="cth: SHM No. 1234, BPKB, Sertifikat..."
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                Dokumen Pendukung
              </label>
              <button
                type="button"
                onClick={() =>
                  toast(
                    "Upload dokumen: coming soon (StoragePort belum tersedia)",
                  )
                }
                className="w-full cursor-pointer rounded-md border-[1.5px] border-dashed p-[18px] text-center transition-colors hover:bg-accent/50"
              >
                <CloudUpload className="mx-auto mb-1.5 size-[22px] text-primary" />
                <div className="text-[12px] text-muted-foreground">
                  Upload sertifikat, BPKB, atau polis (PDF/JPG) — Coming soon
                </div>
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                Akses Ahli Waris
              </label>
              <div className="rounded-md border bg-card px-3.5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-semibold">
                      Terlihat oleh ahli waris
                    </div>
                    <div className="text-[11.5px] text-muted-foreground">
                      {visible
                        ? "Ahli waris dapat melihat aset ini"
                        : "Hanya pemilik yang dapat melihat"}
                    </div>
                  </div>
                  <Switch checked={visible} onCheckedChange={setVisible} />
                </div>
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={createMutation.isPending}
              className="w-full"
            >
              <Save className="size-4" />
              {createMutation.isPending
                ? "Menyimpan..."
                : "Simpan Aset Warisan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
