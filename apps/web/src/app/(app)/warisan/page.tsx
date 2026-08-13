"use client";

import { useState } from "react";
import { CloudUpload, Plus, Save, Scroll, X } from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  HeroCard,
  SectionCard,
  StatusBadge,
  ProgressBar,
} from "@/components/wm";
import { ConfirmDeleteDialog, RowActions } from "@/components/crud";
// EPIC-025 N3-E3 — J3 FOLD: beneficiary-allocation donut, derived from the
// already-fetched inheritance-assets list — no new backend endpoint.
import { DonutChart } from "@/components/charts/apex-presets";
import type { DonutSegment } from "@/components/charts/donut";
import { useLocale } from "@/hooks/use-locale";
import type { ApiError } from "@/lib/api-client";
import { apiFetch } from "@/lib/api-client";
import { formatAmountInput, formatRupiah } from "@/lib/format";
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

const FIELD_CLASS =
  "w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card";

// NOTE: these are the actual `assetType` values persisted on an inheritance
// asset record (free-text category), not a translated enum — kept in
// Indonesian in both locales so switching language never changes what gets
// stored, matching the value-locked crud-config select option convention.
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
          <div className="text-[15px] font-black">
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
      <label className="mb-1.5 block text-[12.5px] font-semibold">
        {t.warisan.heirsSectionTitle}
      </label>
      <div className="space-y-2.5">
        {rows.map((row) => {
          // EPIC-023 F1 (D14) — once linked, name/relationship are
          // resolved from the member's CURRENT record (not the row's own
          // free-text fields) so the editor never shows a value that would
          // be overwritten the moment the API re-resolves it on the next
          // read (see inheritance.service.ts's `MemberLookup`).
          const linkedMember = row.memberUserId
            ? familyMembers.find((m) => m.userId === row.memberUserId)
            : undefined;
          // Review fix (attempt 2, HIGH) — associate the blank-relationship
          // guard's error with this specific row's input, not just a toast.
          const isRelationshipInvalid =
            !linkedMember && invalidRelationshipHeirIds?.has(row.id);
          const relationshipErrorId = `heir-relationship-error-${row.id}`;
          return (
            <div
              key={row.id}
              className="space-y-2 rounded-md border bg-background p-3"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={linkedMember ? linkedMember.name : row.name}
                  disabled={!!linkedMember}
                  onChange={(e) => updateRow(row.id, { name: e.target.value })}
                  placeholder={t.warisan.heirNamePlaceholder}
                  className={`${FIELD_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
                />
                <button
                  type="button"
                  aria-label={t.warisan.removeHeirAriaLabel}
                  onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-muted"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
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
                    aria-invalid={isRelationshipInvalid ? true : undefined}
                    aria-describedby={
                      isRelationshipInvalid ? relationshipErrorId : undefined
                    }
                    className={`${FIELD_CLASS} disabled:cursor-not-allowed disabled:opacity-60 ${
                      isRelationshipInvalid
                        ? "border-destructive focus:border-destructive"
                        : ""
                    }`}
                  />
                  {isRelationshipInvalid && (
                    <p
                      id={relationshipErrorId}
                      className="mt-1 text-[11px] text-destructive"
                    >
                      {t.warisan.toastHeirRelationshipRequired}
                    </p>
                  )}
                </div>
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
                  className={FIELD_CLASS}
                />
              </div>
              {familyMembers.length > 0 ? (
                <select
                  value={row.memberUserId}
                  onChange={(e) => {
                    const memberUserId = e.target.value;
                    const picked = familyMembers.find(
                      (m) => m.userId === memberUserId,
                    );
                    // Live-fill on selection; the API re-resolves from the
                    // CURRENT member record on every subsequent read
                    // regardless of what is stored here (see comment above).
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
                  className={FIELD_CLASS}
                  aria-label={t.warisan.heirMemberAriaLabel}
                >
                  <option value="">{t.warisan.heirMemberNoneOption}</option>
                  {familyMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </select>
              ) : (
                membersUnavailable && (
                  <p className="text-[11px] text-muted-foreground">
                    {t.warisan.heirMemberPickerUnavailable}
                  </p>
                )
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onChange([...rows, emptyHeirRow()])}
        className="mt-2 text-[12.5px] font-semibold text-primary"
      >
        {t.warisan.addHeirButton}
      </button>

      {rows.length > 0 && (
        <div className="mt-2.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${allocated}%` }}
            />
          </div>
          <div className="mt-1 text-[11.5px] text-muted-foreground">
            {unallocated <= 0
              ? t.warisan.heirAllocationFullyAllocated
              : `${allocated}${t.warisan.heirAllocationAllocatedSuffix} · ${unallocated}${t.warisan.heirAllocationUnallocatedSuffix}`}
          </div>
        </div>
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
  const [valueInput, setValueInput] = useState("");
  const [notes, setNotes] = useState("");
  const [visible, setVisible] = useState(true);
  // EPIC-021 Group D (#11) — "Pilih dari Aset" mode: pick an existing Asset
  // instead of manual re-entry. Manual entry stays the default/available mode.
  const [pickMode, setPickMode] = useState<"manual" | "asset">("manual");
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
    setValueInput("");
    setNotes("");
    setVisible(true);
    setPickMode("manual");
    setSelectedAssetId("");
    setHeirs([]);
    setInvalidRelationshipHeirIds(new Set());
  }

  function openEditAsset(item: InheritanceAssetDto) {
    setEditing(item);
    setAssetType(item.assetType);
    setName(item.name);
    setValueInput(Number(BigInt(item.estimatedValue)).toLocaleString("id-ID"));
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
      setValueInput(
        Number(BigInt(picked.currentValue)).toLocaleString("id-ID"),
      );
    }
  }

  function handleSave() {
    if (!familyGroupId || !token) {
      toast.error(t.warisan.toastSessionNotReady);
      return;
    }
    const raw = valueInput.replace(/\D/g, "");
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
      toast.error("Total persentase ahli waris tidak boleh lebih dari 100%.");
      return;
    }

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
      updateMutation.mutate({ id: editing.id, dto });
    } else {
      const dto: CreateInheritanceAssetDto = {
        ...baseFields,
        ...(pickMode === "asset" && selectedAssetId
          ? { assetId: selectedAssetId }
          : {}),
      };
      createMutation.mutate(dto);
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
      {/* Hero */}
      <HeroCard className="gradient-wealth">
        <div className="mb-1.5 flex items-center gap-2 text-[12px] opacity-85">
          <Scroll className="size-3.5" /> {t.warisan.heroTitle}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[30px] font-black tracking-[-1px]">
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
        <div className="pointer-events-none absolute -top-5 -right-5 text-[140px] opacity-10">
          🏛️
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

      {/* EPIC-025 N3 restructure — 2-col layout: the asset list (~65%) on
          the left, allocation donut + notes card in a right rail. */}
      {!isLoading && assets.length > 0 && (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1fr_360px]">
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
              <button
                onClick={() => toast(t.warisan.toastUploadUnavailable)}
                className="mt-2.5 flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-md border-[1.5px] border-dashed p-2.5 text-[12.5px] font-semibold text-muted-foreground opacity-70"
              >
                <CloudUpload className="size-4" />
                {t.warisan.uploadComingSoonButton}
              </button>
            </SectionCard>
          </div>
        </div>
      )}

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
            {editing ? t.warisan.modalTitleEdit : t.warisan.addAssetButton}
          </DialogTitle>

          <div className="space-y-4">
            {/* EPIC-021 Group D (#11) — pick an existing Asset instead of
                manual re-entry; manual entry stays available. */}
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                Sumber Data
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPickMode("manual")}
                  className={`rounded-md border px-3 py-2 text-[12.5px] font-semibold transition-colors ${
                    pickMode === "manual"
                      ? "border-primary bg-accent text-primary-strong"
                      : "bg-background"
                  }`}
                >
                  Input Manual
                </button>
                <button
                  type="button"
                  onClick={() => setPickMode("asset")}
                  className={`rounded-md border px-3 py-2 text-[12.5px] font-semibold transition-colors ${
                    pickMode === "asset"
                      ? "border-primary bg-accent text-primary-strong"
                      : "bg-background"
                  }`}
                >
                  Pilih dari Aset
                </button>
              </div>
            </div>

            {pickMode === "asset" && (
              <div>
                <label className="mb-1.5 block text-[12.5px] font-semibold">
                  Pilih Aset
                </label>
                <select
                  value={selectedAssetId}
                  onChange={(e) => handlePickAsset(e.target.value)}
                  className={FIELD_CLASS}
                >
                  <option value="">— Pilih aset —</option>
                  {pickableAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatRupiah(Number(BigInt(a.currentValue)))})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                {t.warisan.fieldCategoryLabel}
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
                {t.warisan.fieldNameLabel}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.warisan.fieldNamePlaceholder}
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                {t.warisan.fieldValueLabel}
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
                {t.warisan.fieldNotesLabel}
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.warisan.fieldNotesPlaceholder}
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                {t.warisan.fieldDocumentLabel}
              </label>
              <button
                type="button"
                onClick={() => toast(t.warisan.toastUploadUnavailable)}
                className="w-full cursor-not-allowed rounded-md border-[1.5px] border-dashed p-[18px] text-center opacity-60"
              >
                <CloudUpload className="mx-auto mb-1.5 size-[22px] text-muted-foreground" />
                <div className="text-[12px] text-muted-foreground">
                  {t.warisan.documentUploadHint}
                </div>
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                {t.warisan.fieldAccessLabel}
              </label>
              <div className="rounded-md border bg-card px-3.5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-semibold">
                      {t.warisan.visibleToHeirsLabel}
                    </div>
                    <div className="text-[11.5px] text-muted-foreground">
                      {visible
                        ? t.warisan.visibleToHeirsOnDesc
                        : t.warisan.visibleToHeirsOffDesc}
                    </div>
                  </div>
                  <Switch checked={visible} onCheckedChange={setVisible} />
                </div>
              </div>
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

            <Button
              onClick={handleSave}
              disabled={createMutation.isPending}
              className="w-full"
            >
              <Save className="size-4" />
              {createMutation.isPending
                ? t.warisan.savingLabel
                : t.warisan.saveAssetButton}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
