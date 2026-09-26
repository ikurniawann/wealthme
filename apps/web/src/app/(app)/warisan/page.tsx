"use client";

import { useState } from "react";
import { CircleAlert, PieChart, Plus, Save, X } from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HeroCard,
  SectionCard,
  StatusBadge,
  ProgressBar,
} from "@/components/wm";
import { ConfirmDeleteDialog, RowActions } from "@/components/crud";
import {
  MoneyInput,
  useMoneyField,
  moneyDigits,
  withFxInputs,
} from "@/components/money";
// EPIC-025 N3-E3 — J3 FOLD: beneficiary-allocation donut, derived from the
// already-fetched inheritance-assets list — no new backend endpoint.
import { DonutChart } from "@/components/charts/apex-presets";
import type { DonutSegment } from "@/components/charts/donut";
import { useLocale } from "@/hooks/use-locale";
import type { ApiError } from "@/lib/api-client";
import { apiFetch } from "@/lib/api-client";
import { formatRupiah } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

import type {
  AssetDto,
  CreateHeirDto,
  CreateInheritanceAssetDto,
  InheritanceAssetDto,
  InheritanceVisibility,
  MemberRelationship,
  UpdateInheritanceAssetDto,
} from "@wealthme/contracts";

// NOTE: these are the actual `assetType` values persisted on an inheritance
// asset record (free-text category), not a translated enum — kept in
// Indonesian in both locales so switching language never changes what gets
// stored, matching the value-locked crud-config select option convention.
const ASSET_TYPE_OPTIONS = [
  "Aset / Properti",
  "Cash / Tunai",
  "Surat Berharga",
  "Saham",
  "Emas",
  "Lainnya",
];

const ASSET_TYPE_ICON: Record<string, string> = {
  "Aset / Properti": "🏠",
  "Cash / Tunai": "💵",
  "Surat Berharga": "📜",
  Saham: "📈",
  Emas: "🪙",
  Lainnya: "📋",
};

const ASSET_TYPE_BG: Record<string, string> = {
  "Aset / Properti": "#FEF9C3",
  "Cash / Tunai": "#DCFCE7",
  "Surat Berharga": "#DBEAFE",
  Saham: "#EDE9FE",
  Emas: "#FEF3C7",
  Lainnya: "#F3F4F6",
};

// EPIC-024 Group H (item 15) — mirrors /rekening, /akun, /dana's helper: the
// API's `CreateHeirDto.relationship` @IsNotEmpty() 400 carries an actionable
// message, but the mutation handlers below threw it away behind a generic
// toast. Prefer the server's message and fall back only when there isn't one.
//
// Review fix (attempt 2, HIGH) — NestJS's ValidationPipe can return `message`
// as a string ARRAY when multiple fields fail validation at once. The prior
// version did `String((err as {message: unknown}).message)` unconditionally,
// which on an array joins entries with commas — leaking raw, unlocalized
// backend validation strings straight into the toast. Only trust `message`
// when it is actually a string; anything else (array, object, etc.) falls
// back to the caller's localized message.
function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

// EPIC-021 Group D (#14) — mirrors the `FamilyMember` shape used on /akun for
// the optional "link a heir to a family member" picker. EPIC-023 F1 (D14)
// added `relationship` so selecting a member can live-fill it too — the
// API's response DTO already carries it (member-response.dto.ts).
type FamilyMember = {
  id: string;
  userId: string;
  name: string;
  relationship: MemberRelationship | null;
};

// EPIC-021 Group D (#12) — one heir row bound to text inputs; parsed into a
// `CreateHeirDto` on save. Rows with an empty name are dropped on submit.
// `id` is a stable React key (server row id when loaded from an existing
// asset, or a locally-generated one for freshly added blank rows) — TS
// review fix #3, array index is not a stable identity across add/remove.
interface HeirFormRow {
  id: string;
  name: string;
  relationship: string;
  sharePercent: string;
  memberUserId: string;
}

let heirRowIdCounter = 0;

function emptyHeirRow(): HeirFormRow {
  heirRowIdCounter += 1;
  return {
    id: `new-heir-${heirRowIdCounter}`,
    name: "",
    relationship: "",
    sharePercent: "",
    memberUserId: "",
  };
}

function totalAllocated(rows: HeirFormRow[]): number {
  return rows.reduce((sum, r) => sum + (parseFloat(r.sharePercent) || 0), 0);
}

function visibilityToBoolean(v: InheritanceVisibility): boolean {
  return v !== "private";
}

function booleanToVisibility(v: boolean): InheritanceVisibility {
  return v ? "heirs_only" : "private";
}

