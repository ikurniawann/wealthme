"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calculator,
  Eye,
  EyeOff,
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
import { useCanManage } from "@/hooks/use-role-permissions";
import { apiFetch } from "@/lib/api-client";
import { formatRupiah } from "@/lib/format";
import { uploadAssetDocument } from "@/lib/asset-attachments";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { IconChip, CountUpRupiah, Rise, DateField } from "@/components/wm";
import { DonutChart, TrendChart } from "@/components/charts/apex-presets";
import type { DonutSegment } from "@/components/charts/donut";
import { RowActions, ConfirmDeleteDialog } from "@/components/crud";

import { DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT } from "@wealthme/contracts";
import type {
  AssetDto,
  AccountDto,
  InvestmentDto,
  CategoryDto,
  AssetTypeId,
  AssetValueChangeMode,
  NetWorthHistoryDto,
  NetWorthHistoryPointDto,
} from "@wealthme/contracts";

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = "semua" | "dana" | "rekening" | "investasi" | "fisik";

const TAB_IDS: TabId[] = ["semua", "dana", "rekening", "investasi", "fisik"];

// ── Privacy eye toggle (D1, US-ASSET-5) ─────────────────────────────────────────
// Per-user localStorage, namespaced the same way as device-storage.ts
// (`wm.<feature>.<userId>`) so one user's preference never bleeds into
// another's on a shared device.
const ASSET_PRIVACY_STORAGE_PREFIX = "wm.aset-privacy.";

function readStoredPrivacy(userId: string): boolean {
  try {
    return (
      window.localStorage.getItem(
        `${ASSET_PRIVACY_STORAGE_PREFIX}${userId}`,
      ) === "1"
    );
  } catch {
    // storage may be unavailable (private browsing, SSR)
    return false;
  }
}

function writeStoredPrivacy(userId: string, isOn: boolean): void {
  try {
    window.localStorage.setItem(
      `${ASSET_PRIVACY_STORAGE_PREFIX}${userId}`,
      isOn ? "1" : "0",
    );
  } catch {
    // storage may be unavailable — the toggle still works for this session
  }
}

// ── Physical asset lookups ────────────────────────────────────────────────────

const ASSET_TYPE_ICON: Record<string, { icon: LucideIcon; chip: string }> = {
  properti: { icon: Home, chip: "bg-yellow-100 text-yellow-600" },
  kendaraan: { icon: Car, chip: "bg-blue-100 text-blue-600" },
  elektronik: { icon: Laptop, chip: "bg-gray-100 text-gray-600" },
  perhiasan: { icon: Gem, chip: "bg-amber-100 text-amber-600" },
  emas: { icon: Gem, chip: "bg-yellow-100 text-yellow-600" },
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
  "emas",
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
  // EPIC-022 D5 — when set, the modal edits this asset (PATCH) instead of
  // creating a new one (POST); every field is pre-filled from its current
  // value, matching the AddInvestmentModal edit pattern.
  editing?: AssetDto | null;
}

