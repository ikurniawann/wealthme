"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X, CalendarClock, Pencil, Trash2, Banknote } from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge, SectionCard } from "@/components/wm";
import { DonutChart } from "@/components/charts/apex-presets";
import type { DonutSegment } from "@/components/charts/donut";
import { ConfirmDeleteDialog } from "@/components/crud";
import { useLocale } from "@/hooks/use-locale";
import type { Locale } from "@/i18n";
import type { ApiError } from "@/lib/api-client";
import { apiFetch } from "@/lib/api-client";
import { formatAmountInput, formatRupiah, parseRupiah } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

import type {
  CreateInsuranceBeneficiaryDto,
  CreateInsuranceDto,
  InsuranceDto,
  InsuranceSummaryDto,
  InsuranceType,
  InsuranceStatus,
  MemberRelationship,
  PremiumPeriod,
  UpdateInsuranceDto,
} from "@wealthme/contracts";

// EPIC-021 Group D (#14) — mirrors the `FamilyMember` shape used on /akun for
// the optional "link a beneficiary to a family member" picker. EPIC-023 F1
// (D14) added `relationship` so selecting a member can live-fill it too —
// the API's response DTO already carries it (member-response.dto.ts).
type FamilyMember = {
  id: string;
  userId: string;
  name: string;
  relationship: MemberRelationship | null;
};

const INSURANCE_TYPE_ICON: Record<string, string> = {
  jiwa: "🛡️",
  kesehatan: "🏥",
  kendaraan: "🚗",
  properti: "🏠",
  pendidikan: "🎓",
  lainnya: "📋",
};

const INSURANCE_TYPE_BG: Record<string, string> = {
  jiwa: "#EDE9FE",
  kesehatan: "#DCFCE7",
  kendaraan: "#DBEAFE",
  properti: "#FEF9C3",
  pendidikan: "#FFE4E6",
  lainnya: "#F3F4F6",
};

// EPIC-025 N3-F3 — coverage-by-type donut (FOLD): distinct hex per type so
// segments read clearly (INSURANCE_TYPE_BG's pastel tints are too close to
// each other for a donut legend).
const INSURANCE_TYPE_DONUT_COLOR: Record<string, string> = {
  jiwa: "#7C3AED",
  kesehatan: "#16A34A",
  kendaraan: "#2563EB",
  properti: "#D97706",
  pendidikan: "#DB2777",
  lainnya: "#6B7280",
};

const FIELD_CLASS =
  "w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card";

const TYPE_OPTIONS: InsuranceType[] = [
  "jiwa",
  "kesehatan",
  "kendaraan",
  "properti",
  "pendidikan",
  "lainnya",
];

const STATUS_OPTIONS: InsuranceStatus[] = [
  "aktif",
  "tidak_aktif",
  "kadaluarsa",
];

const PERIOD_OPTIONS: PremiumPeriod[] = ["monthly", "quarterly", "yearly"];

function formatLocaleDate(iso: string | null, locale: Locale): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function renewalBadgeVariant(
  days: number | null,
): "danger" | "warning" | "success" {
  if (days === null) return "success";
  if (days <= 7) return "danger";
  if (days <= 30) return "warning";
  return "success";
}

