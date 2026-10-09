"use client";

import { useEffect, useState } from "react";
import "./aset.css";
import Link from "next/link";
import {
  ArrowUpRight,
  Calculator,
  Eye,
  EyeOff,
  Plus,
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
  X,
} from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useLocale } from "@/hooks/use-locale";
import { useCanManage } from "@/hooks/use-role-permissions";
import { apiFetch } from "@/lib/api-client";
import { useMoney } from "@/hooks/use-money";
import { uploadAssetDocument } from "@/lib/asset-attachments";
import { queryKeys } from "@/lib/query-keys";
import { assetGroupColor } from "@/lib/viz-colors";
import { DELTA_ARROW, deltaDirection } from "@/lib/delta";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
  PanelContent,
} from "@/components/ui/dialog";
import {
  AddTile,
  BentoCard,
  BentoGrid,
  BentoHero,
  BentoTile,
  BentoTiles,
  CompositionStack,
  type CompositionItem,
  DateField,
  GhostButton,
  HeroKpi,
  MiniList,
  MiniRow,
  PillButton,
  SeeAll,
  TipsCard,
} from "@/components/wm";
import { HatchedBarChart } from "@/components/charts/bento-charts";
import { cn } from "@/lib/utils";
import { RowActions, ConfirmDeleteDialog } from "@/components/crud";

import {
  assetTypeToAssetClass,
  DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT,
} from "@wealthme/contracts";
import {
  MoneyInput,
  anyMoneyPending,
  moneyDigits,
  useMoneyField,
  withFxInputs,
} from "@/components/money";