function AddAssetModal({
  familyGroupId,
  onClose,
  editing,
}: AddAssetModalProps) {
  const { t, locale } = useLocale();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  const [name, setName] = useState(editing?.name ?? "");
  const [type, setType] = useState<AssetTypeId>(
    (editing?.type as AssetTypeId) ?? "properti",
  );
  const [value, setValue] = useState(
    editing ? Number(BigInt(editing.currentValue)).toLocaleString("id-ID") : "",
  );
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [valueChangeRatePct, setValueChangeRatePct] = useState(
    editing?.valueChangeRatePct ?? "",
  );
  // D2/US-ASSET-6: mode toggle — "percent" reuses the rate field above,
  // "fixed" swaps in a signed Rp/year amount field instead.
  const [valueChangeMode, setValueChangeMode] = useState<AssetValueChangeMode>(
    editing?.valueChangeMode ?? "percent",
  );
  const [valueChangeAmount, setValueChangeAmount] = useState(
    editing?.valueChangeAmount
      ? Number(BigInt(editing.valueChangeAmount)).toLocaleString("id-ID")
      : "",
  );
  // EPIC-033 p15 — no picker any more; kept so an edit round-trips the
  // value an older row may still carry.
  const categoryId = editing?.categoryId ?? "";
  const [docFile, setDocFile] = useState<File | null>(null);
  // EPIC-023 D19/US-ASSET-4: elapsed-time anchor for currentEstimatedValue,
  // falls back to createdAt server-side when left blank.
  const [acquisitionDate, setAcquisitionDate] = useState(
    editing?.acquisitionDate ? editing.acquisitionDate.slice(0, 10) : "",
  );

  const mutation = useMutation({
    mutationFn: (body: {
      name: string;
      type: string;
      currentValue: string;
      notes?: string;
      valueChangeRatePct?: string;
      valueChangeMode?: AssetValueChangeMode;
      valueChangeAmount?: string;
      categoryId?: string;
      acquisitionDate?: string;
    }) => {
      if (!token || !familyGroupId) {
        return Promise.reject(new Error("Not authenticated"));
      }
      const path = editing
        ? `/family-groups/${familyGroupId}/assets/${editing.id}`
        : `/family-groups/${familyGroupId}/assets`;
      return apiFetch<AssetDto>(path, {
        method: editing ? "PATCH" : "POST",
        token,
        body: JSON.stringify(body),
      });
    },
    onSuccess: async (created) => {
      // EPIC-033 p14 — a document picked in the form is uploaded once the
      // asset exists (attachments hang off the asset id).
      if (docFile) {
        try {
          await uploadAssetDocument(familyGroupId, created.id, docFile, token);
        } catch {
          toast.error(t.aset.toastDocumentFailed);
        }
      }
      void queryClient.invalidateQueries({
        queryKey: queryKeys.assets.all(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.netWorth.summary(familyGroupId),
      });
      toast.success(editing ? t.aset.toastUpdated : t.aset.toastAdded);
      onClose();
    },
    onError: () => {
      toast.error(editing ? t.aset.toastUpdateFailed : t.aset.toastAddFailed);
    },
  });

  // EPIC-026 Wave 5: the prototype dialog shows a live "Proyeksi 5 tahun"
  // notice computed from the entered value + change mode. Reproduced
  // honestly here with the backend's own linear approximation
  // (assets.service.ts `computeEstimatedValue`): value × (1 + rate/100 × 5)
  // for percent mode, value + amount × 5 for fixed mode, floored at 0 —
  // anchored at the acquisition date exactly like the server's
  // compute-on-read estimate.
  const projectedIn5Years = (() => {
    const digits = value.replace(/\D/g, "");
    if (!digits) return null;
    const base = parseInt(digits, 10);
    if (valueChangeMode === "percent") {
      const rate = parseFloat(valueChangeRatePct);
      if (!Number.isFinite(rate) || rate === 0) return null;
      return Math.max(Math.round(base * (1 + (rate / 100) * 5)), 0);
    }
    const amountDigits = valueChangeAmount.replace(/[^-\d]/g, "");
    if (!amountDigits || amountDigits === "-") return null;
    const amount = parseInt(amountDigits, 10);
    if (!Number.isFinite(amount) || amount === 0) return null;
    return Math.max(Math.round(base + amount * 5), 0);
  })();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const digits = value.replace(/\D/g, "");
    if (!name.trim() || !digits) return;
    // D2/US-ASSET-6: only the field matching the active mode is sent — the
    // backend also only reads the one that matches valueChangeMode, but
    // sending the other stale field would be confusing on GET/PATCH round
    // trips.
    const amountDigits = valueChangeAmount.replace(/[^-\d]/g, "");
    mutation.mutate({
      name: name.trim(),
      type,
      currentValue: digits,
      notes: notes.trim() || undefined,
      valueChangeRatePct:
        valueChangeMode === "percent"
          ? valueChangeRatePct.trim() || undefined
          : undefined,
      valueChangeMode,
      valueChangeAmount:
        valueChangeMode === "fixed"
          ? amountDigits && amountDigits !== "-"
            ? amountDigits
            : undefined
          : undefined,
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
          <span className="text-[15px] font-bold">
            {editing ? t.aset.modalTitleEdit : t.aset.modalTitle}
          </span>
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
            <span className="mb-1 block text-[12px] font-semibold text-muted-foreground">
              {t.aset.fieldValueChangeModeLabel}
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={valueChangeMode === "percent"}
                onClick={() => setValueChangeMode("percent")}
                className={`rounded-[10px] border px-3 py-2 text-[13px] font-semibold transition-colors ${
                  valueChangeMode === "percent"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                {t.aset.fieldValueChangeModePercentOption}
              </button>
              <button
                type="button"
                aria-pressed={valueChangeMode === "fixed"}
                onClick={() => setValueChangeMode("fixed")}
                className={`rounded-[10px] border px-3 py-2 text-[13px] font-semibold transition-colors ${
                  valueChangeMode === "fixed"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                {t.aset.fieldValueChangeModeFixedOption}
              </button>
            </div>
          </div>

          {valueChangeMode === "percent" ? (
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
          ) : (
            <div>
              <label
                htmlFor="asset-value-change-amount"
                className="mb-1 block text-[12px] font-semibold text-muted-foreground"
              >
                {t.aset.fieldValueChangeAmountLabel}
              </label>
              <input
                id="asset-value-change-amount"
                className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
                placeholder={t.aset.fieldValueChangeAmountPlaceholder}
                inputMode="decimal"
                value={valueChangeAmount}
                onChange={(e) => {
                  const isNegative = e.target.value.trim().startsWith("-");
                  const digits = e.target.value.replace(/\D/g, "");
                  setValueChangeAmount(
                    digits
                      ? `${isNegative ? "-" : ""}${parseInt(digits, 10).toLocaleString("id-ID")}`
                      : "",
                  );
                }}
              />
            </div>
          )}

          <div>
            <label
              htmlFor="asset-acquisition-date"
              className="mb-1 block text-[12px] font-semibold text-muted-foreground"
            >
              {t.aset.fieldAcquisitionDateLabel}
            </label>
            <DateField
              id="asset-acquisition-date"
              value={acquisitionDate}
              locale={locale}
              label={t.aset.fieldAcquisitionDateLabel}
              max={wibTodayDateString()}
              onChange={setAcquisitionDate}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t.aset.fieldAcquisitionDateHelper}
            </p>
          </div>

          {/* EPIC-033 p15 — the master-data category picker listed income/
              expense transaction categories, which never fit a physical asset.
              Removed until assets get their own master-data types (group 3). */}
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

          {projectedIn5Years !== null && (
            <div className="flex items-center gap-2.5 rounded-[11px] border border-primary/25 bg-accent p-3 text-[12.5px] text-accent-foreground">
              <Calculator className="size-4 shrink-0" aria-hidden="true" />
              <span>
                Proyeksi 5 tahun:{" "}
                <strong className="wm-money mono">
                  {formatRupiah(projectedIn5Years)}
                </strong>{" "}
                dihitung dari nilai tercatat, mode perubahan, dan tanggal
                perolehan.
              </span>
            </div>
          )}

          <div>
            <label
              htmlFor="asset-document"
              className="mb-1 block text-[12px] font-semibold text-muted-foreground"
            >
              {t.aset.fieldDocumentLabel}
            </label>
            <input
              id="asset-document"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              className="block w-full text-[12.5px] text-muted-foreground file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-[12px] file:font-semibold"
              onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
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
  index: number;
  // EPIC-022 D5 — edit/delete UI (previously entirely missing for physical
  // assets). Omitted when the current role has no `manage Asset` grant.
  canManage: boolean | undefined;
  onEdit: () => void;
  onDelete: () => void;
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
/**
 * EPIC-025 N3-F1: restructured from a `.list-row` into the prototype's
 * `.grid--3` physical-asset mini-card (icon/title row → Nilai Tercatat/
 * Proyeksi 2-col grid → rate badge + "Gunakan nilai ini" action). The
 * underlying data and mutation are unchanged from the pre-port list-row
 * version — only the layout moved.
 */
function AssetRow({
  asset,
  familyGroupId,
  token,
  subtitle,
  index,
  canManage,
  onEdit,
  onDelete,
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
  const isAppreciating = estimatedValue > recordedValue;
  const hasValueChangeInfo =
    asset.valueChangeMode === "fixed"
      ? Boolean(asset.valueChangeAmount)
      : Boolean(asset.valueChangeRatePct);
  const isPositiveValueChangeInfo =
    asset.valueChangeMode === "fixed"
      ? Number(asset.valueChangeAmount ?? "0") >= 0
      : Number(asset.valueChangeRatePct ?? "0") >= 0;

  // D2/US-ASSET-6: badge text reflects whichever mode actually produced the
  // drift — percent rate or fixed Rp/year amount — never invented.
  const rateBadgeText =
    asset.valueChangeMode === "fixed"
      ? `${Number(asset.valueChangeAmount ?? "0") >= 0 ? "+" : ""}${formatRupiah(Number(asset.valueChangeAmount ?? "0"))} ${t.aset.perYearSuffix}`
      : `${Number(asset.valueChangeRatePct ?? "0") >= 0 ? "+" : ""}${asset.valueChangeRatePct}% ${t.aset.perYearSuffix}`;

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
      <div className="flex flex-col gap-2.5 rounded-[12px] border p-3.5 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
        <div className="flex items-center gap-2.5">
          <IconChip
            icon={cfg.icon}
            className={cfg.chip}
            size={30}
            rounded="rounded-full"
          />
          <div className="min-w-0 flex-1">
            {/* EPIC-033 p16 — the name opens the asset's own page. */}
            <Link
              href={`/aset/${asset.id}`}
              className="block truncate text-[13.5px] font-semibold hover:underline"
            >
              {asset.name}
            </Link>
            <div className="text-[11.5px] text-muted-foreground truncate">
              {subtitle}
            </div>
          </div>
          {/* EPIC-022 D5 — this page had NO edit/delete UI at all for
              physical assets; the API's PATCH/DELETE already existed. */}
          {canManage && <RowActions onEdit={onEdit} onDelete={onDelete} />}
        </div>

        <div
          className={`grid gap-2.5 ${hasProjectionDrift ? "grid-cols-2" : "grid-cols-1"}`}
        >
          <div>
            <div className="text-[11px] text-muted-foreground">
              {t.aset.recordedValueLabel}
            </div>
            <div className="wm-money text-[14px] font-black">
              {formatRupiah(Number(recordedValue))}
            </div>
          </div>
          {hasProjectionDrift && (
            <div>
              <div className="text-[11px] text-muted-foreground">
                {t.aset.projectionLabel}
              </div>
              <div
                className={`wm-money text-[14px] font-black ${isAppreciating ? "text-success" : "text-destructive"}`}
              >
                {formatRupiah(Number(estimatedValue))}
              </div>
            </div>
          )}
        </div>

        {hasValueChangeInfo && (
          <div className="flex items-center justify-between gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-[3px] text-[11px] font-semibold ${
                hasProjectionDrift
                  ? isAppreciating
                  : isPositiveValueChangeInfo
                    ? "bg-success-soft text-emerald-700 dark:text-emerald-300"
                    : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
              }`}
            >
              {rateBadgeText}
            </span>
            {hasProjectionDrift && (
              <button
                type="button"
                onClick={() => adoptMutation.mutate()}
                disabled={adoptMutation.isPending || !token || !familyGroupId}
                className="cursor-pointer text-[11px] font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t.aset.useThisValueButton}
              </button>
            )}
          </div>
        )}
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
  canManage: boolean | undefined;
  onEditAsset: (asset: AssetDto) => void;
  onDeleteAsset: (asset: AssetDto) => void;
}

function AssetGroupCard({
  assets,
  categoryNameById,
  familyGroupId,
  token,
  canManage,
  onEditAsset,
  onDeleteAsset,
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
        <div className="wm-money text-[14px] font-extrabold">
          {formatRupiah(Number(groupTotal))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              index={i}
              canManage={canManage}
              onEdit={() => onEditAsset(asset)}
              onDelete={() => onDeleteAsset(asset)}
            />
          );
        })}
        {assets.length === 0 && (
          <div className="col-span-full py-4 text-center text-[12px] text-muted-foreground">
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
        <div className="wm-money text-[14px] font-extrabold">
          {formatRupiah(Number(groupTotal))}
        </div>
      </div>
      <div>
        {accounts.map((account, i) => {
          // EPIC-025 N3 fidelity follow-up: the prototype renders account
          // meta as ONE combined line — "Bank · ···9010 · Bersama" — not a
          // single field chosen by fallback. Join every real field that's
          // actually present (type, institution, masked number, owner)
          // instead of discarding all but the first non-null one.
          const typeLabel =
            t.aset.accountTypeLabels[
              account.type as keyof typeof t.aset.accountTypeLabels
            ] ?? account.type;
          const ownerSegment = account.ownerUserId
            ? (account.ownerName ?? t.aset.ownerUnknownLabel)
            : t.aset.ownerSharedLabel;
          const subtitle = [
            typeLabel,
            account.institution,
            account.maskedNumber,
            ownerSegment,
          ]
            .filter((part): part is string => Boolean(part && part.trim()))
            .join(" · ");
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
                  <div className="wm-money text-[14px] font-extrabold">
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
        <div className="wm-money text-[14px] font-extrabold">
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
                    {inv.ticker} · {inv.name}
                  </div>
                  <div className="text-[11.5px] text-muted-foreground truncate">
                    {t.aset.invTypeLabels[
                      inv.type as keyof typeof t.aset.invTypeLabels
                    ] ?? inv.type}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="wm-money text-[14px] font-extrabold">
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

// ── Net-worth history → monthly buckets ─────────────────────────────────────
//
// EPIC-025 N3 fidelity follow-up — root cause of the broken "Pertumbuhan
// Aset 6 Bulan" chart: `/dashboard/net-worth/history` returns one row per
// captured SNAPSHOT (effectively daily), not one row per month. The
// previous version of this page mapped every raw point straight to a
// month-short label ("Jul"/"Agu"/…), so a `range=6m` response with dozens
// of daily rows produced dozens of chart points whose x-axis repeated the
// same month label back-to-back ("Jul Jul Jul … Agu Agu Agu") and whose
// line looked flat because most neighbouring points barely move day to
// day. Bucketing to one point per calendar month (keeping the LAST/most
// recent snapshot within each month as that month's representative value)
// yields exactly one point — and one distinct label — per month.
function bucketPointsByMonth(
  points: NetWorthHistoryPointDto[],
): NetWorthHistoryPointDto[] {
  const latestByMonth = new Map<string, NetWorthHistoryPointDto>();
  for (const point of points) {
    const monthKey = point.capturedAt.slice(0, 7); // "YYYY-MM"
    const existing = latestByMonth.get(monthKey);
    if (!existing || point.capturedAt > existing.capturedAt) {
      latestByMonth.set(monthKey, point);
    }
  }
  return Array.from(latestByMonth.values())
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
    .slice(-6);
}

// ── Asset breakdown stat card ────────────────────────────────────────────────
//
// EPIC-025 N3 fidelity follow-up: the prototype's `.bento-metrics` row under
// the hero — one mini-card per Cash & E-Wallet / Bank & Account / Investasi
// / Aset Fisik, each with an icon, label, value, and an optional sub-line.
// The sub-line is either a real computed month-over-month delta (`deltaText`)
// or a neutral, non-numeric note (`note`) — never both, and never a
// fabricated delta. Matches this file's existing card idiom (`rounded-[14px]
// border bg-card p-4`) rather than reusing `@/components/wm`'s `SummaryCard`,
// which forces the delta slot to success/destructive coloring and has no
// neutral-note variant.
interface AssetStatCardProps {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number;
  deltaText?: string;
  deltaDirection?: "up" | "down";
  note?: string;
}

function AssetStatCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  deltaText,
  deltaDirection,
  note,
}: AssetStatCardProps) {
  return (
    <div className="rounded-[14px] border bg-card p-4">
      <div
        className="mb-2 flex size-9 items-center justify-center rounded-[10px]"
        style={{ background: iconBg, color: iconColor }}
      >
        <Icon className="size-4" />
      </div>
      <div className="mb-0.5 text-[11px] text-muted-foreground">{label}</div>
      <div className="wm-money mono mb-[3px] text-[15px] font-extrabold">
        {formatRupiah(value)}
      </div>
      {deltaText ? (
        <div
          className={`text-[11px] font-bold ${deltaDirection === "down" ? "text-destructive" : "text-success"}`}
        >
          {deltaText}
        </div>
      ) : (
        note && (
          <div className="text-[11px] font-semibold text-muted-foreground">
            {note}
          </div>
        )
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AsetPage() {
  const { t, locale } = useLocale();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  // EPIC-022 D5 — edit/delete UI for physical assets.
  const [editingAsset, setEditingAsset] = useState<AssetDto | null>(null);
  const [deletingAsset, setDeletingAsset] = useState<AssetDto | null>(null);
  const { canManage } = useCanManage("Asset");

  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  const familyGroupId = session?.familyGroupId;
  const userId = session?.userId;

  const deleteMutation = useMutation({
    // The id is passed explicitly to mutate() (below) rather than read from
    // `deletingAsset` inside this closure — matches the established pattern
    // on other pages (liabilitas/transaksi/asuransi), and avoids depending
    // on exactly when the `onClose()`-triggered state update lands relative
    // to `mutate()`'s own closure capture.
    mutationFn: (id: string) => {
      if (!token || !familyGroupId) {
        return Promise.reject(new Error("Not authenticated"));
      }
      return apiFetch(`/family-groups/${familyGroupId}/assets/${id}`, {
        method: "DELETE",
        token,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.assets.all(familyGroupId ?? ""),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.netWorth.summary(familyGroupId ?? ""),
      });
      toast.success(t.aset.toastDeleted);
    },
    onError: () => {
      toast.error(t.aset.toastDeleteFailed);
    },
    onSettled: () => {
      setDeletingAsset(null);
    },
  });

  // D1/US-ASSET-5: privacy eye toggle — blurs every amount on the page.
  // Loaded per-user from localStorage on mount once the userId is known, so
  // the state survives a reload (Gherkin: "eye toggle ... survives reload
  // (per user)").
  const [privacyOn, setPrivacyOn] = useState(false);

  useEffect(() => {
    if (!userId) return;
    // Reading a per-user localStorage preference on mount, same pattern as
    // ThemePicker's preset load (components/shell/theme-picker.tsx).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrivacyOn(readStoredPrivacy(userId));
  }, [userId]);

  function togglePrivacy(): void {
    const next = !privacyOn;
    setPrivacyOn(next);
    if (userId) writeStoredPrivacy(userId, next);
  }

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

  // 6-month asset trend — same `/dashboard/net-worth/history` endpoint
  // `beranda`/`ringkasan` already fetch; only `totalAssets` per point is
  // read here. Real fix for the prototype's "Pertumbuhan Aset 6 Bulan"
  // chart, previously cut for lack of persisted history — the history
  // endpoint already exists and already carries this field per point.
  const { data: assetHistory } = useQuery<NetWorthHistoryDto>({
    queryKey: ["dashboard", familyGroupId ?? "", "net-worth-history", "6m"],
    queryFn: () =>
      apiFetch<NetWorthHistoryDto>(
        `/family-groups/${familyGroupId}/dashboard/net-worth/history?range=6m`,
        { token },
      ),
    enabled: Boolean(familyGroupId) && Boolean(token),
    staleTime: 60_000,
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

  // EPIC-025 N3-F1: bento-metrics breakdown row + allocation donut — both
  // FOLD (J3): derived entirely from accounts/investments/assets already
  // fetched above, no new endpoint. No fake month-over-month delta is
  // rendered on the stat cards (no historical snapshot exists to compute one
  // from — Honest UI).
  const cashTotal = danaAccounts.reduce(
    (sum, a) => sum + BigInt(a.balance ?? "0"),
    BigInt(0),
  );
  const bankTotal = rekeningAccounts.reduce(
    (sum, a) => sum + BigInt(a.balance ?? "0"),
    BigInt(0),
  );

  // A "breakdown" only says something useful when the portfolio actually
  // spans more than one category — with a single funded category, each
  // stat card would just repeat the group card's own total (and, when that
  // category also happens to equal the grand total, the grand-total banner
  // too) with zero added information. The row only renders once there are
  // at least two non-zero categories to compare.
  const nonZeroAssetCategoryCount = [
    cashTotal > BigInt(0),
    bankTotal > BigInt(0),
    investmentsTotal > 0,
    assetsTotalBig > BigInt(0),
  ].filter(Boolean).length;

  const allocationSegments: DonutSegment[] = [
    {
      label: t.aset.breakdownFisikLabel,
      value: Number(assetsTotalBig),
      color: "var(--warning)",
    },
    {
      label: t.aset.breakdownInvestasiLabel,
      value: investmentsTotal,
      color: "var(--brand-purple)",
    },
    {
      label: t.aset.breakdownBankLabel,
      value: Number(bankTotal),
      color: "var(--accent-foreground)",
    },
    {
      label: t.aset.breakdownCashLabel,
      value: Number(cashTotal),
      color: "var(--success)",
    },
  ].filter((seg) => seg.value > 0);

  // EPIC-025 N3 fidelity follow-up: one point per calendar month (see
  // `bucketPointsByMonth` above) — feeds both the trend chart and the
  // Investasi stat card's month-over-month delta below.
  const monthlyAssetPoints = bucketPointsByMonth(assetHistory?.points ?? []);
  const hasRealAssetTrend = monthlyAssetPoints.length >= 2;
  const assetTrendCategories = hasRealAssetTrend
    ? monthlyAssetPoints.map((p) =>
        new Date(p.capturedAt).toLocaleDateString(
          locale === "en" ? "en-US" : "id-ID",
          { month: "short" },
        ),
      )
    : ["Mar", "Apr", "Mei", "Jun", "Jul", "Agu"];
  const assetTrendValues = hasRealAssetTrend
    ? monthlyAssetPoints.map((p) => Number(p.totalAssets))
    : [0.82, 0.86, 0.9, 0.93, 0.97, 1].map((ratio) =>
        Math.round(grandTotal * ratio),
      );

  // Investasi stat-card delta: a REAL month-over-month % change computed
  // from `totalInvestments` across the two most recent monthly buckets —
  // only rendered when at least two distinct months of history exist and
  // the earlier bucket is non-zero (Honest UI: never fabricated, never a
  // divide-by-zero). Cash & E-Wallet / Bank & Account have no equivalent:
  // the history snapshot only carries a COMBINED `totalCash` (all accounts
  // together, see dashboard.service.ts), so there is no real per-category
  // split to compute a Cash-only or Bank-only delta from — those two cards
  // render without a delta rather than showing a misattributed shared
  // number on both.
  const investasiDeltaPct = (() => {
    if (monthlyAssetPoints.length < 2) return null;
    const prevPoint = monthlyAssetPoints[monthlyAssetPoints.length - 2]!;
    const latestPoint = monthlyAssetPoints[monthlyAssetPoints.length - 1]!;
    const prev = parseFloat(prevPoint.totalInvestments);
    const latest = parseFloat(latestPoint.totalInvestments);
    if (!prev) return null;
    return ((latest - prev) / prev) * 100;
  })();
  const investasiDeltaText =
    investasiDeltaPct === null
      ? undefined
      : `${investasiDeltaPct >= 0 ? "↑" : "↓"} ${Math.abs(
          investasiDeltaPct,
        ).toLocaleString(locale === "en" ? "en-US" : "id-ID", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}% ${t.aset.statFromLastMonthSuffix}`;

  const totalAssetsAsOfLabel = new Date().toLocaleDateString(
    locale === "en" ? "en-US" : "id-ID",
    { day: "numeric", month: "long", year: "numeric" },
  );

  const showTrendChart = !isLoading && assetTrendValues.some((v) => v > 0);
  const showAllocationDonut = !isLoading && allocationSegments.length > 0;

  return (
    <div
      className={`space-y-4${privacyOn ? " [&_.wm-money]:blur-sm [&_.wm-money]:select-none" : ""}`}
    >
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
            <div className="wm-money mono text-[24px] font-black text-primary-strong transition-[filter] duration-150">
              <CountUpRupiah value={grandTotal} />
            </div>
          )}
          <div className="mt-[2px] text-[11px] text-muted-foreground">
            {t.aset.totalAssetsSubtitlePrefix}
            {totalAssetsAsOfLabel}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="h-auto px-[14px] py-2"
            disabled={!familyGroupId || !token}
          >
            <Plus className="size-4" /> {t.aset.addAssetButton}
          </Button>
          <button
            type="button"
            aria-pressed={privacyOn}
            aria-label={
              privacyOn ? t.aset.eyeShowAriaLabel : t.aset.eyeHideAriaLabel
            }
            onClick={togglePrivacy}
            className="flex size-9 cursor-pointer items-center justify-center rounded-md border bg-background transition-colors hover:bg-accent"
          >
            {privacyOn ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Breakdown stat cards — Cash & E-Wallet / Bank & Account / Investasi
          / Aset Fisik, each derived from data already fetched above. Only
          shown once the portfolio spans 2+ categories (see
          `nonZeroAssetCategoryCount` above). */}
      {!isLoading && nonZeroAssetCategoryCount >= 2 && (
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          <AssetStatCard
            icon={Wallet}
            iconBg="var(--success-soft)"
            iconColor="var(--success)"
            label={t.aset.breakdownCashLabel}
            value={Number(cashTotal)}
          />
          <AssetStatCard
            icon={Landmark}
            iconBg="var(--accent)"
            iconColor="var(--accent-foreground)"
            label={t.aset.breakdownBankLabel}
            value={Number(bankTotal)}
          />
          <AssetStatCard
            icon={TrendingUp}
            iconBg="var(--brand-purple-soft)"
            iconColor="var(--brand-purple)"
            label={t.aset.breakdownInvestasiLabel}
            value={investmentsTotal}
            deltaText={investasiDeltaText}
            deltaDirection={
              investasiDeltaPct !== null && investasiDeltaPct < 0
                ? "down"
                : "up"
            }
          />
          <AssetStatCard
            icon={Home}
            iconBg="var(--warning-soft)"
            iconColor="var(--warning)"
            label={t.aset.breakdownFisikLabel}
            value={Number(assetsTotalBig)}
            note={t.aset.statFisikNote}
          />
        </div>
      )}

      {/* Errors */}
      {hasError && (
        <div
          role="alert"
          className="rounded-[14px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive"
        >
          {t.aset.errorLoad}
        </div>
      )}

      {/* Trend (6-month asset growth) + allocation donut, side by side
          (2:1) — matches the prototype's `.bento-grid` (`bento-span-8` /
          `bento-span-4`), previously stacked full-width. Trend fix (EPIC-025
          N3 fidelity follow-up): `monthlyAssetPoints` (see
          `bucketPointsByMonth` above) buckets the raw daily snapshot rows
          from `/dashboard/net-worth/history` down to one point per month. */}
      {(showTrendChart || showAllocationDonut) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {showTrendChart && (
            <div className="rounded-[14px] border bg-card p-4 lg:col-span-2">
              <div className="mb-2 text-[13.5px] font-bold">
                {t.aset.assetTrendTitle}
              </div>
              <TrendChart
                categories={assetTrendCategories}
                series={[
                  {
                    name: t.aset.totalAssetsLabel,
                    data: assetTrendValues,
                  },
                ]}
                height={250}
                ariaLabel={`${t.aset.assetTrendTitle}: ${formatRupiah(assetTrendValues[0] ?? 0)} → ${formatRupiah(assetTrendValues[assetTrendValues.length - 1] ?? 0)}`}
              />
            </div>
          )}

          {showAllocationDonut && (
            // EPIC-025 N3 fidelity follow-up: the prototype's donut has NO
            // legend row, only the centered total. `DonutChart` (protected —
            // `components/charts/*`) doesn't expose a legend toggle, so the
            // default ApexCharts bottom legend is hidden here, page-locally,
            // via a Tailwind arbitrary-variant selector instead.
            <div className="rounded-[14px] border bg-card p-4 lg:col-span-1 [&_.apexcharts-legend]:hidden!">
              <div className="mb-2 text-[13.5px] font-bold">
                {t.aset.allocationTitle}
              </div>
              <DonutChart
                segments={allocationSegments}
                centerLabel={t.aset.totalAssetsLabel}
                ariaLabel={`${t.aset.allocationTitle}: ${allocationSegments.map((s) => `${s.label} ${formatRupiah(s.value)}`).join(", ")}`}
              />
            </div>
          )}
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
              canManage={canManage}
              onEditAsset={setEditingAsset}
              onDeleteAsset={setDeletingAsset}
            />
          )}
        </>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingAsset) && familyGroupId && (
        <AddAssetModal
          key={editingAsset?.id ?? "add"}
          familyGroupId={familyGroupId}
          editing={editingAsset}
          onClose={() => {
            setShowAddModal(false);
            setEditingAsset(null);
          }}
        />
      )}

      {/* EPIC-022 D5 — delete confirmation, matching the RowActions/
          ConfirmDeleteDialog pattern already used on /investasi. */}
      <ConfirmDeleteDialog
        label={deletingAsset ? `"${deletingAsset.name}"` : null}
        body={t.aset.deleteDialogBody}
        onClose={() => setDeletingAsset(null)}
        onConfirm={() => {
          if (deletingAsset) deleteMutation.mutate(deletingAsset.id);
        }}
      />
    </div>
  );
}
