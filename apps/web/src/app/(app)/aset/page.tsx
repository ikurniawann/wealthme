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

import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { formatRupiah } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { IconChip, CountUpRupiah, Rise } from "@/components/wm";

import { DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT } from "@wealthme/contracts";
import type {
  AssetDto,
  AccountDto,
  InvestmentDto,
  CategoryDto,
  AssetTypeId,
} from "@wealthme/contracts";

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = "semua" | "dana" | "rekening" | "investasi" | "fisik";

const TAB_IDS: TabId[] = ["semua", "dana", "rekening", "investasi", "fisik"];

// ── Physical asset lookups ────────────────────────────────────────────────────

const ASSET_TYPE_ICON: Record<string, { icon: LucideIcon; chip: string }> = {
  properti: { icon: Home, chip: "bg-yellow-100 text-yellow-600" },
  kendaraan: { icon: Car, chip: "bg-blue-100 text-blue-600" },
  elektronik: { icon: Laptop, chip: "bg-gray-100 text-gray-600" },
  perhiasan: { icon: Gem, chip: "bg-amber-100 text-amber-600" },
  lainnya: { icon: Package, chip: "bg-gray-100 text-gray-600" },
};

// ── Account lookups ───────────────────────────────────────────────────────────

const ACCOUNT_TYPE_ICON: Record<string, { icon: LucideIcon; chip: string }> = {
  bank: { icon: Landmark, chip: "bg-blue-100 text-blue-600" },
  ewallet: { icon: Wallet, chip: "bg-green-100 text-green-600" },
  cash: { icon: Wallet, chip: "bg-green-100 text-green-600" },
  investment: { icon: TrendingUp, chip: "bg-violet-100 text-violet-600" },
  property: { icon: Home, chip: "bg-yellow-100 text-yellow-600" },
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
] as const satisfies readonly AssetTypeId[];

/**
 * EPIC-023 Task H1 review (HIGH fix 1): Indonesia Western Time — fixed
 * UTC+7, no daylight saving. Mirrors the same-named constant/reasoning in
 * `assets.service.ts` — duplicated here (not imported; `apps/web/src/lib`
 * is a protected foundation file this task must not touch) because a
 * calendar-date `max` computed from the browser's local/UTC calendar date
 * blocks "today" for Jakarta users during the first ~7 hours of every WIB
 * day (9h for WIT). DO NOT simplify this back to `new Date().toISOString()`.
 */
const WIB_UTC_OFFSET_MINUTES = 7 * 60;

/** Today's calendar date (YYYY-MM-DD) in WIB wall-clock terms. */
function wibTodayDateString(): string {
  return new Date(Date.now() + WIB_UTC_OFFSET_MINUTES * 60_000)
    .toISOString()
    .slice(0, 10);
}

interface AddAssetModalProps {
  familyGroupId: string;
  onClose: () => void;
}