import type {
  AssetDto,
  AccountDto,
  InvestmentDto,
  CategoryDto,
  AssetTypeId,
  AssetValueChangeMode,
  FxInput,
  NetWorthHistoryDto,
  NetWorthHistoryPointDto,
} from "@wealthme/contracts";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  const money = useMoney();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  const [name, setName] = useState(editing?.name ?? "");
  const [type, setType] = useState<AssetTypeId>(
    (editing?.type as AssetTypeId) ?? "properti",
  );
  const valueField = useMoneyField({
    initialRaw: editing ? BigInt(editing.currentValue).toString() : "",
    isEdit: !!editing,
  });
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [valueChangeRatePct, setValueChangeRatePct] = useState(
    editing?.valueChangeRatePct ?? "",
  );
  // D2/US-ASSET-6: mode toggle — "percent" reuses the rate field above,
  // "fixed" swaps in a signed Rp/year amount field instead.
  const [valueChangeMode, setValueChangeMode] = useState<AssetValueChangeMode>(
    editing?.valueChangeMode ?? "percent",
  );
  const changeField = useMoneyField({
    initialRaw: editing?.valueChangeAmount
      ? BigInt(editing.valueChangeAmount).toString()
      : "",
    isEdit: !!editing,
    allowNegative: true,
  });
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
      fxInputs?: FxInput[];
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
    const digits = moneyDigits(valueField);
    if (!digits) return null;
    const base = parseInt(digits, 10);
    if (valueChangeMode === "percent") {
      const rate = parseFloat(valueChangeRatePct);
      if (!Number.isFinite(rate) || rate === 0) return null;
      return Math.max(Math.round(base * (1 + (rate / 100) * 5)), 0);
    }
    const amountDigits = moneyDigits(changeField);
    if (!amountDigits || amountDigits === "-") return null;
    const amount = parseInt(amountDigits, 10);
    if (!Number.isFinite(amount) || amount === 0) return null;
    return Math.max(Math.round(base + amount * 5), 0);
  })();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (anyMoneyPending(valueField, changeField)) {
      toast.error(t.money.rateNotReady);
      return;
    }
    const digits = moneyDigits(valueField);
    if (!name.trim() || !digits) return;
    // D2/US-ASSET-6: only the field matching the active mode is sent — the
    // backend also only reads the one that matches valueChangeMode, but
    // sending the other stale field would be confusing on GET/PATCH round
    // trips.
    const amountDigits = moneyDigits(changeField);
    mutation.mutate(
      withFxInputs(
        {
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
        },
        [
          ["currentValue", valueField],
          ...(valueChangeMode === "fixed"
            ? ([["valueChangeAmount", changeField]] as const)
            : []),
        ],
      ),
    );
  }

  return (
    // polish-j batch 6 item 1 — was a hand-rolled `fixed inset-0 ... bg-black/40`
    // overlay with bespoke label/input classes and no Batal button; now
    // rendered through the shared Base UI Dialog like every other add/edit
    // dialog in the app (see Asuransi's local dialog for the same pattern).
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <PanelContent variant="side" className="wm-form-panel">
        <header className="wm-panel-head">
          <div className="min-w-0">
            <DialogTitle className="wm-panel-title">
              {editing ? t.aset.modalTitleEdit : t.aset.modalTitle}
            </DialogTitle>
          </div>
          <DialogClose className="wm-panel-x" aria-label={t.common.close}>
            <X aria-hidden="true" />
          </DialogClose>
        </header>
        <form
          onSubmit={handleSubmit}
          id="asset-form"
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="wm-panel-body wm-form">
            <div className="wm-form__grid">
              <div className="field mt-0">
                <label className="label" htmlFor="asset-name">
                  {t.aset.fieldNameLabel}
                </label>
                <input
                  id="asset-name"
                  className="input"
                  placeholder={t.aset.fieldNamePlaceholder}
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label className="label" htmlFor="asset-type">
                  {t.aset.fieldCategoryLabel}
                </label>
                <select
                  id="asset-type"
                  className="select"
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

              <div className="field">
                <label className="label" htmlFor="asset-value">
                  {t.aset.fieldValueLabel}
                </label>
                <MoneyInput
                  field={valueField}
                  id="asset-value"
                  placeholder={t.aset.fieldValuePlaceholder}
                />
              </div>

              {/* Same shared segmented-control markup as Splitbill's
                "Bagi Rata"/"Custom per Orang" toggle, not a bespoke
                2-button block. */}
              <div className="field">
                <span className="label">
                  {t.aset.fieldValueChangeModeLabel}
                </span>
                <div
                  className="segmented w-full"
                  role="tablist"
                  aria-label={t.aset.fieldValueChangeModeLabel}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={valueChangeMode === "percent"}
                    onClick={() => setValueChangeMode("percent")}
                    className="segmented__item flex-1"
                  >
                    {t.aset.fieldValueChangeModePercentOption}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={valueChangeMode === "fixed"}
                    onClick={() => setValueChangeMode("fixed")}
                    className="segmented__item flex-1"
                  >
                    {t.aset.fieldValueChangeModeFixedOption}
                  </button>
                </div>
              </div>

              {valueChangeMode === "percent" ? (
                <div className="field">
                  <label className="label" htmlFor="asset-rate">
                    {t.aset.fieldValueChangeRateLabel}
                  </label>
                  <input
                    id="asset-rate"
                    type="number"
                    className="input"
                    placeholder={t.aset.fieldValueChangeRatePlaceholder}
                    inputMode="decimal"
                    step="0.01"
                    min={-100}
                    max={100}
                    value={valueChangeRatePct}
                    onChange={(e) => setValueChangeRatePct(e.target.value)}
                  />
                  <span className="hint">
                    {t.aset.defaultRateHelperPrefix}:{" "}
                    {DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT[type]}%
                  </span>
                </div>
              ) : (
                <div className="field">
                  <label className="label" htmlFor="asset-value-change-amount">
                    {t.aset.fieldValueChangeAmountLabel}
                  </label>
                  <MoneyInput
                    field={changeField}
                    id="asset-value-change-amount"
                    placeholder={t.aset.fieldValueChangeAmountPlaceholder}
                  />
                </div>
              )}

              <div className="field">
                <label className="label" htmlFor="asset-acquisition-date">
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
                <span className="hint">
                  {t.aset.fieldAcquisitionDateHelper}
                </span>
              </div>

              {/* EPIC-033 p15 — the master-data category picker listed income/
                expense transaction categories, which never fit a physical asset.
                Removed until assets get their own master-data types (group 3). */}
              <div className="field">
                <label className="label" htmlFor="asset-notes">
                  {t.aset.fieldNotesLabel}
                </label>
                <input
                  id="asset-notes"
                  className="input"
                  placeholder={t.aset.fieldNotesPlaceholder}
                  maxLength={500}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {projectedIn5Years !== null && (
                <div className="mt-3.5 flex items-center gap-2.5 rounded-[11px] border border-primary/25 bg-accent p-3 text-[12.5px] text-accent-foreground">
                  <Calculator className="size-4 shrink-0" aria-hidden="true" />
                  <span>
                    Proyeksi 5 tahun:{" "}
                    <strong className="wm-money mono">
                      {money.format(projectedIn5Years)}
                    </strong>{" "}
                    dihitung dari nilai tercatat, mode perubahan, dan tanggal
                    perolehan.
                  </span>
                </div>
              )}

              <div className="field">
                <label className="label" htmlFor="asset-document">
                  {t.aset.fieldDocumentLabel}
                </label>
                <input
                  id="asset-document"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  className="input file:mr-3 file:h-full file:border-0 file:border-r file:bg-transparent file:px-3 file:text-[12.5px] file:font-semibold file:text-foreground"
                  onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
          </div>
          <div className="wm-panel-foot">
            <PillButton type="button" onClick={onClose}>
              {t.common.cancel}
            </PillButton>
            <PillButton
              type="submit"
              variant="primary"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? t.aset.saving : t.aset.saveButton}
            </PillButton>
          </div>
        </form>
      </PanelContent>
    </Dialog>
  );
}