const HEIR_CHIP_VARIANTS = [
  "purple",
  "info",
  "success",
  "warning",
  "gray",
] as const;

interface AssetCardProps {
  item: InheritanceAssetDto;
  linkedAssetName: string | undefined;
  onEdit: () => void;
  onDelete: () => void;
  onVisibilityToggle: (visible: boolean) => void;
}

/**
 * EPIC-025 N3 restructure — one self-contained card per asset (prototype
 * parity): type badge chip, meta line (notes + linked-asset name when the
 * record is tied to a real `Asset`), per-heir allocation chips, and an
 * allocation progress bar/status line. Only fields that genuinely exist on
 * `InheritanceAssetDto` are rendered — no invented "SHM No." style copy.
 */
function AssetCard({
  item,
  linkedAssetName,
  onEdit,
  onDelete,
  onVisibilityToggle,
}: AssetCardProps) {
  const { t } = useLocale();
  const icon = ASSET_TYPE_ICON[item.assetType] ?? "📋";
  const iconBg = ASSET_TYPE_BG[item.assetType] ?? "#F3F4F6";
  const allocated = item.heirs.reduce(
    (sum, h) => sum + Number(h.sharePercent),
    0,
  );
  const clampedAllocated = Math.min(100, allocated);
  const unallocated = Math.max(0, 100 - allocated);
  const isFullyAllocated = allocated >= 100;
  const barColor = isFullyAllocated
    ? "var(--success)"
    : allocated > 0
      ? "var(--warning)"
      : "var(--muted-foreground)";
  const metaLine = [
    item.notes,
    linkedAssetName
      ? `${t.warisan.linkedToAssetPrefix} "${linkedAssetName}"`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-[12px] border bg-background p-3.5">
      <div className="flex flex-wrap items-start gap-2.5">
        <div
          className="flex size-[36px] shrink-0 items-center justify-center rounded-[10px] text-[15px]"
          style={{ background: iconBg }}
        >
          {icon}
        </div>
        <div className="min-w-[170px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-bold">{item.name}</span>
            <StatusBadge variant="gray">{item.assetType}</StatusBadge>
          </div>
          {metaLine && (
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {metaLine}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          {/* EPIC-026 Wave 4 — prototype value is `t-lg t-black mono`
              (16px mono, warisan.html:49). */}
          <div className="mono text-[16px] font-black">
            {formatRupiah(Number(BigInt(item.estimatedValue)))}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {t.warisan.estimatedValueLabel}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {item.heirs.map((h, i) => (
          <StatusBadge
            key={h.id}
            variant={HEIR_CHIP_VARIANTS[i % HEIR_CHIP_VARIANTS.length]}
          >
            {h.name} · {h.relationship} · {h.sharePercent}%
          </StatusBadge>
        ))}
        <div className="flex-1" />
        <Switch
          checked={visibilityToBoolean(item.visibility)}
          onCheckedChange={onVisibilityToggle}
          className="shrink-0"
        />
        <RowActions onEdit={onEdit} onDelete={onDelete} />
      </div>

      {item.heirs.length > 0 && (
        <>
          <ProgressBar
            value={clampedAllocated}
            color={barColor}
            className="mt-2.5"
          />
          <div
            className={`mt-1 text-[11px] ${isFullyAllocated ? "text-success" : "text-warning"}`}
          >
            {isFullyAllocated
              ? t.warisan.heirAllocationFullyAllocated
              : `${unallocated}${t.warisan.heirAllocationUnallocatedSuffix}`}
          </div>
        </>
      )}
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

interface HeirEditorProps {
  rows: HeirFormRow[];
  onChange: (rows: HeirFormRow[]) => void;
  familyMembers: FamilyMember[];
  // EPIC-023 F1 (D14) — true when the members list failed to load (e.g. a
  // dependant/operational role has no "read Member" ability). Honest UI: a
  // silently-empty picker looks identical to "this family has no members",
  // so this note tells the user WHY the picker is unavailable instead of
  // just hiding it.
  membersUnavailable?: boolean;
  // Review fix (attempt 2, HIGH) — heir row ids that failed the blank-
  // relationship guard in `handleSave`, so the offending row(s) can render an
  // inline, field-associated error (WCAG 3.3.1 Error Identification) instead
  // of relying solely on a global toast.
  invalidRelationshipHeirIds?: Set<string>;
}

/**
 * EPIC-021 Group D (#12) — heir editor: free-text name/relationship, an
 * optional link to a family-group member, and an allocation bar showing the
 * unallocated remainder ("x% belum dialokasikan"). Heirs remain optional —
 * an asset can be recorded with zero heirs. EPIC-023 F1 (D14, US-INS-5) —
 * fully internationalised (previously entirely hardcoded Indonesian) and
 * selecting a member now live-fills name/relationship, mirroring
 * asuransi's BeneficiaryEditor.
 */
function HeirEditor({
  rows,
  onChange,
  familyMembers,
  membersUnavailable,
  invalidRelationshipHeirIds,
}: HeirEditorProps) {
  const { t } = useLocale();
  const allocated = Math.min(100, totalAllocated(rows));
  const unallocated = Math.max(0, 100 - totalAllocated(rows));

  function updateRow(id: string, patch: Partial<HeirFormRow>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div>
      {/* EPIC-026 Wave 8 — prototype composition (warisan.html:262): a
          `section-title` + a `.table-wrap`/`.table` of heir rows
          (Nama / Hubungan* / Bagian (%) / Aksi), a `btn--block` add button,
          then the allocation `.notice` + `.progress` bar. The member picker
          lives in the Nama cell: the prototype folds "link to a family
          member" into that column's own <select>, and the app keeps both
          controls because a heir may be a non-member. */}
      <div className="section-title mt-[18px] mb-2 text-[14px]">
        {t.warisan.heirsSectionTitle}
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t.warisan.heirTableHeaderName}</th>
              <th>
                {t.warisan.heirTableHeaderRelationship}{" "}
                <span className="t-danger">*</span>
              </th>
              <th>{t.warisan.heirTableHeaderShare}</th>
              <th className="text-right">{t.warisan.heirTableHeaderAction}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="text-muted-foreground">
                  {t.warisan.heirTableEmpty}
                </td>
              </tr>
            )}
            {rows.map((row) => {
              // EPIC-023 F1 (D14) — once linked, name/relationship are
              // resolved from the member's CURRENT record (not the row's own
              // free-text fields) so the editor never shows a value that
              // would be overwritten the moment the API re-resolves it on
              // the next read (see inheritance.service.ts's `MemberLookup`).
              const linkedMember = row.memberUserId
                ? familyMembers.find((m) => m.userId === row.memberUserId)
                : undefined;
              // Review fix (attempt 2, HIGH) — associate the blank-
              // relationship guard's error with this specific row's input,
              // not just a toast.
              const isRelationshipInvalid =
                !linkedMember && invalidRelationshipHeirIds?.has(row.id);
              const relationshipErrorId = `heir-relationship-error-${row.id}`;
              return (
                <tr key={row.id}>
                  <td>
                    {familyMembers.length > 0 ? (
                      <select
                        value={row.memberUserId}
                        onChange={(e) => {
                          const memberUserId = e.target.value;
                          const picked = familyMembers.find(
                            (m) => m.userId === memberUserId,
                          );
                          // Live-fill on selection; the API re-resolves from
                          // the CURRENT member record on every subsequent
                          // read regardless of what is stored here (see the
                          // comment above).
                          updateRow(row.id, {
                            memberUserId,
                            ...(picked
                              ? {
                                  name: picked.name,
                                  relationship: picked.relationship ?? "",
                                }
                              : {}),
                          });
                        }}
                        className="select"
                        aria-label={t.warisan.heirMemberAriaLabel}
                      >
                        <option value="">
                          {t.warisan.heirMemberNoneOption}
                        </option>
                        {familyMembers.map((m) => (
                          <option key={m.userId} value={m.userId}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      membersUnavailable && (
                        <p className="hint">
                          {t.warisan.heirMemberPickerUnavailable}
                        </p>
                      )
                    )}
                    <input
                      type="text"
                      value={linkedMember ? linkedMember.name : row.name}
                      disabled={!!linkedMember}
                      onChange={(e) =>
                        updateRow(row.id, { name: e.target.value })
                      }
                      placeholder={t.warisan.heirNamePlaceholder}
                      aria-label={t.warisan.heirTableHeaderName}
                      className="input mt-1.5 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={
                        linkedMember
                          ? (linkedMember.relationship ?? "")
                          : row.relationship
                      }
                      disabled={!!linkedMember}
                      onChange={(e) =>
                        updateRow(row.id, { relationship: e.target.value })
                      }
                      placeholder={t.warisan.heirRelationshipPlaceholder}
                      aria-label={t.warisan.heirTableHeaderRelationship}
                      aria-required
                      aria-invalid={isRelationshipInvalid ? true : undefined}
                      aria-describedby={
                        isRelationshipInvalid ? relationshipErrorId : undefined
                      }
                      className={`input disabled:cursor-not-allowed disabled:opacity-60 ${
                        isRelationshipInvalid
                          ? "border-destructive focus:border-destructive"
                          : ""
                      }`}
                    />
                    {isRelationshipInvalid && (
                      <span id={relationshipErrorId} className="error-text">
                        {t.warisan.toastHeirRelationshipRequired}
                      </span>
                    )}
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={row.sharePercent}
                      onChange={(e) =>
                        updateRow(row.id, { sharePercent: e.target.value })
                      }
                      placeholder={t.warisan.heirSharePercentPlaceholder}
                      aria-label={t.warisan.heirTableHeaderShare}
                      className="input mono"
                    />
                  </td>
                  <td className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${t.warisan.removeHeirAriaLabel} ${
                        linkedMember ? linkedMember.name : row.name
                      }`.trim()}
                      onClick={() =>
                        onChange(rows.filter((r) => r.id !== row.id))
                      }
                    >
                      <X className="size-[15px]" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => onChange([...rows, emptyHeirRow()])}
        className="btn--block mt-2.5"
      >
        <Plus className="size-[15px]" /> {t.warisan.addHeirButton}
      </Button>

      {rows.length > 0 && (
        <>
          <div className="notice mt-3">
            <PieChart className="size-4 shrink-0" aria-hidden="true" />
            <span>
              {unallocated <= 0
                ? t.warisan.heirAllocationFullyAllocated
                : `${allocated}${t.warisan.heirAllocationAllocatedSuffix} · ${unallocated}${t.warisan.heirAllocationUnallocatedSuffix}`}
            </span>
          </div>
          <ProgressBar
            value={allocated}
            color={unallocated <= 0 ? "var(--success)" : "var(--warning)"}
            className="mt-2"
          />
        </>
      )}
    </div>
  );
}

export default function WarisanPage() {
  const { t } = useLocale();
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
  const valueField = useMoneyField();
  const [notes, setNotes] = useState("");
  const [visible, setVisible] = useState(true);
  // EPIC-021 Group D (#11) — "Pilih dari Aset" mode: pick an existing Asset
  // instead of manual re-entry. Manual entry stays the default/available mode.
  // EPIC-033 R4 — manual entry is gone for new items; "manual" survives only
  // while editing a legacy row that was never linked to an Asset.
  const [pickMode, setPickMode] = useState<"manual" | "asset">("asset");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  // EPIC-021 Group D (#12) — heirs are optional; percentages may sum to <= 100.
  const [heirs, setHeirs] = useState<HeirFormRow[]>([]);
  // Review fix (attempt 2, HIGH) — heir row ids currently failing the blank-
  // relationship guard in `handleSave`, so `HeirEditor` can render an inline
  // error under the offending row(s) instead of only a global toast.
  const [invalidRelationshipHeirIds, setInvalidRelationshipHeirIds] = useState<
    Set<string>
  >(new Set());

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

  // Source assets for the "Pilih dari Aset" picker (distinct from the
  // inheritance records above).
  const { data: pickableAssets = [] } = useQuery<AssetDto[]>({
    queryKey: familyGroupId
      ? queryKeys.assets.all(familyGroupId)
      : ["assets", "disabled"],
    enabled: !!familyGroupId && !!token,
    queryFn: () =>
      apiFetch<AssetDto[]>(`/family-groups/${familyGroupId}/assets`, {
        token,
      }),
  });

  // Family members for the heir's optional "link to a family member"
  // picker. EPIC-023 F1 (D14) — `isError` drives the honest-UI note in
  // HeirEditor for roles (dependant/operational) that hold no "read
  // Member" ability, instead of a silently-empty picker indistinguishable
  // from "no members exist".
  const { data: familyMembers = [], isError: isFamilyMembersError } = useQuery<
    FamilyMember[],
    ApiError
  >({
    queryKey: familyGroupId
      ? [...queryKeys.familyGroups.members(familyGroupId), token]
      : ["family-members", "disabled"],
    enabled: !!familyGroupId && !!token,
    queryFn: () =>
      apiFetch<FamilyMember[]>(`/family-groups/${familyGroupId}/members`, {
        token,
      }),
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateInheritanceAssetDto) =>
      apiFetch<InheritanceAssetDto>(
        `/family-groups/${familyGroupId}/inheritance`,
        { method: "POST", body: JSON.stringify(dto), token },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKey ?? [] });
      toast.success(t.warisan.toastAdded);
      setOpen(false);
      resetForm();
    },
    onError: (err) =>
      toast.error(extractApiErrorMessage(err, t.warisan.toastAddFailed)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateInheritanceAssetDto }) =>
      apiFetch<InheritanceAssetDto>(
        `/family-groups/${familyGroupId}/inheritance/${id}`,
        { method: "PATCH", body: JSON.stringify(dto), token },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKey ?? [] });
      toast.success(t.warisan.toastUpdated);
      setOpen(false);
      setEditing(null);
      resetForm();
    },
    onError: (err) =>
      toast.error(extractApiErrorMessage(err, t.warisan.toastUpdateFailed)),
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
    onError: () => toast.error(t.warisan.toastVisibilityUpdateFailed),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/family-groups/${familyGroupId}/inheritance/${id}`, {
        method: "DELETE",
        token,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKey ?? [] });
      toast.success(t.warisan.toastDeleted);
      setDeleteTarget(null);
    },
    onError: () => toast.error(t.warisan.toastDeleteFailed),
  });

  function resetForm() {
    setAssetType(ASSET_TYPE_OPTIONS[0] ?? "");
    setName("");
    valueField.reset();
    setNotes("");
    setVisible(true);
    setPickMode("asset");
    setSelectedAssetId("");
    setHeirs([]);
    setInvalidRelationshipHeirIds(new Set());
  }

  function openEditAsset(item: InheritanceAssetDto) {
    setEditing(item);
    setAssetType(item.assetType);
    setName(item.name);
    valueField.reset(BigInt(item.estimatedValue).toString());
    setNotes(item.notes ?? "");
    setVisible(visibilityToBoolean(item.visibility));
    setPickMode(item.assetId ? "asset" : "manual");
    setSelectedAssetId(item.assetId ?? "");
    setHeirs(
      item.heirs.map((h) => ({
        id: h.id,
        name: h.name,
        relationship: h.relationship,
        sharePercent: h.sharePercent,
        memberUserId: h.memberUserId ?? "",
      })),
    );
    setInvalidRelationshipHeirIds(new Set());
    setOpen(true);
  }

  // EPIC-021 Group D (#11) — prefill nama/nilai from the picked Asset; the
  // user can still edit both fields before saving.
  function handlePickAsset(assetId: string) {
    setSelectedAssetId(assetId);
    const picked = pickableAssets.find((a) => a.id === assetId);
    if (picked) {
      setName(picked.name);
      valueField.reset(BigInt(picked.currentValue).toString());
    }
  }

  function handleSave() {
    if (!familyGroupId || !token) {
      toast.error(t.warisan.toastSessionNotReady);
      return;
    }
    const raw = moneyDigits(valueField);
    const estimatedValue = parseInt(raw, 10);
    if (!name.trim()) {
      toast.error(t.warisan.toastNameRequired);
      return;
    }
    if (isNaN(estimatedValue) || estimatedValue < 0) {
      toast.error(t.warisan.toastInvalidValue);
      return;
    }

    // EPIC-024 Group H (item 15) — an included heir row (has a name) with a
    // blank relationship used to slip through this filter, hit the API's
    // `CreateHeirDto.relationship` @IsNotEmpty() check, and surface only a
    // generic toast. Block the submit here, before any API call, instead.
    //
    // Review fix (attempt 2, HIGH) — also record WHICH row(s) are invalid so
    // `HeirEditor` can render an inline, field-associated error under each
    // offending relationship input (WCAG 3.3.1), not just a global toast.
    const includedHeirs = heirs.filter((h) => h.name.trim());
    const invalidHeirs = includedHeirs.filter((h) => !h.relationship.trim());
    if (invalidHeirs.length > 0) {
      setInvalidRelationshipHeirIds(new Set(invalidHeirs.map((h) => h.id)));
      toast.error(t.warisan.toastHeirRelationshipRequired);
      return;
    }
    setInvalidRelationshipHeirIds(new Set());

    const heirDtos: CreateHeirDto[] = includedHeirs.map((h) => ({
      name: h.name.trim(),
      relationship: h.relationship.trim(),
      sharePercent: parseFloat(h.sharePercent) || 0,
      ...(h.memberUserId && { memberUserId: h.memberUserId }),
    }));
    if (heirDtos.reduce((sum, h) => sum + h.sharePercent, 0) > 100) {
      toast.error(t.warisan.toastSharePercentExceeded);
      return;
    }
    if (valueField.resolved.isPending) return;

    const baseFields = {
      name: name.trim(),
      assetType,
      estimatedValue,
      notes: notes.trim() || undefined,
      visibility: booleanToVisibility(visible),
      heirs: heirDtos,
    };

    if (editing) {
      // TS review fix #2 — only send `assetId` when it actually changed:
      // picking a different asset sends the new id; switching to "Input
      // Manual" (away from a previously-linked asset) sends `assetId: null`
      // to clear the stale link; otherwise the field is omitted so the
      // existing link (or lack of one) is left untouched.
      const nextAssetId = pickMode === "asset" ? selectedAssetId || null : null;
      const assetIdChanged = nextAssetId !== (editing.assetId ?? null);
      const dto: UpdateInheritanceAssetDto = {
        ...baseFields,
        ...(assetIdChanged ? { assetId: nextAssetId } : {}),
      };
      updateMutation.mutate({
        id: editing.id,
        dto: withFxInputs(dto, [["estimatedValue", valueField]]),
      });
    } else {
      const dto: CreateInheritanceAssetDto = {
        ...baseFields,
        ...(pickMode === "asset" && selectedAssetId
          ? { assetId: selectedAssetId }
          : {}),
      };
      createMutation.mutate(
        withFxInputs(dto, [["estimatedValue", valueField]]),
      );
    }
  }

  const totalValue = assets.reduce(
    (sum, a) => sum + BigInt(a.estimatedValue),
    BigInt(0),
  );

  const heirNames = Array.from(
    new Set(assets.flatMap((a) => a.heirs.map((h) => h.name))),
  );

  // EPIC-025 N3-E3 — J3 FOLD: "Alokasi Ahli Waris" donut, ported from
  // `docs/prototype/pages/warisan.html`'s `WMCharts.donut()` mount. Each
  // heir's slice is the sum, across every asset, of
  // `estimatedValue * sharePercent / 100`; any remainder per asset
  // (unallocated share) rolls into one "Belum dialokasikan" slice — same
  // already-fetched `assets` list `AssetRow` above already reads.
  const heirAllocationTotals = new Map<string, number>();
  // EPIC-025 N3 restructure — the relationship shown alongside each heir in
  // the beneficiary list below the donut (first relationship string seen for
  // that name; heirs are rarely recorded under two different relationships).
  const heirRelationships = new Map<string, string>();
  let unallocatedTotal = 0;
  for (const asset of assets) {
    const value = Number(BigInt(asset.estimatedValue));
    let allocatedPercent = 0;
    for (const heir of asset.heirs) {
      const pct = Number(heir.sharePercent) || 0;
      allocatedPercent += pct;
      heirAllocationTotals.set(
        heir.name,
        (heirAllocationTotals.get(heir.name) ?? 0) + (value * pct) / 100,
      );
      if (!heirRelationships.has(heir.name)) {
        heirRelationships.set(heir.name, heir.relationship);
      }
    }
    const remainingPercent = Math.max(0, 100 - allocatedPercent);
    unallocatedTotal += (value * remainingPercent) / 100;
  }
  const HEIR_DONUT_COLORS = [
    "var(--brand-purple)",
    "var(--success)",
    "var(--brand-cyan)",
    "var(--primary)",
    "var(--warning)",
    "var(--brand-orange)",
  ];
  const heirAllocationSegments: DonutSegment[] = Array.from(
    heirAllocationTotals.entries(),
  )
    .filter(([, value]) => value > 0)
    .map(([label, value], i) => ({
      label,
      value,
      color: HEIR_DONUT_COLORS[i % HEIR_DONUT_COLORS.length]!,
    }));
  if (unallocatedTotal > 0) {
    heirAllocationSegments.push({
      label: t.warisan.heirAllocationUnallocatedLabel,
      value: unallocatedTotal,
      color: "var(--muted-foreground)",
    });
  }

  // EPIC-025 N3 restructure — avatar-row beneficiary list rendered under the
  // donut (prototype parity), built from the same totals above. Colors cycle
  // through the identical palette so a heir's avatar always matches its
  // donut slice.
  const heirBeneficiaryRows = Array.from(heirAllocationTotals.entries())
    .filter(([, value]) => value > 0)
    .map(([name, value], i) => ({
      name,
      relationship: heirRelationships.get(name) ?? "",
      value,
      color: HEIR_DONUT_COLORS[i % HEIR_DONUT_COLORS.length]!,
      initials: name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join(""),
    }));

  return (
    <div className="space-y-4">
      {/* Hero — EPIC-026 Wave 4: prototype uses `gradient-emerald` with a
          plain `hero__label` + mono `hero__value` (warisan.html:15); the
          previous gradient-wealth + 🏛️ watermark were app inventions. */}
      <HeroCard className="gradient-emerald">
        <div className="text-[12.5px] font-semibold opacity-85">
          {t.warisan.heroTitle}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mono mt-1 text-[30px] font-extrabold tracking-[-0.03em]">
              {formatRupiah(Number(totalValue))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge
                variant="gray"
                className="bg-white/20 text-white dark:text-white"
              >
                {assets.length}
                {t.warisan.assetsRegisteredSuffix}
              </StatusBadge>
              {heirNames.length > 0 && (
                <span className="text-[12px] opacity-85">
                  {t.warisan.heirsMidDot}
                  {heirNames.length}
                  {t.warisan.heirsSuffix}
                </span>
              )}
            </div>
          </div>
          <Button
            onClick={() => setOpen(true)}
            variant="outline"
            className="h-auto shrink-0 border-white/30 bg-white/15 px-4 py-[9px] text-white hover:bg-white/25 hover:text-white"
          >
            <Plus className="size-4" /> {t.warisan.addAssetButton}
          </Button>
        </div>
      </HeroCard>

      {isLoading && (
        <Card className="gap-0 p-5">
          <AssetSkeleton />
        </Card>
      )}

      {!isLoading && assets.length === 0 && (
        <Card className="gap-0 p-5">
          <div className="py-8 text-center text-[13px] text-muted-foreground">
            {t.warisan.emptyState}
          </div>
        </Card>
      )}

      {/* EPIC-025 N3 restructure — 2-col layout: the asset list on the
          left, allocation donut + notes card in a right rail.
          EPIC-026 Wave 4 — prototype's `grid--sidebar` is 2fr/1fr
          (app.css:748), not 1fr/360px. */}
      {!isLoading && assets.length > 0 && (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card className="gap-0 p-5">
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[13.5px] font-bold text-muted-foreground">
                {t.warisan.assetListCardTitle}
              </div>
              <span className="text-[11px] text-muted-foreground">
                {t.warisan.visibleToAllHeirsCaption}
              </span>
            </div>
            <div className="space-y-3">
              {assets.map((item) => (
                <AssetCard
                  key={item.id}
                  item={item}
                  linkedAssetName={
                    item.assetId
                      ? pickableAssets.find((a) => a.id === item.assetId)?.name
                      : undefined
                  }
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
            </div>
          </Card>

          <div className="space-y-3.5">
            {/* EPIC-025 N3-E3 — beneficiary-allocation donut. Section is
                hidden when there is nothing to allocate yet (Honest UI). */}
            {heirAllocationSegments.length > 0 && (
              <SectionCard title={t.warisan.heirAllocationChartTitle}>
                <DonutChart
                  segments={heirAllocationSegments}
                  centerLabel={t.warisan.heroTitle}
                  ariaLabel={`${t.warisan.heirAllocationChartTitle}: ${heirAllocationSegments
                    .map(
                      (s) => `${s.label} ${formatRupiah(Math.round(s.value))}`,
                    )
                    .join(", ")}`}
                />
                <div className="mt-1.5 space-y-0.5">
                  {heirBeneficiaryRows.map((row) => (
                    <div
                      key={row.name}
                      className="flex items-center gap-2.5 py-1.5"
                    >
                      <div
                        className="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                        style={{ background: row.color }}
                      >
                        {row.initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-semibold">
                          {row.name}
                        </div>
                        {row.relationship && (
                          <div className="truncate text-[11px] text-muted-foreground">
                            {row.relationship}
                          </div>
                        )}
                      </div>
                      <span className="mono shrink-0 text-[12px] font-bold">
                        {formatRupiah(Math.round(row.value))}
                      </span>
                    </div>
                  ))}
                  {unallocatedTotal > 0 && (
                    <div className="flex items-center gap-2.5 py-1.5">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-muted-foreground">
                        ?
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-semibold">
                          {t.warisan.heirAllocationUnallocatedLabel}
                        </div>
                      </div>
                      <span className="mono shrink-0 text-[12px] font-bold text-warning">
                        {formatRupiah(Math.round(unallocatedTotal))}
                      </span>
                    </div>
                  )}
                </div>
              </SectionCard>
            )}

            {/* Notes card */}
            <SectionCard title={t.warisan.insightTitle}>
              <div className="flex items-start gap-2.5 rounded-[11px] border border-primary/20 bg-accent p-3 text-[12px] text-muted-foreground">
                <span className="text-[16px]">🛡️</span>
                <span>{t.warisan.insightDesc}</span>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {/* Confirm delete — prototype `dlg-hapus-warisan` (warisan.html:359):
          `dialog--sm`, its own body copy, Batal + destructive "Ya, Hapus". */}
      <ConfirmDeleteDialog
        label={deleteTarget?.name ?? null}
        body={t.warisan.deleteConfirmBody}
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
        <DialogContent className="dialog--wide">
          <DialogTitle>
            {editing ? t.warisan.modalTitleEdit : t.warisan.addAssetButton}
          </DialogTitle>
          {/* EPIC-026 Wave 8 — prototype `.dialog__desc` (warisan.html:222). */}
          <DialogDescription>{t.warisan.modalDesc}</DialogDescription>

          <DialogBody>
            {/* EPIC-021 Group D (#11) — pick an existing Asset instead of
                manual re-entry; manual entry stays available. The prototype
                folds both into a single "Aset" <select> whose last option is
                "Tidak dihubungkan (catat manual)"; the app keeps the
                explicit mode switch it already shipped and renders it with
                the prototype's `.segmented` control. */}
            {pickMode === "asset" && (
              <div className="field">
                <label className="label" htmlFor="warisan-asset">
                  {t.warisan.fieldAssetLabel}
                </label>
                <select
                  id="warisan-asset"
                  aria-describedby="warisan-asset-hint"
                  value={selectedAssetId}
                  onChange={(e) => handlePickAsset(e.target.value)}
                  className="select"
                >
                  <option value="">{t.warisan.assetPickerPlaceholder}</option>
                  {pickableAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatRupiah(Number(BigInt(a.currentValue)))})
                    </option>
                  ))}
                </select>
                <span className="hint" id="warisan-asset-hint">
                  {t.warisan.assetPickerHint}
                </span>
              </div>
            )}

            <div className="field">
              <label className="label" htmlFor="warisan-name">
                {t.warisan.fieldNameLabel}
              </label>
              <input
                id="warisan-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.warisan.fieldNamePlaceholder}
                className="input"
              />
            </div>

            {/* Prototype pairs Nilai Estimasi + Kategori 2-up
                (warisan.html:235). */}
            <div className="field-row mt-3">
              <div className="field mt-0">
                <label className="label" htmlFor="warisan-value">
                  {t.warisan.fieldValueLabel}
                </label>
                <MoneyInput field={valueField} id="warisan-value" />
              </div>
              <div className="field mt-0">
                <label className="label" htmlFor="warisan-category">
                  {t.warisan.fieldCategoryLabel}
                </label>
                <select
                  id="warisan-category"
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value)}
                  className="select"
                >
                  {ASSET_TYPE_OPTIONS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="warisan-notes">
                {t.warisan.fieldNotesLabel}
              </label>
              <textarea
                id="warisan-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder={t.warisan.fieldNotesPlaceholder}
                className="textarea resize-none"
              />
            </div>

            {/* App-only field with no prototype counterpart — kept because it
                already shipped, and labeled honestly as unavailable rather
                than pretending to upload. */}

            {/* Prototype's visibility row: label + switch on one line, hint
                underneath (warisan.html:254). */}
            <div className="field">
              <div className="row row--between">
                <span className="label m-0" id="warisan-visibility-label">
                  {t.warisan.visibleToHeirsLabel}
                </span>
                <Switch
                  checked={visible}
                  onCheckedChange={setVisible}
                  aria-labelledby="warisan-visibility-label"
                />
              </div>
              <span className="hint">{t.warisan.visibleToHeirsHint}</span>
            </div>

            {/* EPIC-021 Group D (#12) — heirs are optional; add/edit by
                percentage with an allocation bar. */}
            <HeirEditor
              rows={heirs}
              onChange={setHeirs}
              familyMembers={familyMembers}
              membersUnavailable={isFamilyMembersError}
              invalidRelationshipHeirIds={invalidRelationshipHeirIds}
            />

            {/* Prototype's `notice notice--danger` save blocker
                (warisan.html:341) — shown for the same condition the
                client-side guard in `handleSave` blocks on. */}
            {invalidRelationshipHeirIds.size > 0 && (
              <div className="notice notice--danger mt-3" role="alert">
                <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
                <span>{t.warisan.toastHeirRelationshipRequired}</span>
              </div>
            )}
          </DialogBody>

          {/* Prototype `.dialog__footer`: Batal (outline) then the primary
              save (warisan.html:352). */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                setEditing(null);
                resetForm();
              }}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={
                createMutation.isPending ||
                updateMutation.isPending ||
                valueField.resolved.isPending
              }
            >
              <Save className="size-4" />
              {createMutation.isPending || updateMutation.isPending
                ? t.warisan.savingLabel
                : t.warisan.saveAssetButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
