"use client";

import { useEffect, useState } from "react";
import { Lock, Plus, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";
import { formatRupiah } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";

import type { AssetDto, NetWorthDto } from "@wealthme/contracts";

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = "semua" | "dana" | "rekening" | "investasi" | "fisik";

const TABS: { label: string; id: TabId }[] = [
  { label: "Semua", id: "semua" },
  { label: "Dana", id: "dana" },
  { label: "Rekening", id: "rekening" },
  { label: "Investasi", id: "investasi" },
  { label: "Aset Fisik", id: "fisik" },
];

const ASSET_TYPE_EMOJI: Record<string, string> = {
  properti: "🏠",
  kendaraan: "🚗",
  elektronik: "💻",
  perhiasan: "💍",
  lainnya: "📦",
};

const ASSET_TYPE_BG: Record<string, string> = {
  properti: "#FEF9C3",
  kendaraan: "#DBEAFE",
  elektronik: "#F3F4F6",
  perhiasan: "#FDE68A",
  lainnya: "#E5E7EB",
};

const ASSET_TYPE_LABEL: Record<string, string> = {
  properti: "Properti",
  kendaraan: "Kendaraan",
  elektronik: "Elektronik",
  perhiasan: "Perhiasan",
  lainnya: "Lainnya",
};

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Bone({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-muted ${className ?? ""}`} />
  );
}

function AssetCardSkeleton() {
  return (
    <div className="rounded-[14px] border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <Bone className="h-4 w-32" />
        <Bone className="h-4 w-24" />
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 py-3 border-b last:border-0"
        >
          <Bone className="size-9 rounded-[10px]" />
          <div className="flex-1 space-y-1.5">
            <Bone className="h-3 w-28" />
            <Bone className="h-2.5 w-20" />
          </div>
          <Bone className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

// ── Add Asset Modal ───────────────────────────────────────────────────────────

const ASSET_TYPES = [
  "properti",
  "kendaraan",
  "elektronik",
  "perhiasan",
  "lainnya",
] as const;
type AssetTypeValue = (typeof ASSET_TYPES)[number];

interface AddAssetModalProps {
  familyGroupId: string;
  onClose: () => void;
}

function AddAssetModal({ familyGroupId, onClose }: AddAssetModalProps) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  const [name, setName] = useState("");
  const [type, setType] = useState<AssetTypeValue>("properti");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: (body: {
      name: string;
      type: string;
      currentValue: string;
      notes?: string;
    }) => {
      if (!token || !familyGroupId) {
        return Promise.reject(new Error("Not authenticated"));
      }
      return apiFetch<AssetDto>(`/family-groups/${familyGroupId}/assets`, {
        method: "POST",
        token,
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.assets.all(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.netWorth.summary(familyGroupId),
      });
      toast.success("Aset berhasil ditambahkan");
      onClose();
    },
    onError: () => {
      toast.error("Gagal menambahkan aset. Silakan coba lagi.");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const digits = value.replace(/\D/g, "");
    if (!name.trim() || !digits) return;
    mutation.mutate({
      name: name.trim(),
      type,
      currentValue: digits,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-[20px] bg-background p-6 sm:rounded-[20px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <span className="text-[15px] font-bold">Tambah Aset Fisik</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-muted-foreground">
              Nama Aset
            </label>
            <input
              className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
              placeholder="cth. Apartemen Kelapa Gading"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-semibold text-muted-foreground">
              Kategori
            </label>
            <select
              className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
              value={type}
              onChange={(e) => setType(e.target.value as AssetTypeValue)}
            >
              {ASSET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ASSET_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-semibold text-muted-foreground">
              Nilai Aset (Rp)
            </label>
            <input
              className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
              placeholder="cth. 200.000.000"
              inputMode="numeric"
              value={value}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "");
                setValue(
                  digits ? parseInt(digits, 10).toLocaleString("id-ID") : "",
                );
              }}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-semibold text-muted-foreground">
              Catatan (opsional)
            </label>
            <input
              className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
              placeholder="cth. Lantai 5 unit B"
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Menyimpan…" : "Simpan Aset"}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ── Asset Group Card ──────────────────────────────────────────────────────────

function AssetGroupCard({ assets }: { assets: AssetDto[] }) {
  const groupTotal = assets.reduce(
    (sum, a) => sum + BigInt(a.currentValue),
    BigInt(0),
  );

  return (
    <div className="rounded-[14px] border bg-card p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-[17px]">🏠</span>
          <span className="text-[13.5px] font-bold">Aset Fisik</span>
        </div>
        <div className="text-[14px] font-extrabold">
          {formatRupiah(Number(groupTotal))}
        </div>
      </div>
      <div>
        {assets.map((asset, i) => (
          <div
            key={asset.id}
            className={`flex items-center gap-3 py-3 ${i < assets.length - 1 ? "border-b" : ""}`}
          >
            <div
              className="flex size-9 items-center justify-center rounded-[10px] text-[16px]"
              style={{ background: ASSET_TYPE_BG[asset.type] ?? "#E5E7EB" }}
            >
              {ASSET_TYPE_EMOJI[asset.type] ?? "📦"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold truncate">
                {asset.name}
              </div>
              {asset.notes && (
                <div className="text-[11.5px] text-muted-foreground truncate">
                  {asset.notes}
                </div>
              )}
              {!asset.notes && (
                <div className="text-[11.5px] text-muted-foreground">
                  {ASSET_TYPE_LABEL[asset.type] ?? asset.type}
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-[14px] font-extrabold">
                {formatRupiah(Number(BigInt(asset.currentValue)))}
              </div>
            </div>
          </div>
        ))}
        {assets.length === 0 && (
          <div className="py-4 text-center text-[12px] text-muted-foreground">
            Belum ada aset fisik.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Placeholder Group Cards ────────────────────────────────────────────────────

function PlaceholderGroupCard({
  emoji,
  name,
}: {
  emoji: string;
  name: string;
}) {
  return (
    <div className="rounded-[14px] border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-[17px]">{emoji}</span>
          <span className="text-[13.5px] font-bold">{name}</span>
        </div>
        <div className="text-[13px] text-muted-foreground">—</div>
      </div>
      <div className="mt-3 py-3 text-center text-[12px] text-muted-foreground">
        Data akan tersedia setelah modul terkait aktif.
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AsetPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  const familyGroupId = session?.user?.memberships?.[0]?.familyGroupId;

  const {
    data: assets,
    isLoading: assetsLoading,
    isError: assetsError,
  } = useQuery<AssetDto[]>({
    queryKey: queryKeys.assets.all(familyGroupId ?? ""),
    enabled: Boolean(familyGroupId) && Boolean(token),
    queryFn: ({ signal }) => {
      if (!familyGroupId) throw new Error("familyGroupId not available");
      return apiFetch<AssetDto[]>(`/family-groups/${familyGroupId}/assets`, {
        token,
        signal,
      });
    },
  });

  const { data: netWorth, isLoading: netWorthLoading } = useQuery<NetWorthDto>({
    queryKey: queryKeys.netWorth.summary(familyGroupId ?? ""),
    enabled: Boolean(familyGroupId) && Boolean(token),
    queryFn: ({ signal }) => {
      if (!familyGroupId) throw new Error("familyGroupId not available");
      return apiFetch<NetWorthDto>(
        `/family-groups/${familyGroupId}/dashboard/net-worth`,
        { token, signal },
      );
    },
  });

  useEffect(() => {
    if (assetsError) {
      toast.error("Gagal memuat data aset. Silakan refresh halaman.");
    }
  }, [assetsError]);

  const activeId = TABS[activeTab]?.id ?? "semua";
  const showFisik = activeId === "semua" || activeId === "fisik";
  const showDana = activeId === "semua" || activeId === "dana";
  const showRekening = activeId === "semua" || activeId === "rekening";
  const showInvestasi = activeId === "semua" || activeId === "investasi";

  const assetsTotalStr = netWorth?.assetsTotal ?? "0";
  const assetsTotal = Number(BigInt(assetsTotalStr));

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="hide-scrollbar flex gap-2 overflow-x-auto">
        {TABS.map((tab, i) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(i)}
            className={`shrink-0 cursor-pointer rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
              activeTab === i
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Total Banner */}
      <div
        className="flex flex-wrap items-center justify-between gap-2.5 rounded-[14px] border-[1.5px] p-4 px-[18px]"
        style={{ background: "var(--accent)", borderColor: "#C7D2FE" }}
      >
        <div>
          <div className="mb-[3px] text-[11px] text-muted-foreground">
            Total Aset Fisik
          </div>
          {netWorthLoading ? (
            <div className="animate-pulse h-7 w-40 rounded bg-muted" />
          ) : (
            <div className="text-[24px] font-black text-primary-strong">
              {formatRupiah(assetsTotal)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="h-auto px-[14px] py-2"
            disabled={!familyGroupId || !token}
          >
            <Plus className="size-4" /> Tambah Aset
          </Button>
          <button
            type="button"
            aria-label="Kunci tampilan aset"
            className="flex size-9 cursor-pointer items-center justify-center rounded-md border bg-background transition-colors hover:bg-accent"
          >
            <Lock className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Error */}
      {assetsError && (
        <div
          role="alert"
          className="rounded-[14px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive"
        >
          Gagal memuat data aset. Silakan refresh halaman.
        </div>
      )}

      {/* Asset Cards */}
      {assetsLoading ? (
        <AssetCardSkeleton />
      ) : (
        <>
          {showDana && (
            <PlaceholderGroupCard emoji="💳" name="Dana & Rekening" />
          )}
          {showRekening && activeId === "rekening" && (
            <PlaceholderGroupCard emoji="🏦" name="Rekening" />
          )}
          {showInvestasi && (
            <PlaceholderGroupCard emoji="📈" name="Investasi" />
          )}
          {showFisik && <AssetGroupCard assets={assets ?? []} />}
        </>
      )}

      {/* Add Modal */}
      {showAddModal && familyGroupId && (
        <AddAssetModal
          familyGroupId={familyGroupId}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