// ── Physical Asset Row ─────────────────────────────────────────────────────────

interface AssetRowProps {
  asset: AssetDto;
  familyGroupId: string;
  token: string | undefined;
  subtitle: string;
  // EPIC-022 D5 — edit/delete UI (previously entirely missing for physical
  // assets). Omitted when the current role has no `manage Asset` grant.
  canManage: boolean | undefined;
  onEdit: () => void;
  onDelete: () => void;
}

const TIPS_MOSAIC = [
  "a",
  "a",
  "a",
  "b",
  "b",
  "c",
  "a",
  "a",
  "b",
  "b",
  "c",
  "c",
  "a",
  "b",
  "b",
  "c",
  "c",
  "o",
] as const;

/** One physical-asset tile: body edits, corner icon opens the detail page, adopt is its own control. */
function AssetTile({
  asset,
  familyGroupId,
  token,
  subtitle,
  canManage,
  onEdit,
  onDelete,
}: AssetRowProps) {
  const { t } = useLocale();
  const money = useMoney();
  const queryClient = useQueryClient();

  const Icon = (ASSET_TYPE_ICON[asset.type] ?? { icon: Package }).icon;
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

  // D2/US-ASSET-6: badge text reflects whichever mode actually produced the
  // drift — percent rate or fixed Rp/year amount — never invented.
  const rateBadgeText =
    asset.valueChangeMode === "fixed"
      ? `${Number(asset.valueChangeAmount ?? "0") >= 0 ? "+" : ""}${money.format(Number(asset.valueChangeAmount ?? "0"))} ${t.aset.perYearSuffix}`
      : `${Number(asset.valueChangeRatePct ?? "0") >= 0 ? "+" : ""}${asset.valueChangeRatePct}% ${t.aset.perYearSuffix}`;

  const adoptMutation = useMutation({
    mutationFn: () => {
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

  const shownValue = hasProjectionDrift ? estimatedValue : recordedValue;
  const tone = hasProjectionDrift
    ? isAppreciating
      ? "is-up"
      : "is-down"
    : undefined;

  return (
    <div className="as-tilewrap">
      <BentoTile
        onClick={canManage ? onEdit : undefined}
        icon={<Icon aria-hidden="true" />}
        title={asset.name}
        value={
          <span className={cn("wm-money", tone)}>
            {money.format(Number(shownValue))}
          </span>
        }
        foot={`${hasValueChangeInfo ? `${rateBadgeText} · ` : ""}${subtitle}`}
      >
        {hasProjectionDrift && (
          <small className="as-proj">
            {t.aset.projectionLabel} · {t.aset.recordedValueLabel}{" "}
            <span className="wm-money">
              {money.format(Number(recordedValue))}
            </span>
          </small>
        )}
      </BentoTile>
      <div className="as-tools">
        <Link
          href={`/aset/${asset.id}`}
          className="as-detail"
          aria-label={asset.name}
        >
          <ArrowUpRight aria-hidden="true" />
        </Link>
        {canManage && <RowActions onEdit={onEdit} onDelete={onDelete} />}
      </div>
      {hasProjectionDrift && hasValueChangeInfo && (
        <button
          type="button"
          className="as-adopt"
          onClick={() => adoptMutation.mutate()}
          disabled={adoptMutation.isPending || !token || !familyGroupId}
        >
          {t.aset.useThisValueButton}
        </button>
      )}
    </div>
  );
}

function assetSubtitle(
  asset: AssetDto,
  categoryNameById: Record<string, string>,
  label: (cls: ReturnType<typeof assetTypeToAssetClass>) => string,
): string {
  // B7: type-derived fallback uses the shared asset-class taxonomy; a master
  // data category or notes still win.
  return asset.notes
    ? asset.notes
    : (asset.categoryId && categoryNameById[asset.categoryId]) ||
        label(assetTypeToAssetClass(asset.type));
}

function accountSubtitle(
  account: AccountDto,
  t: ReturnType<typeof useLocale>["t"],
): string {
  const typeLabel =
    t.aset.accountTypeLabels[
      account.type as keyof typeof t.aset.accountTypeLabels
    ] ?? account.type;
  const ownerSegment = account.ownerUserId
    ? (account.ownerName ?? t.aset.ownerUnknownLabel)
    : t.aset.ownerSharedLabel;
  return [typeLabel, account.institution, account.maskedNumber, ownerSegment]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" · ");
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AsetPage() {
  const { t, locale } = useLocale();
  const money = useMoney();
  const queryClient = useQueryClient();
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
  // fractional — BigInt() throws on that, so sum it as a float instead.
  // A holding with no usable price yet (currentValue null) counts at cost
  // basis × quantity — the same basis as the API net-worth rollup and the
  // Investasi summary, so /aset, /investasi, /ringkasan and Beranda agree.
  const investmentsTotal = (investments ?? []).reduce(
    (sum, inv) =>
      sum +
      (inv.currentValue != null
        ? parseFloat(inv.currentValue)
        : parseFloat(inv.costBasisPerUnit ?? "0") *
          parseFloat(inv.quantity ?? "0")),
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
  const isPageError = assetsError || accountsError || investmentsError;

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

  // EPIC-025 N3 fidelity follow-up: one point per calendar month (see
  // `bucketPointsByMonth` above) — feeds both the trend chart and the
  // Investasi stat card's month-over-month delta below.
  const monthlyAssetPoints = bucketPointsByMonth(assetHistory?.points ?? []);
  const hasRealAssetTrend = monthlyAssetPoints.length >= 2;
  const assetTrendCategories = monthlyAssetPoints.map((p) =>
    new Date(p.capturedAt).toLocaleDateString(
      locale === "en" ? "en-US" : "id-ID",
      { month: "short" },
    ),
  );
  const assetTrendValues = monthlyAssetPoints.map((p) => Number(p.totalAssets));

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
      : `${DELTA_ARROW[deltaDirection(investasiDeltaPct, 1)]} ${Math.abs(
          investasiDeltaPct,
        ).toLocaleString(locale === "en" ? "en-US" : "id-ID", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}% ${t.aset.statFromLastMonthSuffix}`;

  const totalAssetsAsOfLabel = new Date().toLocaleDateString(
    locale === "en" ? "en-US" : "id-ID",
    { day: "numeric", month: "long", year: "numeric" },
  );

  const compItems: CompositionItem[] = [
    {
      label: t.aset.breakdownFisikLabel,
      value: Number(assetsTotalBig),
      color: assetGroupColor("physical"),
    },
    {
      label: t.aset.breakdownInvestasiLabel,
      value: investmentsTotal,
      color: assetGroupColor("investment"),
    },
    {
      label: t.aset.breakdownBankLabel,
      value: Number(bankTotal),
      color: assetGroupColor("bank"),
    },
    {
      label: t.aset.breakdownCashLabel,
      value: Number(cashTotal),
      color: assetGroupColor("cash"),
    },
  ].filter((item) => item.value > 0);

  const heroCaption = `${t.aset.totalAssetsSubtitlePrefix}${totalAssetsAsOfLabel}`;

  return (
    <div data-page="aset" className={cn("as-page", privacyOn && "as-priv")}>
      <BentoGrid className="as-grid">
        <BentoHero
          className="as-hero"
          currency={null}
          value={isPageError ? "—" : isLoading ? "…" : money.format(grandTotal)}
          caption={isPageError ? undefined : isLoading ? "…" : heroCaption}
          controls={
            <>
              <GhostButton
                aria-pressed={privacyOn}
                aria-label={
                  privacyOn ? t.aset.eyeShowAriaLabel : t.aset.eyeHideAriaLabel
                }
                onClick={togglePrivacy}
              >
                {privacyOn ? (
                  <EyeOff aria-hidden="true" />
                ) : (
                  <Eye aria-hidden="true" />
                )}{" "}
                {privacyOn ? t.aset.v2.eyeShow : t.aset.v2.eyeHide}
              </GhostButton>
              <GhostButton
                lit
                disabled={!familyGroupId || !token}
                onClick={() => setShowAddModal(true)}
              >
                <Plus aria-hidden="true" /> {t.aset.addAssetButton}
              </GhostButton>
            </>
          }
          chart={
            <div className="as-plot">
              {/* proto `aset.html` hero chart is always the Aset fisik/
                  Investasi/Rekening/Dana composition bar + breakdown rows
                  (never a month-over-month trend) — CompositionStack is the
                  primary view here. The real 6-month trend this page
                  already computes is kept, not deleted, as a fallback for
                  the (rare) case there's no composition data to show yet. */}
              {isLoading ? null : compItems.length > 0 ? (
                <CompositionStack
                  items={compItems}
                  center={money.format(grandTotal)}
                  sub={t.aset.v2.compAria}
                  label={t.aset.v2.compAria}
                  format={money.format}
                />
              ) : (
                hasRealAssetTrend && (
                  <HatchedBarChart
                    labels={assetTrendCategories}
                    series={[
                      {
                        name: t.aset.v2.trendLegend,
                        data: assetTrendValues,
                        // Single-series HatchedBarChart renders through
                        // Arc's BarChart, which uses its own --accent token
                        // (forest, see arc-bridge.module.css) — per-series
                        // color here has no effect, kept only for the
                        // BarSeries type's required field.
                        color: "var(--viz-1)",
                      },
                    ]}
                    format={money.formatCompact}
                    formatFull={money.format}
                    wide
                    ariaLabel={t.aset.v2.trendAria}
                  />
                )
              )}
            </div>
          }
          kpis={
            <>
              <HeroKpi
                label={t.aset.v2.kpiAcc}
                value={money.format(Number(accountsTotalBig))}
              />
              <HeroKpi
                label={t.aset.v2.kpiInv}
                value={money.format(investmentsTotal)}
                delta={
                  investasiDeltaText ? (
                    <span className="wm-cap">{investasiDeltaText}</span>
                  ) : undefined
                }
              />
              <HeroKpi
                label={t.aset.v2.kpiFisik}
                value={money.format(Number(assetsTotalBig))}
              />
            </>
          }
        />

        <BentoCard
          className="as-side"
          title={t.aset.investmentsTitle}
          caption={`${(investments ?? []).length} ${t.aset.v2.instrumentSuffix}`}
        >
          {isLoading ? (
            <AssetCardSkeleton />
          ) : (investments ?? []).length === 0 ? (
            <p className="as-empty">{t.aset.emptyInvestments}</p>
          ) : (
            <MiniList label={t.aset.investmentsTitle}>
              {(investments ?? []).slice(0, 5).map((inv) => {
                const Icon = (INV_TYPE_ICON[inv.type] ?? { icon: Package })
                  .icon;
                return (
                  <MiniRow
                    key={inv.id}
                    icon={<Icon aria-hidden="true" />}
                    title={`${inv.ticker} · ${inv.name}`}
                    meta={
                      t.aset.invTypeLabels[
                        inv.type as keyof typeof t.aset.invTypeLabels
                      ] ?? inv.type
                    }
                    amount={
                      <span className="wm-money">
                        {money.format(parseFloat(inv.currentValue ?? "0"))}
                      </span>
                    }
                  />
                );
              })}
            </MiniList>
          )}
          <SeeAll href="/investasi">{t.aset.v2.invSeeAll}</SeeAll>
        </BentoCard>

        <BentoCard
          className="as-accounts"
          title={t.aset.v2.accTitle}
          caption={`${allAccounts.length} ${t.aset.v2.accountSuffix}`}
        >
          {isLoading ? (
            <AssetCardSkeleton />
          ) : allAccounts.length === 0 ? (
            <p className="as-empty">{t.aset.emptyDanaRekening}</p>
          ) : (
            <MiniList label={t.aset.v2.accTitle}>
              {allAccounts.slice(0, 5).map((account) => {
                const Icon = (
                  ACCOUNT_TYPE_ICON[account.type] ?? { icon: Wallet }
                ).icon;
                return (
                  <MiniRow
                    key={account.id}
                    icon={<Icon aria-hidden="true" />}
                    title={account.name}
                    meta={accountSubtitle(account, t)}
                    amount={
                      <span className="wm-money">
                        {money.format(Number(BigInt(account.balance ?? "0")))}
                      </span>
                    }
                  />
                );
              })}
            </MiniList>
          )}
          {rekeningAccounts.length > 0 && (
            <SeeAll href="/rekening">{t.aset.v2.accSeeAllRekening}</SeeAll>
          )}
          {danaAccounts.length > 0 && (
            <SeeAll href="/dana">{t.aset.v2.accSeeAllDana}</SeeAll>
          )}
        </BentoCard>

        <TipsCard
          className="as-tips"
          title={t.aset.v2.tipTitle}
          mosaic={TIPS_MOSAIC}
        >
          {t.aset.v2.tipBody}
        </TipsCard>

        <BentoCard
          className="as-fisik"
          title={t.aset.physicalAssetsTitle}
          caption={`${(assets ?? []).length > 0 ? `${(assets ?? []).length} · ` : ""}${t.aset.v2.fisikCaption}`}
        >
          {hasError && (
            <p role="alert" className="as-error">
              {t.aset.errorLoad}
            </p>
          )}
          {isLoading ? (
            <AssetCardSkeleton />
          ) : (
            <BentoTiles>
              {(assets ?? []).map((asset) => (
                <AssetTile
                  key={asset.id}
                  asset={asset}
                  familyGroupId={familyGroupId ?? ""}
                  token={token}
                  subtitle={assetSubtitle(
                    asset,
                    categoryNameById,
                    (cls) => t.common.assetClassLabels[cls],
                  )}
                  canManage={canManage}
                  onEdit={() => setEditingAsset(asset)}
                  onDelete={() => setDeletingAsset(asset)}
                />
              ))}
              {(assets ?? []).length === 0 && (
                <p className="as-empty">{t.aset.emptyPhysical}</p>
              )}
              {canManage && (
                <AddTile onClick={() => setShowAddModal(true)}>
                  <Plus aria-hidden="true" />
                  {t.aset.v2.fisikNew}
                </AddTile>
              )}
            </BentoTiles>
          )}
        </BentoCard>
      </BentoGrid>

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
