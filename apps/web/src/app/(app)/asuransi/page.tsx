"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/wm";
import { CardSideActions, ConfirmDeleteDialog } from "@/components/crud";
import { useLocale } from "@/hooks/use-locale";
import type { Locale } from "@/i18n";
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
  PremiumPeriod,
  UpdateInsuranceDto,
} from "@wealthme/contracts";

// EPIC-021 Group D (#14) — mirrors the `FamilyMember` shape used on /akun for
// the optional "link a beneficiary to a family member" picker.
type FamilyMember = {
  id: string;
  userId: string;
  name: string;
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
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
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
      <div className="flex items-stretch gap-3">
        <div className="min-w-0 flex-1">
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

          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
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
                    <StatusBadge
                      variant={renewalVariant}
                      className="text-[10px]"
                    >
                      {item.daysUntilRenewal}{" "}
                      {t.asuransi.daysUntilRenewalSuffix}
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
                <div className="text-[13.5px] font-bold">
                  {item.policyNumber}
                </div>
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
        </div>
        <CardSideActions onEdit={onEdit} onPay={onPay} onDelete={onDelete} />
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
}

/** Shared allocation-bar + row editor, mirroring warisan's heir editor UX. */
function BeneficiaryEditor({
  rows,
  onChange,
  familyMembers,
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
        {rows.map((row) => (
          <div
            key={row.id}
            className="space-y-2 rounded-md border bg-background p-3"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={row.name}
                onChange={(e) => updateRow(row.id, { name: e.target.value })}
                placeholder={t.asuransi.beneficiaryNamePlaceholder}
                className={FIELD_CLASS}
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
                value={row.relationship}
                onChange={(e) =>
                  updateRow(row.id, { relationship: e.target.value })
                }
                placeholder={t.asuransi.beneficiaryRelationshipPlaceholder}
                className={FIELD_CLASS}
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
            {familyMembers.length > 0 && (
              <select
                value={row.memberUserId}
                onChange={(e) =>
                  updateRow(row.id, { memberUserId: e.target.value })
                }
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
            )}
          </div>
        ))}
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
  // "link to a family-group member" picker.
  const { data: familyMembers = [] } = useQuery<FamilyMember[]>({
    queryKey: [...queryKeys.familyGroups.members(familyGroupId ?? ""), token],
    queryFn: () =>
      apiFetch<FamilyMember[]>(`/family-groups/${familyGroupId}/members`, {
        token,
      }),
    enabled: Boolean(familyGroupId) && Boolean(token),
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <div className="text-[15px] font-bold">
            {activePolicies} {t.asuransi.activePoliciesSuffix}
          </div>
          <div className="text-xs text-muted-foreground">
            {t.asuransi.totalPremiumPrefix} {totalMonthlyPremium}
            {t.asuransi.periodSuffixLabels.monthly}
          </div>
        </div>
        <Button
          onClick={() => setShowModal(true)}
          disabled={!familyGroupId}
          className="h-auto px-4 py-[9px]"
          data-tour="add-asuransi"
        >
          <Plus className="size-4" /> {t.common.add}
        </Button>
      </div>

      {isError && (
        <div
          role="alert"
          className="rounded-[14px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive"
        >
          {t.asuransi.errorLoad}
        </div>
      )}

      {isLoading && (
        <div className="space-y-3.5">
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

      {!isLoading &&
        !isError &&
        insurances?.map((item) => (
          <PolicyCard
            key={item.id}
            item={item}
            onEdit={() => setEditingItem(item)}
            onPay={() => setPayTarget(item)}
            onDelete={() => setDeleteTarget(item)}
          />
        ))}

      {showModal && familyGroupId && (
        <InsuranceModal
          familyGroupId={familyGroupId}
          token={token}
          editing={null}
          familyMembers={familyMembers}
          onClose={() => setShowModal(false)}
        />
      )}

      {editingItem && familyGroupId && (
        <InsuranceModal
          familyGroupId={familyGroupId}
          token={token}
          editing={editingItem}
          familyMembers={familyMembers}
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
    </div>
  );
}