function AddAssetModal({ familyGroupId, onClose }: AddAssetModalProps) {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  const [name, setName] = useState("");
  const [type, setType] = useState<AssetTypeId>("properti");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [valueChangeRatePct, setValueChangeRatePct] = useState("");
  const [categoryId, setCategoryId] = useState("");
  // EPIC-023 D19/US-ASSET-4: elapsed-time anchor for currentEstimatedValue,
  // falls back to createdAt server-side when left blank.
  const [acquisitionDate, setAcquisitionDate] = useState("");

  // EPIC-021 #16: real master-data categories for the optional category
  // select (same query key/cache as /masterdata).
  const { data: categories } = useQuery<CategoryDto[]>({
    queryKey: queryKeys.categories.all(familyGroupId),
    enabled: Boolean(familyGroupId) && Boolean(token),
    queryFn: () =>
      apiFetch<CategoryDto[]>(`/family-groups/${familyGroupId}/categories`, {
        token,
      }),
  });

  const mutation = useMutation({
    mutationFn: (body: {
      name: string;
      type: string;
      currentValue: string;
      notes?: string;
      valueChangeRatePct?: string;
      categoryId?: string;
      acquisitionDate?: string;
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
      toast.success(t.aset.toastAdded);
      onClose();
    },
    onError: () => {
      toast.error(t.aset.toastAddFailed);
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
      valueChangeRatePct: valueChangeRatePct.trim() || undefined,
      categoryId: categoryId || undefined,
      acquisitionDate: acquisitionDate || undefined,
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
          <span className="text-[15px] font-bold">{t.aset.modalTitle}</span>
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
            <label
              htmlFor="asset-name"
              className="mb-1 block text-[12px] font-semibold text-muted-foreground"
            >
              {t.aset.fieldNameLabel}
            </label>
            <input
              id="asset-name"
              className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
              placeholder={t.aset.fieldNamePlaceholder}
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label
              htmlFor="asset-type"
              className="mb-1 block text-[12px] font-semibold text-muted-foreground"
            >
              {t.aset.fieldCategoryLabel}
            </label>
            <select
              id="asset-type"
              className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
              value={type}
              onChange={(e) => {
                const newType = e.target.value as AssetTypeId;
                setType(newType);
                // EPIC-023 D19/US-ASSET-4: pre-fill the rate field from the
                // per-type default only when the user hasn't typed one yet
                // — a suggestion, not a constraint; still freely editable.
                if (!valueChangeRatePct.trim()) {
                  setValueChangeRatePct(
                    String(DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT[newType]),
                  );
                }
              }}
            >
              {ASSET_TYPES.map((assetType) => (
                <option key={assetType} value={assetType}>
                  {t.aset.assetTypeLabels[assetType]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="asset-value"
              className="mb-1 block text-[12px] font-semibold text-muted-foreground"
            >
              {t.aset.fieldValueLabel}
            </label>
            <input
              id="asset-value"
              className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
              placeholder={t.aset.fieldValuePlaceholder}
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
            <label
              htmlFor="asset-rate"
              className="mb-1 block text-[12px] font-semibold text-muted-foreground"
            >
              {t.aset.fieldValueChangeRateLabel}
            </label>
            <input
              id="asset-rate"
              type="number"
              className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
              placeholder={t.aset.fieldValueChangeRatePlaceholder}
              inputMode="decimal"
              step="0.01"
              min={-100}
              max={100}
              value={valueChangeRatePct}
              onChange={(e) => setValueChangeRatePct(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t.aset.defaultRateHelperPrefix}:{" "}
              {DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT[type]}%
            </p>
          </div>

          <div>
            <label
              htmlFor="asset-acquisition-date"
              className="mb-1 block text-[12px] font-semibold text-muted-foreground"
            >
              {t.aset.fieldAcquisitionDateLabel}
            </label>
            <input
              id="asset-acquisition-date"
              type="date"
              className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
              max={wibTodayDateString()}
              value={acquisitionDate}
              onChange={(e) => setAcquisitionDate(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t.aset.fieldAcquisitionDateHelper}
            </p>
          </div>

          <div>
            <label
              htmlFor="asset-category"
              className="mb-1 block text-[12px] font-semibold text-muted-foreground"
            >
              {t.aset.fieldMasterDataCategoryLabel}
            </label>
            <select
              id="asset-category"
              className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">{t.aset.fieldMasterDataCategoryNone}</option>
              {(categories ?? []).map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="asset-notes"
              className="mb-1 block text-[12px] font-semibold text-muted-foreground"
            >
              {t.aset.fieldNotesLabel}
            </label>
            <input
              id="asset-notes"
              className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
              placeholder={t.aset.fieldNotesPlaceholder}
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
            {mutation.isPending ? t.aset.saving : t.aset.saveButton}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ── Physical Asset Row ─────────────────────────────────────────────────────────

interface AssetRowProps {
  asset: AssetDto;
  familyGroupId: string;
  token: string | undefined;
  subtitle: string;
  isLast: boolean;
  index: number;
}

/**
 * EPIC-023 D19/US-ASSET-4: currentValue (recorded, authoritative) is the
 * PRIMARY bold figure. currentEstimatedValue (compute-on-read projection)
 * only appears as a secondary, clearly-labeled "Proyeksi:" line when it
 * actually differs from currentValue — with an adoptable "use this figure"
 * action that PATCHes currentValue to the projection.
 *
 * EPIC-023 Task H1 review (MEDIUM fix 5): `token` is received as a prop
 * (threaded from AsetPage through AssetGroupCard) rather than calling
 * useSession() again here — AsetPage already resolves it once at the top
 * level, matching how familyGroupId is already passed down.
 */
function AssetRow({
  asset,
  familyGroupId,
  token,
  subtitle,
  isLast,
  index,
}: AssetRowProps) {
  const { t } = useLocale();
  const queryClient = useQueryClient();

  const cfg = ASSET_TYPE_ICON[asset.type] ?? {
    icon: Package,
    chip: "bg-gray-100 text-gray-600",
  };
  const recordedValue = BigInt(asset.currentValue ?? "0");
  const estimatedValue = BigInt(
    asset.currentEstimatedValue ?? asset.currentValue ?? "0",
  );
  const hasProjectionDrift = estimatedValue !== recordedValue;

  const adoptMutation = useMutation({
    mutationFn: () => {
      // EPIC-023 Task H1 review (LOW fix 6): guard !familyGroupId too, for
      // symmetry with AddAssetModal's mutationFn guard — familyGroupId is
      // typed required but AssetGroupCard falls back to "" when absent.
      if (!token || !familyGroupId) {
        return Promise.reject(new Error("Not authenticated"));
      }
      return apiFetch<AssetDto>(
        `/family-groups/${familyGroupId}/assets/${asset.id}`,
        {
          method: "PATCH",
          token,
          body: JSON.stringify({ currentValue: asset.currentEstimatedValue }),
        },
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.assets.all(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.netWorth.summary(familyGroupId),
      });
      toast.success(t.aset.toastValueAdopted);
    },
    onError: () => {
      toast.error(t.aset.toastValueAdoptFailed);
    },
  });

  return (
    <Rise index={index}>
      <div
        className={`flex items-center gap-3 py-3 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)] ${isLast ? "" : "border-b"}`}
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
            {subtitle}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[14px] font-extrabold">
            {formatRupiah(Number(recordedValue))}
          </div>
          {hasProjectionDrift && (
            <div className="mt-0.5 flex items-center justify-end gap-1.5">
              <span className="text-[10px] text-muted-foreground">
                {t.aset.projectionLabel}: {formatRupiah(Number(estimatedValue))}
              </span>
              <button
                type="button"
                onClick={() => adoptMutation.mutate()}
                disabled={adoptMutation.isPending || !token || !familyGroupId}
                className="cursor-pointer text-[10px] font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t.aset.useThisValueButton}
              </button>
            </div>
          )}
        </div>
      </div>
    </Rise>
  );
}

// ── Physical Asset Group Card ─────────────────────────────────────────────────

interface AssetGroupCardProps {
  assets: AssetDto[];
  categoryNameById: Record<string, string>;
  familyGroupId: string;
  token: string | undefined;
}

function AssetGroupCard({
  assets,
  categoryNameById,
  familyGroupId,
  token,
}: AssetGroupCardProps) {
  const { t } = useLocale();
  // EPIC-023 D19/US-ASSET-4: currentValue (recorded) is authoritative for
  // net worth — this total must always agree with what the rest of the app
  // (dashboard, balance sheet) calls net worth, which also sums
  // currentValue, never the compute-on-read projection.
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
          <span className="text-[13.5px] font-bold">
            {t.aset.physicalAssetsTitle}
          </span>
        </div>
        <div className="text-[14px] font-extrabold">
          {formatRupiah(Number(groupTotal))}
        </div>
      </div>
      <div>
        {assets.map((asset, i) => {
          const subtitle = asset.notes
            ? asset.notes
            : (asset.categoryId && categoryNameById[asset.categoryId]) ||
              (t.aset.assetTypeLabels[
                asset.type as keyof typeof t.aset.assetTypeLabels
              ] ??
                asset.type);
          return (
            <AssetRow
              key={asset.id}
              asset={asset}
              familyGroupId={familyGroupId}
              token={token}
              subtitle={subtitle}
              isLast={i === assets.length - 1}
              index={i}
            />
          );
        })}
        {assets.length === 0 && (
          <div className="py-4 text-center text-[12px] text-muted-foreground">
            {t.aset.emptyPhysical}
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
  const { t } = useLocale();
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
            t.aset.accountTypeLabels[
              account.type as keyof typeof t.aset.accountTypeLabels
            ] ??
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
            {t.aset.emptyDanaRekening}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Investasi Group Card ──────────────────────────────────────────────────────

function InvestasiGroupCard({ investments }: { investments: InvestmentDto[] }) {
  const { t } = useLocale();
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
          <span className="text-[13.5px] font-bold">
            {t.aset.investmentsTitle}
          </span>
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
                    {t.aset.invTypeLabels[
                      inv.type as keyof typeof t.aset.invTypeLabels
                    ] ?? inv.type}
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
            {t.aset.emptyInvestments}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AsetPage() {
  const { t } = useLocale();
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

  // Categories (EPIC-021 #16: master-data category names for physical assets)
  const { data: categories } = useQuery<CategoryDto[]>({
    queryKey: queryKeys.categories.all(familyGroupId ?? ""),
    enabled: Boolean(familyGroupId) && Boolean(token),
    queryFn: () =>
      apiFetch<CategoryDto[]>(`/family-groups/${familyGroupId}/categories`, {
        token,
      }),
  });
  const categoryNameById = Object.fromEntries(
    (categories ?? []).map((c) => [c.id, c.name]),
  );

  const hasError = assetsError || accountsError || investmentsError;

  useEffect(() => {
    if (hasError) {
      toast.error(t.aset.errorLoad);
    }
  }, [hasError, t]);

  const activeId = TAB_IDS[activeTab] ?? "semua";

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
  // EPIC-023 D19/US-ASSET-4: currentValue (recorded) is authoritative for
  // net worth — this banner must agree with the dashboard/balance sheet,
  // which also sum currentValue, never currentEstimatedValue (the
  // compute-on-read projection from valueChangeRatePct, EPIC-021 #17/#18).
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
        {TAB_IDS.map((id, i) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(i)}
            className={`shrink-0 cursor-pointer rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
              activeTab === i
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            {t.aset.tabs[id]}
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
            {t.aset.totalAssetsLabel}
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
            <Plus className="size-4" /> {t.aset.addAssetButton}
          </Button>
          <button
            type="button"
            aria-label={t.aset.lockAriaLabel}
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
          {t.aset.errorLoad}
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
              title={t.aset.danaRekeningTitle}
              headerIcon={Wallet}
              headerChip="bg-green-100 text-green-600"
            />
          )}

          {/* Dana tab: cash + ewallet only */}
          {showDana && (
            <AccountsGroupCard
              accounts={danaAccounts}
              title={t.aset.danaTitle}
              headerIcon={Wallet}
              headerChip="bg-green-100 text-green-600"
            />
          )}

          {/* Rekening tab: bank accounts only */}
          {showRekening && (
            <AccountsGroupCard
              accounts={rekeningAccounts}
              title={t.aset.rekeningTitle}
              headerIcon={Landmark}
              headerChip="bg-blue-100 text-blue-600"
            />
          )}

          {/* Investasi card */}
          {showInvestasi && (
            <InvestasiGroupCard investments={investments ?? []} />
          )}

          {/* Aset Fisik card */}
          {showFisik && (
            <AssetGroupCard
              assets={assets ?? []}
              categoryNameById={categoryNameById}
              familyGroupId={familyGroupId ?? ""}
              token={token}
            />
          )}
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