function PolicyCardSkeleton() {
  return (
    <div className="animate-pulse rounded-[14px] border bg-card p-[18px]">
      <div className="mb-3.5 flex items-center gap-2.5">
        <div className="size-[38px] rounded-[10px] bg-muted" />
        <div className="flex-1 space-y-1.5">
          <div className="h-4 w-36 rounded bg-muted" />
          <div className="h-3 w-24 rounded bg-muted" />
        </div>
        <div className="h-5 w-14 rounded-full bg-muted" />
      </div>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-1">
            <div className="h-2.5 w-20 rounded bg-muted" />
            <div className="h-3.5 w-28 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

interface PolicyCardProps {
  item: InsuranceDto;
  onEdit: () => void;
  onPay: () => void;
  onDelete: () => void;
}

function PolicyCard({ item, onEdit, onPay, onDelete }: PolicyCardProps) {
  const { t, locale } = useLocale();
  const icon = INSURANCE_TYPE_ICON[item.type] ?? "📋";
  const iconBg = INSURANCE_TYPE_BG[item.type] ?? "#F3F4F6";
  const typeLabel = t.asuransi.typeLabels[item.type] ?? item.type;
  const periodLabel = t.asuransi.periodSuffixLabels[item.premiumPeriod] ?? "";
  const renewalVariant = renewalBadgeVariant(item.daysUntilRenewal);
  const statusLabel = t.asuransi.statusLabels[item.status] ?? item.status;
  // EPIC-021 Group D (#14) — mirrors warisan's heirSummary line on AssetRow.
  const beneficiarySummary =
    item.beneficiaries.length > 0
      ? item.beneficiaries
          .map((b) => `${b.name} (${b.sharePercent}%)`)
          .join(", ")
      : null;

  const statusVariant =
    item.status === "aktif"
      ? "success"
      : item.status === "kadaluarsa"
        ? "danger"
        : "warning";

  return (
    <Card className="gap-0 p-[18px]">
      <div className="min-w-0">
        <div className="mb-3.5 flex items-center gap-2.5">
          <div
            className="flex size-[38px] shrink-0 items-center justify-center rounded-[10px] text-[17px]"
            style={{ background: iconBg }}
          >
            {icon}
          </div>
          <div className="flex-1">
            <div className="text-[14px] font-bold">{item.name}</div>
            <div className="text-[11px] text-muted-foreground">
              {item.provider ? `${item.provider} · ` : ""}
              {typeLabel}
            </div>
          </div>
          <StatusBadge variant={statusVariant}>{statusLabel}</StatusBadge>
        </div>

        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {item.coverageAmount && (
            <div>
              <div className="mb-[3px] text-[11px] text-muted-foreground">
                {t.asuransi.coverageLabel}
              </div>
              <div className="text-[13.5px] font-bold">
                {formatRupiah(Number(BigInt(item.coverageAmount)))}
              </div>
            </div>
          )}
          <div>
            <div className="mb-[3px] text-[11px] text-muted-foreground">
              {t.asuransi.premiumLabel}
            </div>
            <div className="text-[13.5px] font-bold">
              {formatRupiah(Number(BigInt(item.premiumAmount)))}
              <span className="font-normal text-muted-foreground">
                {periodLabel}
              </span>
            </div>
          </div>
          {item.renewalDate && (
            <div>
              <div className="mb-[3px] text-[11px] text-muted-foreground">
                {t.asuransi.renewalLabel}
              </div>
              <div className="flex items-center gap-1.5">
                <div className="text-[13.5px] font-bold">
                  {formatLocaleDate(item.renewalDate, locale)}
                </div>
                {item.daysUntilRenewal !== null && (
                  <StatusBadge variant={renewalVariant} className="text-[10px]">
                    {item.daysUntilRenewal} {t.asuransi.daysUntilRenewalSuffix}
                  </StatusBadge>
                )}
              </div>
            </div>
          )}
          {item.policyNumber && (
            <div>
              <div className="mb-[3px] text-[11px] text-muted-foreground">
                {t.asuransi.policyNumberLabel}
              </div>
              <div className="text-[13.5px] font-bold">{item.policyNumber}</div>
            </div>
          )}
        </div>

        {beneficiarySummary && (
          <div className="mt-2.5 text-[11.5px] text-muted-foreground">
            <span className="font-semibold">
              {t.asuransi.beneficiariesLabel}:
            </span>{" "}
            {beneficiarySummary}
          </div>
        )}

        {/* EPIC-025 N3 restructure — prototype-parity footer action row
              (primary "Bayar Premi" + labelled Edit/Hapus) replaces the
              icon-only side-column used elsewhere (liabilitas keeps that
              pattern via `CardSideActions`; this page's footer differs by
              design, per the prototype). */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t pt-3">
          <Button
            size="sm"
            onClick={onPay}
            disabled={item.paidThisPeriod}
            title={
              item.paidThisPeriod ? t.asuransi.payAlreadyPaidTooltip : undefined
            }
            className="h-auto px-3 py-[7px] text-[12.5px]"
          >
            {t.asuransi.payButtonLabel}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onEdit}
            className="h-auto px-3 py-[7px] text-[12.5px]"
          >
            <Pencil className="size-3.5" /> {t.asuransi.cardEditButton}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="h-auto px-3 py-[7px] text-[12.5px] text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3.5" /> {t.asuransi.cardDeleteButton}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// EPIC-021 Group D (#14) — one beneficiary row bound to text inputs; parsed
// into a `CreateInsuranceBeneficiaryDto` on save. Mirrors warisan's heir rows.
// `id` is a stable React key (server row id when loaded from an existing
// policy, or a locally-generated one for freshly added blank rows) — TS
// review fix #3, array index is not a stable identity across add/remove.
interface BeneficiaryFormRow {
  id: string;
  name: string;
  relationship: string;
  sharePercent: string;
  memberUserId: string;
}

let beneficiaryRowIdCounter = 0;

function emptyBeneficiaryRow(): BeneficiaryFormRow {
  beneficiaryRowIdCounter += 1;
  return {
    id: `new-beneficiary-${beneficiaryRowIdCounter}`,
    name: "",
    relationship: "",
    sharePercent: "",
    memberUserId: "",
  };
}

function totalAllocated(rows: BeneficiaryFormRow[]): number {
  return rows.reduce((sum, r) => sum + (parseFloat(r.sharePercent) || 0), 0);
}

interface BeneficiaryEditorProps {
  rows: BeneficiaryFormRow[];
  onChange: (rows: BeneficiaryFormRow[]) => void;
  familyMembers: FamilyMember[];
  // EPIC-023 F1 (D14) — true when the members list failed to load (e.g. a
  // dependant/operational role has no "read Member" ability). Honest UI: a
  // silently-empty picker looks identical to "this family has no members",
  // so this note tells the user WHY the picker is unavailable instead of
  // just hiding it.
  membersUnavailable?: boolean;
}

/** Shared allocation-bar + row editor, mirroring warisan's heir editor UX. */
function BeneficiaryEditor({
  rows,
  onChange,
  familyMembers,
  membersUnavailable,
}: BeneficiaryEditorProps) {
  const { t } = useLocale();
  const allocated = Math.min(100, totalAllocated(rows));
  const unallocated = Math.max(0, 100 - totalAllocated(rows));

  function updateRow(id: string, patch: Partial<BeneficiaryFormRow>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div>
      <label className="mb-1.5 block text-[12.5px] font-semibold">
        {t.asuransi.beneficiariesSectionTitle}
      </label>
      <div className="space-y-2.5">
        {rows.map((row) => {
          // EPIC-023 F1 (D14) — once linked, name/relationship are
          // resolved from the member's CURRENT record (not the row's own
          // free-text fields) so the editor never shows a value that would
          // be overwritten the moment the API re-resolves it on the next
          // read (see insurances.service.ts's `MemberLookup`).
          const linkedMember = row.memberUserId
            ? familyMembers.find((m) => m.userId === row.memberUserId)
            : undefined;
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
                  placeholder={t.asuransi.beneficiaryNamePlaceholder}
                  className={`${FIELD_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
                />
                <button
                  type="button"
                  aria-label={t.asuransi.removeBeneficiaryAriaLabel}
                  onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-muted"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
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
                  placeholder={t.asuransi.beneficiaryRelationshipPlaceholder}
                  className={`${FIELD_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={row.sharePercent}
                  onChange={(e) =>
                    updateRow(row.id, { sharePercent: e.target.value })
                  }
                  placeholder={t.asuransi.beneficiarySharePercentLabel}
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
                  aria-label={t.asuransi.beneficiaryMemberLabel}
                >
                  <option value="">
                    {t.asuransi.beneficiaryMemberNoneOption}
                  </option>
                  {familyMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </select>
              ) : (
                membersUnavailable && (
                  <p className="text-[11px] text-muted-foreground">
                    {t.asuransi.beneficiaryMemberPickerUnavailable}
                  </p>
                )
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onChange([...rows, emptyBeneficiaryRow()])}
        className="mt-2 text-[12.5px] font-semibold text-primary"
      >
        {t.asuransi.addBeneficiaryButton}
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
              ? t.asuransi.allocationFullyAllocated
              : `${allocated}${t.asuransi.allocationAllocatedSuffix} · ${unallocated}${t.asuransi.allocationUnallocatedSuffix}`}
          </div>
        </div>
      )}
    </div>
  );
}

interface InsuranceModalProps {
  familyGroupId: string;
  token: string | undefined;
  editing: InsuranceDto | null;
  familyMembers: FamilyMember[];
  membersUnavailable?: boolean;
  onClose: () => void;
}

/**
 * Add + edit policy modal (EPIC-021 Group D #14 unified the previously
 * separate generic edit-modal path into this richer form so beneficiaries —
 * and every other field — are editable in one place, "the policy modal").
 */
function InsuranceModal({
  familyGroupId,
  token,
  editing,
  familyMembers,
  membersUnavailable,
  onClose,
}: InsuranceModalProps) {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = innerRef.current?.querySelector<HTMLElement>(
      'button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    first?.focus();
    return () => {
      prev?.focus();
    };
  }, []);

  const [name, setName] = useState(editing?.name ?? "");
  const [provider, setProvider] = useState(editing?.provider ?? "");
  const [type, setType] = useState<InsuranceType>(editing?.type ?? "jiwa");
  const [status, setStatus] = useState<InsuranceStatus>(
    editing?.status ?? "aktif",
  );
  const [premiumAmount, setPremiumAmount] = useState(
    editing ? String(Number(BigInt(editing.premiumAmount))) : "",
  );
  const [premiumPeriod, setPremiumPeriod] = useState<PremiumPeriod>(
    editing?.premiumPeriod ?? "monthly",
  );
  const [coverageAmount, setCoverageAmount] = useState(
    editing?.coverageAmount
      ? String(Number(BigInt(editing.coverageAmount)))
      : "",
  );
  const [renewalDate, setRenewalDate] = useState(
    editing?.renewalDate ? editing.renewalDate.slice(0, 10) : "",
  );
  const [autoRenewDate, setAutoRenewDate] = useState(
    editing?.autoRenewDate ?? false,
  );
  const [policyNumber, setPolicyNumber] = useState(editing?.policyNumber ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryFormRow[]>(
    editing?.beneficiaries.map((b) => ({
      id: b.id,
      name: b.name,
      relationship: b.relationship,
      sharePercent: b.sharePercent,
      memberUserId: b.memberUserId ?? "",
    })) ?? [],
  );

  const mutation = useMutation({
    mutationFn: (dto: CreateInsuranceDto | UpdateInsuranceDto) =>
      editing
        ? apiFetch<InsuranceDto>(
            `/family-groups/${familyGroupId}/insurances/${editing.id}`,
            { method: "PATCH", token, body: JSON.stringify(dto) },
          )
        : apiFetch<InsuranceDto>(`/family-groups/${familyGroupId}/insurances`, {
            method: "POST",
            token,
            body: JSON.stringify(dto),
          }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.insurances.all(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.insurances.summary(familyGroupId),
      });
      toast.success(editing ? t.asuransi.toastUpdated : t.asuransi.toastAdded);
    },
  });

  const {
    isSuccess,
    isError: isMutationError,
    error: mutationError,
  } = mutation;

  useEffect(() => {
    if (isSuccess) onClose();
  }, [isSuccess, onClose]);

  useEffect(() => {
    if (isMutationError) {
      const apiErr = mutationError as { message?: string };
      const fallback = editing
        ? t.asuransi.toastUpdateFailed
        : t.asuransi.toastAddFailed;
      toast.error(apiErr.message ?? fallback);
    }
  }, [isMutationError, mutationError, t, editing]);

  function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.warning(t.asuransi.validationNameRequired);
      return;
    }
    const parsedPremium = parseRupiah(premiumAmount);
    if (parsedPremium <= 0) {
      toast.warning(t.asuransi.validationPremiumPositive);
      return;
    }

    const beneficiaryDtos: CreateInsuranceBeneficiaryDto[] = beneficiaries
      .filter((b) => b.name.trim())
      .map((b) => ({
        name: b.name.trim(),
        relationship: b.relationship.trim(),
        sharePercent: parseFloat(b.sharePercent) || 0,
        ...(b.memberUserId && { memberUserId: b.memberUserId }),
      }));
    if (beneficiaryDtos.reduce((sum, b) => sum + b.sharePercent, 0) > 100) {
      toast.warning(t.asuransi.validationSharePercentExceeded);
      return;
    }

    const dto: CreateInsuranceDto = {
      name: trimmedName,
      type,
      status,
      premiumAmount: String(parsedPremium),
      premiumPeriod,
      ...(provider.trim() && { provider: provider.trim() }),
      ...(coverageAmount && {
        coverageAmount: String(parseRupiah(coverageAmount)),
      }),
      ...(renewalDate && { renewalDate, autoRenewDate }),
      ...(policyNumber.trim() && { policyNumber: policyNumber.trim() }),
      ...(notes.trim() && { notes: notes.trim() }),
      beneficiaries: beneficiaryDtos,
    };

    mutation.mutate(dto);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-insurance-title"
    >
      {/* EPIC-022 Group G (G1) — `dvh`, not `vh`: hand-rolled, does not
          inherit components/ui/dialog.tsx's DialogContent default, so this
          unit must be kept correct independently (see that file's comment
          for why `vh` under-caps on a real mobile browser). */}
      <div
        ref={innerRef}
        className="max-h-[85dvh] w-full max-w-[480px] overflow-y-auto rounded-[16px] bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="add-insurance-title" className="text-[17px] font-extrabold">
            {editing ? t.asuransi.modalEditTitle : t.asuransi.modalTitle}
          </h2>
          <button
            type="button"
            aria-label={t.asuransi.modalCloseAriaLabel}
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3.5">
          <div>
            <label
              htmlFor="ins-name"
              className="mb-1.5 block text-[12.5px] font-semibold"
            >
              {t.asuransi.fieldNameLabel}
            </label>
            <input
              id="ins-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.asuransi.fieldNamePlaceholder}
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <label
              htmlFor="ins-provider"
              className="mb-1.5 block text-[12.5px] font-semibold"
            >
              {t.asuransi.fieldProviderLabel}
            </label>
            <input
              id="ins-provider"
              type="text"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder={t.asuransi.fieldProviderPlaceholder}
              className={FIELD_CLASS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="ins-type"
                className="mb-1.5 block text-[12.5px] font-semibold"
              >
                {t.asuransi.fieldTypeLabel}
              </label>
              <select
                id="ins-type"
                value={type}
                onChange={(e) => setType(e.target.value as InsuranceType)}
                className={FIELD_CLASS}
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {t.asuransi.typeLabels[opt]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="ins-status"
                className="mb-1.5 block text-[12.5px] font-semibold"
              >
                {t.asuransi.fieldStatusLabel}
              </label>
              <select
                id="ins-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as InsuranceStatus)}
                className={FIELD_CLASS}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {t.asuransi.statusLabels[opt]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="ins-premium"
              className="mb-1.5 block text-[12.5px] font-semibold"
            >
              {t.asuransi.fieldPremiumLabel}
            </label>
            <div className="flex items-center gap-2 rounded-md border bg-background px-3.5 py-2.5 transition-colors focus-within:border-primary focus-within:bg-card">
              <span className="text-[13.5px] text-muted-foreground">Rp</span>
              <input
                id="ins-premium"
                type="text"
                inputMode="numeric"
                value={premiumAmount}
                onChange={(e) =>
                  setPremiumAmount(formatAmountInput(e.target.value))
                }
                placeholder="0"
                className="w-full bg-transparent text-[13.5px] outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="ins-period"
              className="mb-1.5 block text-[12.5px] font-semibold"
            >
              {t.asuransi.fieldPeriodLabel}
            </label>
            <select
              id="ins-period"
              value={premiumPeriod}
              onChange={(e) =>
                setPremiumPeriod(e.target.value as PremiumPeriod)
              }
              className={FIELD_CLASS}
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {t.asuransi.periodOptionLabels[opt]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="ins-coverage"
              className="mb-1.5 block text-[12.5px] font-semibold"
            >
              {t.asuransi.fieldCoverageLabel}
            </label>
            <div className="flex items-center gap-2 rounded-md border bg-background px-3.5 py-2.5 transition-colors focus-within:border-primary focus-within:bg-card">
              <span className="text-[13.5px] text-muted-foreground">Rp</span>
              <input
                id="ins-coverage"
                type="text"
                inputMode="numeric"
                value={coverageAmount}
                onChange={(e) =>
                  setCoverageAmount(formatAmountInput(e.target.value))
                }
                placeholder="0"
                className="w-full bg-transparent text-[13.5px] outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="ins-renewal"
              className="mb-1.5 block text-[12.5px] font-semibold"
            >
              {t.asuransi.fieldRenewalDateLabel}
            </label>
            <input
              id="ins-renewal"
              type="date"
              value={renewalDate}
              onChange={(e) => setRenewalDate(e.target.value)}
              className={FIELD_CLASS}
            />
            {renewalDate && (
              <label className="mt-2 flex items-center gap-2 text-[12px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={autoRenewDate}
                  onChange={(e) => setAutoRenewDate(e.target.checked)}
                  className="size-3.5"
                />
                {t.asuransi.autoRenewLabel}
              </label>
            )}
          </div>

          <div>
            <label
              htmlFor="ins-policy-number"
              className="mb-1.5 block text-[12.5px] font-semibold"
            >
              {t.asuransi.policyNumberLabel}
            </label>
            <input
              id="ins-policy-number"
              type="text"
              value={policyNumber}
              onChange={(e) => setPolicyNumber(e.target.value)}
              placeholder={t.asuransi.fieldPolicyNumberPlaceholder}
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <label
              htmlFor="ins-notes"
              className="mb-1.5 block text-[12.5px] font-semibold"
            >
              {t.asuransi.fieldNotesLabel}
            </label>
            <textarea
              id="ins-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={t.asuransi.fieldNotesPlaceholder}
              className={`${FIELD_CLASS} resize-none`}
            />
          </div>

          <BeneficiaryEditor
            rows={beneficiaries}
            onChange={setBeneficiaries}
            familyMembers={familyMembers}
            membersUnavailable={membersUnavailable}
          />

          <Button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="w-full"
          >
            {mutation.isPending ? t.asuransi.saving : t.asuransi.saveButton}
          </Button>
        </div>
      </div>
    </div>
  );
}

// EPIC-023 E2 — mirrors `transaction-dialog.tsx`'s local `AccountDto` shape;
// only the fields the source-account picker needs.
type AccountDto = { id: string; name: string; institution: string | null };

/**
 * "Bayar" confirm dialog (EPIC-016 Task H, EPIC-023 E2) — records a REAL
 * premium payment: debits the chosen source account, posts a linked
 * transaction, and advances `renewalDate` by one premium period, via
 * `POST .../insurances/:id/pay` (`InsurancesService.pay()`). Previously this
 * dialog only PATCHed `renewalDate` and moved no money — that docblock is
 * now stale and has been corrected along with the behavior (Honest UI
 * mandate: a control must do what it says).
 */
function PayInsuranceDialog({
  item,
  accounts,
  sourceAccountId,
  onSourceAccountChange,
  isPending,
  onClose,
  onConfirm,
}: {
  item: InsuranceDto | null;
  accounts: AccountDto[];
  sourceAccountId: string;
  onSourceAccountChange: (id: string) => void;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useLocale();
  const periodLabel = item
    ? (t.asuransi.periodSuffixLabels[item.premiumPeriod] ?? "")
    : "";
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogTitle className="text-[17px] font-extrabold">
          {t.asuransi.payDialogTitle}
        </DialogTitle>
        {item && (
          <div className="space-y-3 text-[13px]">
            <div className="rounded-lg bg-muted p-3.5">
              <div className="text-[11px] text-muted-foreground">
                {t.asuransi.premiumLabel}
              </div>
              <div className="text-[18px] font-black">
                {formatRupiah(Number(BigInt(item.premiumAmount)))}
                <span className="ml-1 text-[12px] font-normal text-muted-foreground">
                  {periodLabel}
                </span>
              </div>
            </div>
            <div>
              <label
                htmlFor="pay-insurance-source-account"
                className="mb-1.5 block text-[12.5px] font-semibold"
              >
                {t.asuransi.paySourceAccountLabel}
              </label>
              <select
                id="pay-insurance-source-account"
                value={sourceAccountId}
                onChange={(e) => onSourceAccountChange(e.target.value)}
                className={FIELD_CLASS}
              >
                <option value="">
                  {t.asuransi.paySourceAccountPlaceholder}
                </option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.institution ? ` (${a.institution})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-muted-foreground">
              {t.asuransi.payConfirmPrefix}
              {item.name}
              {t.asuransi.payConfirmSuffix}
            </p>
          </div>
        )}
        <div className="flex gap-2.5 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            className="flex-1"
            disabled={isPending || !sourceAccountId}
            onClick={onConfirm}
          >
            {isPending ? t.asuransi.payProcessing : t.asuransi.payConfirmButton}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * EPIC-025 N3 restructure — lightweight "pick a policy first" step used by
 * both header actions ("Bayar Premi" and beneficiaries section's "+ Tambah
 * Ahli Waris"): the prototype's header actions assume one policy is already
 * in context; the real page has N policies, so pick one, then hand off to
 * the existing real flow (`PayInsuranceDialog` / `InsuranceModal` editing).
 */
function PolicyPickerDialog({
  open,
  title,
  emptyLabel,
  policies,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  emptyLabel: string;
  policies: InsuranceDto[];
  onClose: () => void;
  onConfirm: (policy: InsuranceDto) => void;
}) {
  const { t } = useLocale();
  const [selectedId, setSelectedId] = useState("");

  function handleClose() {
    setSelectedId("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogTitle className="text-[17px] font-extrabold">
          {title}
        </DialogTitle>
        {policies.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">{emptyLabel}</p>
        ) : (
          <div className="space-y-3">
            <label
              htmlFor="policy-picker-select"
              className="block text-[12.5px] font-semibold"
            >
              {t.asuransi.policyPickerLabel}
            </label>
            <select
              id="policy-picker-select"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className={FIELD_CLASS}
            >
              <option value="">{t.asuransi.policyPickerPlaceholder}</option>
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex gap-2.5 pt-2">
          <Button variant="outline" className="flex-1" onClick={handleClose}>
            {t.common.cancel}
          </Button>
          {policies.length > 0 && (
            <Button
              className="flex-1"
              disabled={!selectedId}
              onClick={() => {
                const picked = policies.find((p) => p.id === selectedId);
                if (picked) {
                  setSelectedId("");
                  onConfirm(picked);
                }
              }}
            >
              {t.asuransi.policyPickerConfirm}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AsuransiPage() {
  const { t, locale } = useLocale();
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  const familyGroupId = session?.familyGroupId as string | undefined;
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InsuranceDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InsuranceDto | null>(null);
  const [payTarget, setPayTarget] = useState<InsuranceDto | null>(null);
  const [paySourceAccountId, setPaySourceAccountId] = useState("");
  // EPIC-025 N3 restructure — header "Bayar Premi" / beneficiaries-section
  // "+ Tambah Ahli Waris" both need a policy picked first (the prototype's
  // header action opens a dialog with a "Polis" dropdown); both reuse the
  // same lightweight picker.
  const [payPolicyPicker, setPayPolicyPicker] = useState(false);
  const [beneficiaryPolicyPicker, setBeneficiaryPolicyPicker] = useState(false);
  // EPIC-026 Wave 5 — the prototype's beneficiary table has a per-row
  // delete action; implemented against the real API below (see
  // `removeBeneficiaryMutation`).
  const [deleteBeneficiaryTarget, setDeleteBeneficiaryTarget] = useState<{
    policy: InsuranceDto;
    beneficiary: InsuranceDto["beneficiaries"][number];
  } | null>(null);

  // EPIC-023 E2 — source-account picker for the real premium payment.
  const { data: accounts = [] } = useQuery<AccountDto[]>({
    queryKey: queryKeys.accounts.all(familyGroupId ?? ""),
    queryFn: () =>
      apiFetch<AccountDto[]>(`/family-groups/${familyGroupId}/accounts`, {
        token,
      }),
    enabled: Boolean(familyGroupId) && Boolean(token),
  });

  // EPIC-021 Group D (#14) — family members for the beneficiary's optional
  // "link to a family-group member" picker. EPIC-023 F1 (D14) — `isError`
  // drives the honest-UI note in BeneficiaryEditor for roles (dependant/
  // operational) that hold no "read Member" ability, instead of a
  // silently-empty picker indistinguishable from "no members exist".
  const { data: familyMembers = [], isError: isFamilyMembersError } = useQuery<
    FamilyMember[],
    ApiError
  >({
    queryKey: [...queryKeys.familyGroups.members(familyGroupId ?? ""), token],
    queryFn: () =>
      apiFetch<FamilyMember[]>(`/family-groups/${familyGroupId}/members`, {
        token,
      }),
    enabled: Boolean(familyGroupId) && Boolean(token),
    retry: false,
  });

  // EPIC-023 E2 — calls the REAL pay endpoint (`InsurancesService.pay()`):
  // debits `paySourceAccountId`, posts a linked transaction, and advances
  // `renewalDate` — replaces the old renewalDate-only PATCH.
  const payMutation = useMutation({
    mutationFn: (params: { item: InsuranceDto; sourceAccountId: string }) =>
      apiFetch<InsuranceDto>(
        `/family-groups/${familyGroupId}/insurances/${params.item.id}/pay`,
        {
          token,
          method: "POST",
          body: JSON.stringify({ sourceAccountId: params.sourceAccountId }),
        },
      ),
    onSuccess: (updated) => {
      const fgId = familyGroupId ?? "";
      void queryClient.invalidateQueries({
        queryKey: queryKeys.insurances.all(fgId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.insurances.summary(fgId),
      });
      // Mirrors transaction-dialog.tsx's invalidation set — paying moves
      // money, changes account balances, and touches budgets/reports/net
      // worth the same way a normal transaction does.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.budgets.all(fgId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.accounts.all(fgId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.summary(fgId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.netWorth.summary(fgId),
      });
      void queryClient.invalidateQueries({ queryKey: ["reports", fgId] });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.transactions.all(fgId),
      });
      setPayTarget(null);
      setPaySourceAccountId("");
      toast.success(
        updated.renewalDate
          ? `${t.asuransi.toastRenewalRecordedPrefix}${formatLocaleDate(updated.renewalDate, locale)}`
          : t.asuransi.toastPaySuccessNoRenewal,
      );
    },
    onError: (err: { message?: string }) =>
      toast.error(err.message ?? t.asuransi.toastRenewalFailed),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/family-groups/${familyGroupId}/insurances/${id}`, {
        method: "DELETE",
        token,
      }).catch((err: unknown) => {
        // DELETE returns 204 No Content — apiFetch's res.json() rejects on the
        // empty body; real API errors carry a `status` and must keep throwing.
        if (err && typeof err === "object" && "status" in err) throw err;
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.insurances.all(familyGroupId ?? ""),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.insurances.summary(familyGroupId ?? ""),
      });
      toast.success(t.asuransi.toastDeleted);
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? t.asuransi.toastDeleteFailed);
    },
  });

  // EPIC-026 Wave 5 — real per-row beneficiary removal: the API's
  // `UpdateInsuranceDto.beneficiaries` REPLACES the policy's beneficiary
  // rows wholesale (insurances.service.ts `runUpdate` does deleteMany +
  // create), so deleting one row = PATCH with the remaining rows mapped
  // back to `CreateInsuranceBeneficiaryDto`.
  const removeBeneficiaryMutation = useMutation({
    mutationFn: (params: { policy: InsuranceDto; beneficiaryId: string }) =>
      apiFetch<InsuranceDto>(
        `/family-groups/${familyGroupId}/insurances/${params.policy.id}`,
        {
          method: "PATCH",
          token,
          body: JSON.stringify({
            beneficiaries: params.policy.beneficiaries
              .filter((b) => b.id !== params.beneficiaryId)
              .map((b) => ({
                name: b.name,
                relationship: b.relationship,
                sharePercent: Number(b.sharePercent),
                ...(b.memberUserId && { memberUserId: b.memberUserId }),
              })),
          }),
        },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.insurances.all(familyGroupId ?? ""),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.insurances.summary(familyGroupId ?? ""),
      });
      toast.success("Ahli waris dihapus");
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? t.asuransi.toastUpdateFailed);
    },
  });

  const {
    data: insurances,
    isLoading,
    isError,
  } = useQuery<InsuranceDto[]>({
    queryKey: queryKeys.insurances.all(familyGroupId ?? ""),
    queryFn: ({ signal }) => {
      if (!familyGroupId) throw new Error("familyGroupId not available");
      return apiFetch<InsuranceDto[]>(
        `/family-groups/${familyGroupId}/insurances`,
        { token, signal },
      );
    },
    enabled: Boolean(familyGroupId) && Boolean(token),
  });

  const { data: summary } = useQuery<InsuranceSummaryDto>({
    queryKey: queryKeys.insurances.summary(familyGroupId ?? ""),
    queryFn: ({ signal }) => {
      if (!familyGroupId) throw new Error("familyGroupId not available");
      return apiFetch<InsuranceSummaryDto>(
        `/family-groups/${familyGroupId}/insurances/summary`,
        { token, signal },
      );
    },
    enabled: Boolean(familyGroupId) && Boolean(token),
  });

  const activePolicies = summary?.activePolicies ?? 0;
  const totalMonthlyPremium = summary?.totalMonthlyPremium
    ? formatRupiah(Number(BigInt(summary.totalMonthlyPremium)))
    : "Rp 0";

  // EPIC-025 N3-F3 — coverage-by-type donut (FOLD): derived from the
  // already-fetched `insurances` list, same coverageAmount PolicyCard
  // already renders per row. The prototype's "Premi 6 Bulan Terakhir"
  // trend chart is CUT (J1 — prototype-invented, no premium-history
  // concept exists in the backend).
  const coverageByType = new Map<string, bigint>();
  for (const item of insurances ?? []) {
    if (!item.coverageAmount) continue;
    const label = t.asuransi.typeLabels[item.type] ?? item.type;
    coverageByType.set(
      label,
      (coverageByType.get(label) ?? BigInt(0)) + BigInt(item.coverageAmount),
    );
  }
  const coverageSegments: DonutSegment[] = (insurances ?? [])
    .reduce<{ type: string; label: string }[]>((acc, item) => {
      if (acc.some((a) => a.type === item.type)) return acc;
      return [
        ...acc,
        {
          type: item.type,
          label: t.asuransi.typeLabels[item.type] ?? item.type,
        },
      ];
    }, [])
    .map(({ type, label }) => ({
      label,
      value: Number(coverageByType.get(label) ?? BigInt(0)),
      color: INSURANCE_TYPE_DONUT_COLOR[type] ?? "#6B7280",
    }))
    .filter((seg) => seg.value > 0);

  // Real nearest-renewal warning — the prototype hardcodes one policy's
  // name/date; here it's the actual soonest-renewing active policy, or
  // nothing at all when none is within 30 days.
  const nearestRenewal = (insurances ?? [])
    .filter((item) => item.status === "aktif" && item.daysUntilRenewal !== null)
    .sort((a, b) => (a.daysUntilRenewal ?? 0) - (b.daysUntilRenewal ?? 0))[0];
  const showRenewalWarning =
    nearestRenewal && (nearestRenewal.daysUntilRenewal ?? 999) <= 30;

  // EPIC-025 N3 restructure — total pertanggungan (real header subtitle
  // segment), summed across active policies from the already-fetched list —
  // no new endpoint (the backend summary DTO only carries premium totals).
  const totalCoverageAktif = (insurances ?? [])
    .filter((item) => item.status === "aktif" && item.coverageAmount)
    .reduce((sum, item) => sum + BigInt(item.coverageAmount!), BigInt(0));

  // EPIC-025 N3 restructure — policies eligible for the header "Bayar
  // Premi" picker (active, not already paid this period).
  const payablePolicies = (insurances ?? []).filter(
    (item) => item.status === "aktif" && !item.paidThisPeriod,
  );

  // EPIC-025 N3 restructure — "Ahli Waris Asuransi" section: aggregated
  // beneficiary rows across every policy, from the already-fetched
  // `insurances` list (beneficiaries genuinely exist on `InsuranceDto` —
  // this is the same data `PolicyCard`'s `beneficiarySummary` already
  // reads, just presented as a table instead of a summary line).
  const beneficiaryRows = (insurances ?? []).flatMap((policy) =>
    policy.beneficiaries.map((b) => ({
      policy,
      beneficiary: b,
      linkedMember: b.memberUserId
        ? (familyMembers.find((m) => m.userId === b.memberUserId) ?? null)
        : null,
      estimatedBenefit: policy.coverageAmount
        ? (BigInt(policy.coverageAmount) *
            BigInt(Math.round(Number(b.sharePercent) * 100))) /
          BigInt(10000)
        : null,
    })),
  );
  // Only surface the "fully allocated" callout when it is unambiguous —
  // exactly one policy carries beneficiaries and their shares sum to 100%.
  // With several policies in play, a single blanket notice would misname
  // which policy it refers to (Honest UI), so it's silently omitted then.
  const policiesWithBeneficiaries = (insurances ?? []).filter(
    (p) => p.beneficiaries.length > 0,
  );
  const soleFullyAllocatedPolicy =
    policiesWithBeneficiaries.length === 1 &&
    policiesWithBeneficiaries[0]!.beneficiaries.reduce(
      (sum, b) => sum + Number(b.sharePercent),
      0,
    ) >= 100
      ? policiesWithBeneficiaries[0]!
      : null;

  return (
    <div className="space-y-4">
      {/* EPIC-025 N3 restructure — page header (H1 + accent underline +
          real subtitle) and the header action row. */}
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div>
          <h1 className="relative inline-block pb-2 text-[19px] font-extrabold tracking-tight">
            {t.shell.pageTitles.asuransi}
            <span className="absolute bottom-0 left-0 h-[3px] w-[42px] rounded-full bg-gradient-to-r from-primary to-brand-purple" />
          </h1>
          <div className="mt-1 text-xs text-muted-foreground">
            {activePolicies} {t.asuransi.activePoliciesSuffix}
            {" · "}
            {t.asuransi.totalPremiumPrefix} {totalMonthlyPremium}
            {t.asuransi.periodSuffixLabels.monthly}
            {totalCoverageAktif > BigInt(0) && (
              <>
                {" · "}
                {t.asuransi.totalCoveragePrefix}{" "}
                {formatRupiah(Number(totalCoverageAktif))}
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPayPolicyPicker(true)}
            disabled={!familyGroupId}
            className="h-auto px-4 py-[9px]"
          >
            <Banknote className="size-4" /> {t.asuransi.payButtonLabel}
          </Button>
          <Button
            onClick={() => setShowModal(true)}
            disabled={!familyGroupId}
            className="h-auto px-4 py-[9px]"
          >
            <Plus className="size-4" /> {t.common.add}
          </Button>
        </div>
      </div>

      {isError && (
        <div
          role="alert"
          className="rounded-[14px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive"
        >
          {t.asuransi.errorLoad}
        </div>
      )}

      {/* Coverage-by-type donut (FOLD per J3-adjacent decision — derived
          from data already fetched below; premium-history trend CUT per
          J1). Constrained to a sensible width now that it no longer shares
          the prototype's 2-col grid with the (cut) premium-history chart. */}
      {!isLoading && !isError && coverageSegments.length > 0 && (
        <SectionCard
          title={t.asuransi.coverageAllocationTitle}
          className="md:max-w-md"
        >
          <DonutChart
            segments={coverageSegments}
            centerLabel={t.asuransi.coverageLabel}
            ariaLabel={`${t.asuransi.coverageAllocationTitle}: ${coverageSegments.map((s) => `${s.label} ${formatRupiah(s.value)}`).join(", ")}`}
          />
        </SectionCard>
      )}

      {/* Real nearest-renewal warning — never a hardcoded policy/date. */}
      {!isLoading && !isError && showRenewalWarning && nearestRenewal && (
        <div className="flex items-center gap-2.5 rounded-[11px] border border-warning/35 bg-warning-soft p-3 text-[12.5px] text-warning">
          <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
          <span>
            {t.asuransi.renewalWarningPrefix}{" "}
            <strong>{nearestRenewal.name}</strong>{" "}
            {t.asuransi.renewalWarningSuffix}{" "}
            {formatLocaleDate(nearestRenewal.renewalDate, locale)} —{" "}
            {nearestRenewal.daysUntilRenewal}{" "}
            {t.asuransi.renewalWarningDaysLeftSuffix}.
          </span>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <PolicyCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!isLoading && !isError && insurances?.length === 0 && (
        <div className="rounded-[14px] border bg-card px-4 py-8 text-center text-[13px] text-muted-foreground">
          {t.asuransi.emptyState}
        </div>
      )}

      {!isLoading && !isError && insurances && insurances.length > 0 && (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {insurances.map((item) => (
            <PolicyCard
              key={item.id}
              item={item}
              onEdit={() => setEditingItem(item)}
              onPay={() => setPayTarget(item)}
              onDelete={() => setDeleteTarget(item)}
            />
          ))}
        </div>
      )}

      {/* EPIC-025 N3 restructure — "Ahli Waris Asuransi" aggregated table.
          Beneficiaries genuinely exist on `InsuranceDto` (same data
          `PolicyCard`'s summary line already reads); this only presents it
          as a table instead of inventing a separate beneficiary store. */}
      {!isLoading && !isError && beneficiaryRows.length > 0 && (
        <SectionCard
          title={t.asuransi.beneficiariesSectionTitle}
          action={
            <button
              type="button"
              aria-label={t.asuransi.addBeneficiaryHeaderAriaLabel}
              onClick={() => setBeneficiaryPolicyPicker(true)}
              className="text-xs font-semibold whitespace-nowrap text-primary hover:underline"
            >
              {t.asuransi.addBeneficiaryButton}
            </button>
          }
        >
          {soleFullyAllocatedPolicy && (
            <div className="mb-3 flex items-center gap-2.5 rounded-[11px] border border-primary/20 bg-accent p-3 text-[12.5px]">
              <span>
                <strong>{t.asuransi.allocationFullyAllocated}</strong>{" "}
                {t.asuransi.beneficiaryTablePolicyPrefix}{" "}
                {soleFullyAllocatedPolicy.name}
              </span>
            </div>
          )}
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[640px] text-[12.5px]">
              <thead>
                <tr className="border-b text-left text-[11px] text-muted-foreground">
                  <th className="pb-2 pr-3 font-semibold">
                    {t.asuransi.beneficiaryTableHeaderName}
                  </th>
                  <th className="pb-2 pr-3 font-semibold">
                    {t.asuransi.beneficiaryTableHeaderRelationship}
                  </th>
                  <th className="pb-2 pr-3 font-semibold">
                    {t.asuransi.beneficiaryTableHeaderMember}
                  </th>
                  <th className="pb-2 pr-3 font-semibold">
                    {t.asuransi.beneficiaryTableHeaderPercent}
                  </th>
                  <th className="pb-2 pr-3 font-semibold">
                    {t.asuransi.beneficiaryTableHeaderBenefit}
                  </th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {beneficiaryRows.map(
                  ({ policy, beneficiary, linkedMember, estimatedBenefit }) => {
                    const initials = beneficiary.name
                      .split(" ")
                      .slice(0, 2)
                      .map((w) => w[0]?.toUpperCase() ?? "")
                      .join("");
                    return (
                      <tr
                        key={beneficiary.id}
                        className="border-b last:border-0"
                      >
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                              style={{
                                background:
                                  "linear-gradient(135deg,var(--primary),var(--brand-purple))",
                              }}
                            >
                              {initials}
                            </div>
                            <div>
                              <div className="font-semibold">
                                {beneficiary.name}
                              </div>
                              <div className="text-[10.5px] text-muted-foreground">
                                {t.asuransi.beneficiaryTablePolicyPrefix}{" "}
                                {policy.name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3">
                          {beneficiary.relationship}
                        </td>
                        <td className="py-2.5 pr-3">
                          {linkedMember ? (
                            <StatusBadge variant="info">
                              {linkedMember.name}
                            </StatusBadge>
                          ) : (
                            <span className="text-muted-foreground">
                              {t.asuransi.beneficiaryMemberNoneOption}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="mono font-bold">
                              {beneficiary.sharePercent}%
                            </span>
                            <span className="h-1.5 w-[70px] overflow-hidden rounded-full bg-muted">
                              <span
                                className="block h-full rounded-full bg-primary"
                                style={{
                                  width: `${Math.min(100, Number(beneficiary.sharePercent))}%`,
                                }}
                              />
                            </span>
                          </div>
                        </td>
                        <td className="mono py-2.5 pr-3">
                          {estimatedBenefit !== null
                            ? formatRupiah(Number(estimatedBenefit))
                            : "—"}
                        </td>
                        <td className="py-2.5">
                          <button
                            type="button"
                            aria-label={`${t.asuransi.removeBeneficiaryAriaLabel} ${beneficiary.name}`}
                            disabled={removeBeneficiaryMutation.isPending}
                            onClick={() =>
                              setDeleteBeneficiaryTarget({
                                policy,
                                beneficiary,
                              })
                            }
                            className="flex size-7 items-center justify-center rounded-full text-destructive hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {showModal && familyGroupId && (
        <InsuranceModal
          familyGroupId={familyGroupId}
          token={token}
          editing={null}
          familyMembers={familyMembers}
          membersUnavailable={isFamilyMembersError}
          onClose={() => setShowModal(false)}
        />
      )}

      {editingItem && familyGroupId && (
        <InsuranceModal
          familyGroupId={familyGroupId}
          token={token}
          editing={editingItem}
          familyMembers={familyMembers}
          membersUnavailable={isFamilyMembersError}
          onClose={() => setEditingItem(null)}
        />
      )}

      <ConfirmDeleteDialog
        label={deleteTarget ? t.shell.navSections.asuransi : null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
      {/* EPIC-026 Wave 5 — per-row beneficiary delete confirmation. */}
      <ConfirmDeleteDialog
        label={
          deleteBeneficiaryTarget
            ? `"${deleteBeneficiaryTarget.beneficiary.name}"`
            : null
        }
        onClose={() => setDeleteBeneficiaryTarget(null)}
        onConfirm={() => {
          if (deleteBeneficiaryTarget) {
            removeBeneficiaryMutation.mutate({
              policy: deleteBeneficiaryTarget.policy,
              beneficiaryId: deleteBeneficiaryTarget.beneficiary.id,
            });
          }
        }}
      />
      <PayInsuranceDialog
        item={payTarget}
        accounts={accounts}
        sourceAccountId={paySourceAccountId}
        onSourceAccountChange={setPaySourceAccountId}
        isPending={payMutation.isPending}
        onClose={() => {
          setPayTarget(null);
          setPaySourceAccountId("");
        }}
        onConfirm={() => {
          if (payTarget && paySourceAccountId) {
            payMutation.mutate({
              item: payTarget,
              sourceAccountId: paySourceAccountId,
            });
          }
        }}
      />

      {/* EPIC-025 N3 restructure — header "Bayar Premi" picks a policy
          first, then hands off to the existing `PayInsuranceDialog` flow
          above (same mutation, same source-account picker). */}
      <PolicyPickerDialog
        open={payPolicyPicker}
        title={t.asuransi.policyPickerPayTitle}
        emptyLabel={t.asuransi.policyPickerPayEmpty}
        policies={payablePolicies}
        onClose={() => setPayPolicyPicker(false)}
        onConfirm={(policy) => {
          setPayPolicyPicker(false);
          setPayTarget(policy);
        }}
      />

      {/* EPIC-025 N3 restructure — beneficiaries section's "+ Tambah Ahli
          Waris" picks a policy first, then hands off to the existing
          `InsuranceModal` edit flow (its `BeneficiaryEditor` already adds
          rows against a real `PATCH .../insurances/:id`). */}
      <PolicyPickerDialog
        open={beneficiaryPolicyPicker}
        title={t.asuransi.policyPickerBeneficiaryTitle}
        emptyLabel={t.asuransi.policyPickerBeneficiaryEmpty}
        policies={insurances ?? []}
        onClose={() => setBeneficiaryPolicyPicker(false)}
        onConfirm={(policy) => {
          setBeneficiaryPolicyPicker(false);
          setEditingItem(policy);
        }}
      />
    </div>
  );
}
