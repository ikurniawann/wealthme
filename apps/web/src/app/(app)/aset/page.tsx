"use client";

import { useEffect, useState } from "react";
import {
  Lock,
  Plus,
  X,
  Landmark,
  Wallet,
  TrendingUp,
  Home,
  Car,
  Laptop,
  Gem,
  Package,
  BarChart2,
  Building,
  type LucideIcon,
} from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";
import { formatRupiah } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { IconChip, CountUpRupiah, Rise } from "@/components/wm";

import type { AssetDto, AccountDto, InvestmentDto } from "@wealthme/contracts";

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = "semua" | "dana" | "rekening" | "investasi" | "fisik";

const TABS: { label: string; id: TabId }[] = [
  { label: "Semua", id: "semua" },
  { label: "Dana", id: "dana" },
  { label: "Rekening", id: "rekening" },
  { label: "Investasi", id: "investasi" },
  { label: "Aset Fisik", id: "fisik" },
];

// ── Physical asset lookups ────────────────────────────────────────────────────

const ASSET_TYPE_ICON: Record<string, { icon: LucideIcon; chip: string }> = {
  properti: { icon: Home, chip: "bg-yellow-100 text-yellow-600" },
  kendaraan: { icon: Car, chip: "bg-blue-100 text-blue-600" },
  elektronik: { icon: Laptop, chip: "bg-gray-100 text-gray-600" },
  perhiasan: { icon: Gem, chip: "bg-amber-100 text-amber-600" },
  lainnya: { icon: Package, chip: "bg-gray-100 text-gray-600" },
};

const ASSET_TYPE_LABEL: Record<string, string> = {
  properti: "Properti",
  kendaraan: "Kendaraan",
  elektronik: "Elektronik",
  perhiasan: "Perhiasan",
  lainnya: "Lainnya",
};

// ── Account lookups ───────────────────────────────────────────────────────────

const ACCOUNT_TYPE_ICON: Record<string, { icon: LucideIcon; chip: string }> = {
  bank: { icon: Landmark, chip: "bg-blue-100 text-blue-600" },
  ewallet: { icon: Wallet, chip: "bg-green-100 text-green-600" },
  cash: { icon: Wallet, chip: "bg-green-100 text-green-600" },
  investment: { icon: TrendingUp, chip: "bg-violet-100 text-violet-600" },
  property: { icon: Home, chip: "bg-yellow-100 text-yellow-600" },
};

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  bank: "Bank",
  ewallet: "E-Wallet",
  cash: "Tunai",
  investment: "Investasi",
  property: "Properti",
};

// ── Investment type lookups ───────────────────────────────────────────────────

const INV_TYPE_ICON: Record<string, { icon: LucideIcon; chip: string }> = {
  saham: { icon: TrendingUp, chip: "bg-blue-100 text-blue-600" },
  reksa_dana: { icon: BarChart2, chip: "bg-indigo-100 text-indigo-600" },
  obligasi: { icon: Building, chip: "bg-green-100 text-green-600" },
  emas: { icon: Gem, chip: "bg-yellow-100 text-yellow-600" },
  kripto: { icon: TrendingUp, chip: "bg-orange-100 text-orange-600" },
  lainnya: { icon: Package, chip: "bg-violet-100 text-violet-600" },
};

const INV_TYPE_LABEL: Record<string, string> = {
  saham: "Saham",
  reksa_dana: "Reksa Dana",
  obligasi: "Obligasi",
  emas: "Emas",
  kripto: "Kripto",
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

// ── Physical Asset Group Card ─────────────────────────────────────────────────

function AssetGroupCard({ assets }: { assets: AssetDto[] }) {
  const groupTotal = assets.reduce(
    (sum, a) => sum + BigInt(a.currentValue ?? "0"),
    BigInt(0),
  );

  return (
    <div className="rounded-[14px] border bg-card p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <IconChip
            icon={Home}
            className="bg-yellow-100 text-yellow-600"
            size={28}
          />
          <span className="text-[13.5px] font-bold">Aset Fisik</span>
        </div>
        <div className="text-[14px] font-extrabold">
          {formatRupiah(Number(groupTotal))}
        </div>
      </div>
      <div>
        {assets.map((asset, i) => {
          const cfg = ASSET_TYPE_ICON[asset.type] ?? {
            icon: Package,
            chip: "bg-gray-100 text-gray-600",
          };
          return (
            <Rise key={asset.id} index={i}>
              <div
                className={`flex items-center gap-3 py-3 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)] ${i < assets.length - 1 ? "border-b" : ""}`}
              >
                <IconChip
                  icon={cfg.icon}
                  className={cfg.chip}
                  size={34}
                  rounded="rounded-full"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold truncate">
                    {asset.name}
                  </div>
                  <div className="text-[11.5px] text-muted-foreground truncate">
                    {asset.notes
                      ? asset.notes
                      : (ASSET_TYPE_LABEL[asset.type] ?? asset.type)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[14px] font-extrabold">
                    {formatRupiah(Number(BigInt(asset.currentValue ?? "0")))}
                  </div>
                </div>
              </div>
            </Rise>
          );
        })}
        {assets.length === 0 && (
          <div className="py-4 text-center text-[12px] text-muted-foreground">
            Belum ada aset fisik.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Dana & Rekening Group Card ────────────────────────────────────────────────

interface AccountsGroupCardProps {
  accounts: AccountDto[];
  title: string;
  headerIcon: LucideIcon;
  headerChip: string;
}

function AccountsGroupCard({
  accounts,
  title,
  headerIcon,
  headerChip,
}: AccountsGroupCardProps) {
  const groupTotal = accounts.reduce(
    (sum, a) => sum + BigInt(a.balance ?? "0"),
    BigInt(0),
  );

  return (
    <div className="rounded-[14px] border bg-card p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <IconChip icon={headerIcon} className={headerChip} size={28} />
          <span className="text-[13.5px] font-bold">{title}</span>
        </div>
        <div className="text-[14px] font-extrabold">
          {formatRupiah(Number(groupTotal))}
        </div>
      </div>
      <div>
        {accounts.map((account, i) => {
          const subtitle =
            account.institution ??
            account.maskedNumber ??
            ACCOUNT_TYPE_LABEL[account.type] ??
            account.type;
          const cfg = ACCOUNT_TYPE_ICON[account.type] ?? {
            icon: Wallet,
            chip: "bg-gray-100 text-gray-600",
          };
          return (
            <Rise key={account.id} index={i}>
              <div
                className={`flex items-center gap-3 py-3 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)] ${i < accounts.length - 1 ? "border-b" : ""}`}
              >
                <IconChip
                  icon={cfg.icon}
                  className={cfg.chip}
                  size={34}
                  rounded="rounded-full"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold truncate">
                    {account.name}
                  </div>
                  <div className="text-[11.5px] text-muted-foreground truncate">
                    {subtitle}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[14px] font-extrabold">
                    {formatRupiah(Number(BigInt(account.balance ?? "0")))}
                  </div>
                </div>
              </div>
            </Rise>
          );
        })}
        {accounts.length === 0 && (
          <div className="py-4 text-center text-[12px] text-muted-foreground">
            Belum ada dana &amp; rekening.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Investasi Group Card ──────────────────────────────────────────────────────

function InvestasiGroupCard({ investments }: { investments: InvestmentDto[] }) {
  // currentValue is a computed Decimal (quantity × price) serialized as a
  // string that can contain a fractional part — BigInt() throws on that
  // ("invalid BigInt syntax"), so unlike Account.balance/Asset.currentValue
  // (genuine BigInt-backed fields) this must be parsed as a float.
  const groupTotal = investments.reduce(
    (sum, inv) => sum + parseFloat(inv.currentValue ?? "0"),
    0,
  );

  return (
    <div className="rounded-[14px] border bg-card p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <IconChip
            icon={TrendingUp}
            className="bg-violet-100 text-violet-600"
            size={28}
          />
          <span className="text-[13.5px] font-bold">Investasi</span>
        </div>
        <div className="text-[14px] font-extrabold">
          {formatRupiah(Number(groupTotal))}
        </div>
      </div>
      <div>
        {investments.map((inv, i) => {
          const cfg = INV_TYPE_ICON[inv.type] ?? {
            icon: Package,
            chip: "bg-violet-100 text-violet-600",
          };
          return (
            <Rise key={inv.id} index={i}>
              <div
                className={`flex items-center gap-3 py-3 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)] ${i < investments.length - 1 ? "border-b" : ""}`}
              >
                <IconChip
                  icon={cfg.icon}
                  className={cfg.chip}
                  size={34}
                  rounded="rounded-full"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold truncate">
                    {inv.ticker} — {inv.name}
                  </div>
                  <div className="text-[11.5px] text-muted-foreground truncate">
                    {INV_TYPE_LABEL[inv.type] ?? inv.type}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[14px] font-extrabold">
                    {formatRupiah(parseFloat(inv.currentValue ?? "0"))}
                  </div>
                </div>
              </div>
            </Rise>
          );
        })}
        {investments.length === 0 && (
          <div className="py-4 text-center text-[12px] text-muted-foreground">
            Belum ada investasi.
          </div>
        )}
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
  const familyGroupId = session?.familyGroupId;

  // Physical assets
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

  // Accounts (Dana & Rekening)
  const {
    data: accounts,
    isLoading: accountsLoading,
    isError: accountsError,
  } = useQuery<AccountDto[]>({
    queryKey: queryKeys.accounts.all(familyGroupId ?? ""),
    enabled: Boolean(familyGroupId) && Boolean(token),
    queryFn: ({ signal }) => {
      if (!familyGroupId) throw new Error("familyGroupId not available");
      return apiFetch<AccountDto[]>(
        `/family-groups/${familyGroupId}/accounts`,
        {
          token,
          signal,
        },
      );
    },
  });

  // Investments
  const {
    data: investments,
    isLoading: investmentsLoading,
    isError: investmentsError,
  } = useQuery<InvestmentDto[]>({
    queryKey: queryKeys.investments.all(familyGroupId ?? ""),
    enabled: Boolean(familyGroupId) && Boolean(token),
    queryFn: ({ signal }) => {
      if (!familyGroupId) throw new Error("familyGroupId not available");
      return apiFetch<InvestmentDto[]>(
        `/family-groups/${familyGroupId}/investments`,
        { token, signal },
      );
    },
  });

  const hasError = assetsError || accountsError || investmentsError;

  useEffect(() => {
    if (hasError) {
      toast.error("Gagal memuat sebagian data aset. Silakan refresh halaman.");
    }
  }, [hasError]);

  const activeId = TABS[activeTab]?.id ?? "semua";

  // Tab visibility flags
  const showFisik = activeId === "semua" || activeId === "fisik";
  const showInvestasi = activeId === "semua" || activeId === "investasi";
  // "Dana" tab = cash + ewallet; "Rekening" tab = bank; "Semua" shows all accounts in one card
  const showDanaRekeningCombined = activeId === "semua";
  const showDana = activeId === "dana";
  const showRekening = activeId === "rekening";

  // Filter accounts by tab
  const danaAccounts = (accounts ?? []).filter(
    (a) => a.type === "cash" || a.type === "ewallet",
  );
  const rekeningAccounts = (accounts ?? []).filter((a) => a.type === "bank");
  const allAccounts = accounts ?? [];

  // Compute totals for total banner (gross assets = accounts + investments + physical assets)
  const accountsTotalBig = (accounts ?? []).reduce(
    (sum, a) => sum + BigInt(a.balance ?? "0"),
    BigInt(0),
  );
  // currentValue is a computed Decimal (quantity × price) and can be
  // fractional — BigInt() throws on that, so sum it as a float instead
  // (see the same note on InvestasiGroupCard above).
  const investmentsTotal = (investments ?? []).reduce(
    (sum, inv) => sum + parseFloat(inv.currentValue ?? "0"),
    0,
  );
  const assetsTotalBig = (assets ?? []).reduce(
    (sum, a) => sum + BigInt(a.currentValue ?? "0"),
    BigInt(0),
  );
  const grandTotal =
    Number(accountsTotalBig + assetsTotalBig) + investmentsTotal;

  const isLoading = assetsLoading || accountsLoading || investmentsLoading;

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
            Total Aset
          </div>
          {isLoading ? (
            <div className="animate-pulse h-7 w-40 rounded bg-muted" />
          ) : (
            <div className="mono text-[24px] font-black text-primary-strong">
              <CountUpRupiah value={grandTotal} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="h-auto px-[14px] py-2"
            disabled={!familyGroupId || !token}
            data-tour="add-aset"
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

      {/* Errors */}
      {hasError && (
        <div
          role="alert"
          className="rounded-[14px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive"
        >
          Gagal memuat sebagian data aset. Silakan refresh halaman.
        </div>
      )}

      {/* Asset Cards */}
      {isLoading ? (
        <>
          <AssetCardSkeleton />
          <AssetCardSkeleton />
          <AssetCardSkeleton />
        </>
      ) : (
        <>
          {/* Semua: combined Dana & Rekening card */}
          {showDanaRekeningCombined && (
            <AccountsGroupCard
              accounts={allAccounts}
              title="Dana & Rekening"
              headerIcon={Wallet}
              headerChip="bg-green-100 text-green-600"
            />
          )}

          {/* Dana tab: cash + ewallet only */}
          {showDana && (
            <AccountsGroupCard
              accounts={danaAccounts}
              title="Dana"
              headerIcon={Wallet}
              headerChip="bg-green-100 text-green-600"
            />
          )}

          {/* Rekening tab: bank accounts only */}
          {showRekening && (
            <AccountsGroupCard
              accounts={rekeningAccounts}
              title="Rekening"
              headerIcon={Landmark}
              headerChip="bg-blue-100 text-blue-600"
            />
          )}

          {/* Investasi card */}
          {showInvestasi && (
            <InvestasiGroupCard investments={investments ?? []} />
          )}

          {/* Aset Fisik card */}
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
