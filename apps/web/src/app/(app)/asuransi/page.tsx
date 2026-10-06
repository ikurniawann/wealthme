"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  X,
  Pencil,
  Trash2,
  Banknote,
  Car,
  EllipsisVertical,
  FileText,
  GraduationCap,
  HeartPulse,
  Home,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  PanelContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  ARow,
  BentoCard,
  BentoGrid,
  BentoHero,
  BentoTiles,
  CompositionStack,
  DateField,
  GhostButton,
  HeroKpi,
  PillButton,
  StatusBadge,
  TipsCard,
} from "@/components/wm";
import { MoneyCompact } from "@/components/wm/money-compact";
import {
  HatchedBarChart,
  type BarSeries,
} from "@/components/charts/bento-charts";
import "./asuransi.css";
import { ConfirmDeleteDialog } from "@/components/crud";
import { AdvancedDisclosure } from "@/components/crud/advanced-disclosure";
import { useApiError } from "@/hooks/use-api-error";
import { useLocale } from "@/hooks/use-locale";
import type { Locale } from "@/i18n";
import type { ApiError } from "@/lib/api-client";
import { apiFetch } from "@/lib/api-client";
import { useMoney } from "@/hooks/use-money";
import { queryKeys } from "@/lib/query-keys";
import { insuranceTypeColor } from "@/lib/viz-colors";
import { monthlyPremiumByType, rollingMonths } from "./premium-trend";
import { INSURANCE_RENEWAL_WINDOW_DAYS } from "@/lib/due-date";
import {
  MoneyInput,
  anyMoneyPending,
  moneyDigits,
  useMoneyField,
  withFxInputs,
} from "@/components/money";

import type {
  CreateInsuranceBeneficiaryDto,
  CreateInsuranceDto,
  FxInput,
  InsuranceDto,
  InsuranceSummaryDto,
  InsuranceType,
  InsuranceStatus,
  MemberRelationship,
  PremiumPeriod,
  Role,
  UpdateInsuranceDto,
} from "@wealthme/contracts";

type CreateInsuranceDtoWithFx = CreateInsuranceDto & { fxInputs?: FxInput[] };

// EPIC-021 Group D (#14) — mirrors the `FamilyMember` shape used on /akun for
// the optional "link a beneficiary to a family member" picker. EPIC-023 F1
// (D14) added `relationship` so selecting a member can live-fill it too —
// the API's response DTO already carries it (member-response.dto.ts).
// Revisi K bug 1 — `role` distinguishes the owner (Master), whose
// `relationship` is always null (not a kinship value), from a member whose
// relationship is simply unset.
type FamilyMember = {
  id: string;
  userId: string;
  name: string;
  relationship: MemberRelationship | null;
  role: Role;
};

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

// Batch 5 item 5 — `toLocaleDateString` without an explicit `timeZone`
// resolves the runtime's local zone, which differs between the Node SSR
// pass and the browser's own zone: a genuine hydration-mismatch source.
// Pinning `timeZone: "UTC"` matches the fix already established for the
// same class of bug in `money-format.ts`'s `formatRateDate`.
function formatLocaleDate(iso: string | null, locale: Locale): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Batch 4 item 1 — a negative `daysUntilRenewal` is a real, legitimate value
// (daysUntil() in insurances.service.ts), but the badge/banner had no branch
// for it and rendered e.g. "-16 hari" instead of a real overdue label.
function daysUntilRenewalLabel(
  days: number,
  t: ReturnType<typeof useLocale>["t"]["asuransi"],
  notDueSuffix: string = t.daysUntilRenewalSuffix,
): string {
  return days < 0
    ? `${t.daysOverduePrefix} ${Math.abs(days)} ${t.daysUntilRenewalSuffix}`
    : `${days} ${notDueSuffix}`;
}

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[14px] bg-muted ${className ?? ""}`}
    />
  );
}

const INSURANCE_TYPE_LUCIDE: Record<string, LucideIcon> = {
  jiwa: Shield,
  kesehatan: HeartPulse,
  kendaraan: Car,
  properti: Home,
  pendidikan: GraduationCap,
  lainnya: FileText,
};

interface PolicyTileProps {
  item: InsuranceDto;
  onEdit: () => void;
  onPay: () => void;
  onDelete: () => void;
}

function PolicyTile({ item, onEdit, onPay, onDelete }: PolicyTileProps) {
  const { t, locale } = useLocale();
  const money = useMoney();
  const Icon = INSURANCE_TYPE_LUCIDE[item.type] ?? FileText;
  const typeLabel = t.asuransi.typeLabels[item.type] ?? item.type;
  const periodLabel = t.asuransi.periodSuffixLabels[item.premiumPeriod] ?? "";
  const statusLabel = t.asuransi.statusLabels[item.status] ?? item.status;
  const statusVariant =
    item.status === "aktif"
      ? "success"
      : item.status === "kadaluarsa"
        ? "danger"
        : "warning";

  return (
    <div className="as-tilewrap">
      <div className="as-tile-tt">
        <span className="wm-ci">
          <Icon aria-hidden="true" />
        </span>
        <span className="as-tile-name">{item.name}</span>
        <StatusBadge variant={statusVariant}>{statusLabel}</StatusBadge>
      </div>
      <span className="wm-pv as-tile-amount">
        <span className="wm-money">
          {money.format(Number(BigInt(item.premiumAmount)))}
        </span>
        <small className="as-period">{periodLabel}</small>
      </span>
      <small className="as-tile-meta">
        {item.coverageAmount ? (
          <>
            {t.asuransi.coverageLineLabel}{" "}
            <MoneyCompact value={Number(BigInt(item.coverageAmount))} /> ·{" "}
            {typeLabel}
          </>
        ) : (
          typeLabel
        )}
      </small>
      {item.renewalDate && (
        <small className="as-tile-meta">
          {item.daysUntilRenewal !== null && (
            <>
              <span>
                {daysUntilRenewalLabel(item.daysUntilRenewal, t.asuransi)}
              </span>{" "}
              ·{" "}
            </>
          )}
          {formatLocaleDate(item.renewalDate, locale)}
        </small>
      )}
      <div className="as-foot">
        <button type="button" className="as-detail" onClick={onEdit}>
          {t.asuransi.cardDetailButton}
        </button>
        <button
          type="button"
          className="as-pay"
          onClick={onPay}
          disabled={item.paidThisPeriod}
          title={
            item.paidThisPeriod
              ? item.renewalDate &&
                item.daysUntilRenewal !== null &&
                item.daysUntilRenewal >= 0
                ? `${t.asuransi.payNextDueTooltipPrefix}${formatLocaleDate(item.renewalDate, locale)}`
                : t.asuransi.payAlreadyPaidTooltip
              : undefined
          }
        >
          <Banknote className="size-3.5" aria-hidden="true" />{" "}
          {t.asuransi.payButtonLabel}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t.asuransi.cardOptionsAriaLabel}
            render={<button type="button" className="as-opts" />}
          >
            <EllipsisVertical className="size-3.5" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[140px]">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="size-3.5" aria-hidden="true" />{" "}
              {t.asuransi.cardEditButton}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 className="size-3.5" aria-hidden="true" />{" "}
              {t.asuransi.cardDeleteButton}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
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
  /** polish-j batch 7a item 9 — the add-policy form wraps this in an
   * "Ahli waris (opsional)" disclosure, whose own summary already names
   * the section; suppress the inner heading there to avoid saying it
   * twice. Defaults to shown (standalone edit-policy usage). */
  showSectionTitle?: boolean;
}

/** Shared allocation-bar + row editor, mirroring warisan's heir editor UX. */
function BeneficiaryEditor({
  rows,
  onChange,
  familyMembers,
  membersUnavailable,
  showSectionTitle = true,
}: BeneficiaryEditorProps) {
  const { t } = useLocale();
  const allocated = Math.min(100, totalAllocated(rows));
  const unallocated = Math.max(0, 100 - totalAllocated(rows));

  function updateRow(id: string, patch: Partial<BeneficiaryFormRow>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div>
      {/* EPIC-026 Wave 8 — each row reproduces the prototype's
          `dlg-asuransi-ahliwaris` field order (asuransi.html:459):
          "Hubungkan ke Anggota Keluarga", then Nama + Hubungan 2-up, then
          Persentase (%). The prototype models one beneficiary per dialog; the
          app edits all of a policy's beneficiaries inline, so the block
          repeats per row with its own remove action. */}
      {showSectionTitle && (
        <div className="section-title mt-[18px] mb-2 text-[14px]">
          {t.asuransi.beneficiariesSectionTitle}
        </div>
      )}
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
            <div key={row.id} className="rounded-md border bg-background p-3">
              <div className="row row--between mb-1.5">
                <span className="label m-0">
                  {t.asuransi.beneficiaryMemberLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${t.asuransi.removeBeneficiaryAriaLabel} ${
                    linkedMember ? linkedMember.name : row.name
                  }`.trim()}
                  onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
                >
                  <X className="size-[15px]" />
                </Button>
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
                    // Revisi K bug 1 — the owner's `relationship` is always
                    // null (not a kinship value); default it to "Diri
                    // sendiri" instead of leaving the (now-editable) field
                    // blank, which used to fail the API's @IsNotEmpty()
                    // check on save.
                    updateRow(row.id, {
                      memberUserId,
                      ...(picked
                        ? {
                            name: picked.name,
                            relationship:
                              picked.relationship ??
                              (picked.role === "owner"
                                ? t.asuransi.beneficiaryRelationshipSelfDefault
                                : ""),
                          }
                        : {}),
                    });
                  }}
                  className="select"
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
                  <p className="hint">
                    {t.asuransi.beneficiaryMemberPickerUnavailable}
                  </p>
                )
              )}

              <div className="wm-form__grid">
                <div className="field mt-0">
                  <label
                    className="label"
                    htmlFor={`beneficiary-name-${row.id}`}
                  >
                    {t.asuransi.beneficiaryNameLabel}
                  </label>
                  <input
                    id={`beneficiary-name-${row.id}`}
                    type="text"
                    value={linkedMember ? linkedMember.name : row.name}
                    disabled={!!linkedMember}
                    onChange={(e) =>
                      updateRow(row.id, { name: e.target.value })
                    }
                    placeholder={t.asuransi.beneficiaryNamePlaceholder}
                    className="input disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
                <div className="field mt-0">
                  <label
                    className="label"
                    htmlFor={`beneficiary-relationship-${row.id}`}
                  >
                    {t.asuransi.beneficiaryRelationshipLabel}
                  </label>
                  <input
                    id={`beneficiary-relationship-${row.id}`}
                    type="text"
                    // Revisi K bug 1 — only LOCK the field when the linked
                    // member actually HAS a relationship; a null one (the
                    // owner, an operational member) leaves it editable with
                    // the row's own (possibly defaulted) value instead of
                    // forcing it blank.
                    value={
                      linkedMember?.relationship
                        ? linkedMember.relationship
                        : row.relationship
                    }
                    disabled={!!linkedMember?.relationship}
                    onChange={(e) =>
                      updateRow(row.id, { relationship: e.target.value })
                    }
                    placeholder={t.asuransi.beneficiaryRelationshipPlaceholder}
                    className="input disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="field">
                <label
                  className="label"
                  htmlFor={`beneficiary-share-${row.id}`}
                >
                  {t.asuransi.beneficiarySharePercentLabel}
                </label>
                <input
                  id={`beneficiary-share-${row.id}`}
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={row.sharePercent}
                  onChange={(e) =>
                    updateRow(row.id, { sharePercent: e.target.value })
                  }
                  placeholder={t.asuransi.beneficiarySharePercentLabel}
                  className="input mono"
                />
                {/* Prototype's `.error-text` under Persentase
                    (asuransi.html:494) — shown for the same condition
                    `handleSave` blocks on. */}
                {totalAllocated(rows) > 100 && (
                  <span className="error-text">
                    {t.asuransi.validationSharePercentExceeded}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => onChange([...rows, emptyBeneficiaryRow()])}
        className="btn--block mt-2.5"
      >
        <Plus className="size-[15px]" /> {t.asuransi.addBeneficiaryButton}
      </Button>

      {rows.length > 0 && (
        <>
          <div className="notice mt-3">
            <span>
              {unallocated <= 0
                ? t.asuransi.allocationFullyAllocated
                : `${allocated}${t.asuransi.allocationAllocatedSuffix} · ${unallocated}${t.asuransi.allocationUnallocatedSuffix}`}
            </span>
          </div>
          <div className="progress mt-2">
            <div
              className="progress__bar"
              style={{
                transform: `scaleX(${Math.min(100, Math.max(0, allocated)) / 100})`,
                background:
                  unallocated <= 0 ? "var(--success)" : "var(--warning)",
              }}
            />
          </div>
        </>
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
  const { t, locale } = useLocale();
  const { handleError } = useApiError();
  const queryClient = useQueryClient();
  // EPIC-026 Wave 8 — the hand-rolled "focus the first control on mount,
  // restore on unmount" effect is gone: this is now a real Base UI Dialog,
  // which owns initial focus, the focus trap, focus restore, Escape and the
  // scroll lock.

  const [name, setName] = useState(editing?.name ?? "");
  const [provider, setProvider] = useState(editing?.provider ?? "");
  const [type, setType] = useState<InsuranceType>(editing?.type ?? "jiwa");
  const [status, setStatus] = useState<InsuranceStatus>(
    editing?.status ?? "aktif",
  );
  const premiumField = useMoneyField({
    initialRaw: editing ? BigInt(editing.premiumAmount).toString() : "",
    isEdit: !!editing,
  });
  const [premiumPeriod, setPremiumPeriod] = useState<PremiumPeriod>(
    editing?.premiumPeriod ?? "monthly",
  );
  const coverageField = useMoneyField({
    initialRaw: editing?.coverageAmount
      ? BigInt(editing.coverageAmount).toString()
      : "",
    isEdit: !!editing,
  });
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
    mutationFn: (
      dto:
        | CreateInsuranceDtoWithFx
        | (UpdateInsuranceDto & { fxInputs?: FxInput[] }),
    ) =>
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
      handleError(mutationError);
    }
  }, [isMutationError, mutationError, handleError]);

  function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.warning(t.asuransi.validationNameRequired);
      return;
    }
    if (anyMoneyPending(premiumField, coverageField)) {
      toast.error(t.money.rateNotReady);
      return;
    }
    const parsedPremium = Number(moneyDigits(premiumField) || "0");
    if (parsedPremium <= 0) {
      toast.warning(t.asuransi.validationPremiumPositive);
      return;
    }

    // EPIC-022 D6 — a row with a nonzero percentage but a blank name used to
    // be silently dropped from BOTH the sum and the payload: the allocation
    // bar looked accurate, but the money it represented vanished with no
    // warning. Block save instead — a real allocation needs a real name.
    const blankNamedWithShare = beneficiaries.find(
      (b) => !b.name.trim() && (parseFloat(b.sharePercent) || 0) > 0,
    );
    if (blankNamedWithShare) {
      toast.warning(t.asuransi.validationBeneficiaryNameRequired);
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
    const totalSharePercent = beneficiaryDtos.reduce(
      (sum, b) => sum + b.sharePercent,
      0,
    );
    if (totalSharePercent > 100) {
      toast.warning(t.asuransi.validationSharePercentExceeded);
      return;
    }
    // EPIC-022 D6 — under-allocation used to save silently. It may be
    // intentional (the remainder goes to the estate), so this is a warning,
    // not a block — the save still proceeds.
    if (beneficiaryDtos.length > 0 && totalSharePercent < 100) {
      toast.warning(
        t.asuransi.validationShareUnderAllocated.replace(
          "{pct}",
          String(totalSharePercent),
        ),
      );
    }

    const dto: CreateInsuranceDtoWithFx = {
      name: trimmedName,
      type,
      status,
      premiumAmount: String(parsedPremium),
      premiumPeriod,
      ...(provider.trim() && { provider: provider.trim() }),
      ...(coverageField.raw && {
        coverageAmount: moneyDigits(coverageField),
      }),
      ...(renewalDate && { renewalDate, autoRenewDate }),
      ...(policyNumber.trim() && { policyNumber: policyNumber.trim() }),
      ...(notes.trim() && { notes: notes.trim() }),
      beneficiaries: beneficiaryDtos,
    };

    mutation.mutate(
      withFxInputs(dto, [
        ["premiumAmount", premiumField],
        ["coverageAmount", coverageField.raw ? coverageField : null],
      ]),
    );
  }

  return (
    // EPIC-026 Wave 8 — was a hand-rolled fixed overlay; now the real Base UI
    // Dialog rendering the prototype's `dlg-asuransi-form`
    // (docs/prototype/pages/asuransi.html:373): `dialog--wide`, a
    // `.dialog__desc`, four 2-up `.field-row` groups, then No. Polis, the
    // auto-renew switch row and Catatan.
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <PanelContent variant="side" className="wm-form-panel">
        <header className="wm-panel-head">
          <div className="min-w-0">
            <DialogTitle className="wm-panel-title">
              {editing ? t.asuransi.modalEditTitle : t.asuransi.modalTitle}
            </DialogTitle>
            <DialogDescription className="wm-panel-desc">
              {t.asuransi.modalDesc}
            </DialogDescription>
          </div>
          <DialogClose className="wm-panel-x" aria-label={t.common.close}>
            <X aria-hidden="true" />
          </DialogClose>
        </header>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="wm-panel-body wm-form">
            <div className="wm-form__grid">
              <div className="wm-form__grid">
                <div className="field mt-0">
                  <label className="label" htmlFor="ins-name">
                    {t.asuransi.fieldNameLabel}
                  </label>
                  <input
                    id="ins-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.asuransi.fieldNamePlaceholder}
                    className="input"
                  />
                </div>
                <div className="field mt-0">
                  <label className="label" htmlFor="ins-provider">
                    {t.asuransi.fieldProviderLabel}
                  </label>
                  <input
                    id="ins-provider"
                    type="text"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    placeholder={t.asuransi.fieldProviderPlaceholder}
                    className="input"
                  />
                </div>
              </div>

              <div className="wm-form__grid">
                <div className="field mt-0">
                  <label className="label" htmlFor="ins-type">
                    {t.asuransi.fieldTypeLabel}
                  </label>
                  <select
                    id="ins-type"
                    value={type}
                    onChange={(e) => setType(e.target.value as InsuranceType)}
                    className="select"
                  >
                    {TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {t.asuransi.typeLabels[opt]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field mt-0">
                  <label className="label" htmlFor="ins-status">
                    {t.asuransi.fieldStatusLabel}
                  </label>
                  <select
                    id="ins-status"
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as InsuranceStatus)
                    }
                    className="select"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {t.asuransi.statusLabels[opt]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="wm-form__grid--two">
                <div className="field mt-0">
                  <label className="label" htmlFor="ins-premium">
                    {t.asuransi.fieldPremiumLabel}
                  </label>
                  <MoneyInput
                    field={premiumField}
                    id="ins-premium"
                    placeholder="0"
                  />
                </div>
                <div className="field mt-0">
                  <label className="label" htmlFor="ins-period">
                    {t.asuransi.fieldPeriodLabel}
                  </label>
                  <select
                    id="ins-period"
                    value={premiumPeriod}
                    onChange={(e) =>
                      setPremiumPeriod(e.target.value as PremiumPeriod)
                    }
                    className="select"
                  >
                    {PERIOD_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {t.asuransi.periodOptionLabels[opt]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="wm-form__grid--two">
                <div className="field mt-0">
                  <label className="label" htmlFor="ins-coverage">
                    {t.asuransi.fieldCoverageLabel}
                  </label>
                  <MoneyInput
                    field={coverageField}
                    id="ins-coverage"
                    placeholder="0"
                  />
                </div>
                <div className="field mt-0">
                  <label className="label" htmlFor="ins-renewal">
                    {t.asuransi.fieldRenewalDateLabel}
                  </label>
                  <DateField
                    id="ins-renewal"
                    value={renewalDate}
                    locale={locale}
                    label={t.asuransi.fieldRenewalDateLabel}
                    onChange={setRenewalDate}
                  />
                </div>
              </div>

              <div className="field">
                <label className="label" htmlFor="ins-policy-number">
                  {t.asuransi.fieldPolicyNumberLabel}
                </label>
                <input
                  id="ins-policy-number"
                  type="text"
                  value={policyNumber}
                  onChange={(e) => setPolicyNumber(e.target.value)}
                  placeholder={t.asuransi.fieldPolicyNumberPlaceholder}
                  className="input mono"
                />
              </div>

              {/* Prototype's `.row` + `.switch` auto-renew toggle
              (asuransi.html:487). Still gated on a renewal date being set —
              `autoRenewDate` is only sent alongside `renewalDate`, so showing
              the switch without one would be a control that does nothing
              (Honest UI). */}
              {renewalDate && (
                <div className="row mt-3">
                  <Switch
                    checked={autoRenewDate}
                    onCheckedChange={setAutoRenewDate}
                    aria-labelledby="ins-auto-renew-label"
                  />
                  <span className="text-[13px]" id="ins-auto-renew-label">
                    {t.asuransi.autoRenewLabel}
                  </span>
                </div>
              )}

              <div className="field">
                <label className="label" htmlFor="ins-notes">
                  {t.asuransi.fieldNotesLabel}
                </label>
                <textarea
                  id="ins-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder={t.asuransi.fieldNotesPlaceholder}
                  className="textarea resize-none"
                />
              </div>

              {/* polish-j batch 7a item 9 — beneficiaries are optional and were
              bloating the add form open by default; collapsed behind a
              disclosure so the required fields above are what's visible
              first. */}
              <AdvancedDisclosure
                label={t.asuransi.beneficiariesOptionalLabel}
                defaultOpen={beneficiaries.length > 0}
              >
                <BeneficiaryEditor
                  rows={beneficiaries}
                  onChange={setBeneficiaries}
                  familyMembers={familyMembers}
                  membersUnavailable={membersUnavailable}
                  showSectionTitle={false}
                />
              </AdvancedDisclosure>
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
              {mutation.isPending ? t.asuransi.saving : t.asuransi.saveButton}
            </PillButton>
          </div>
        </form>
      </PanelContent>
    </Dialog>
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
  const money = useMoney();
  const periodLabel = item
    ? (t.asuransi.periodSuffixLabels[item.premiumPeriod] ?? "")
    : "";
  return (
    // EPIC-026 Wave 8 — prototype `dlg-asuransi-bayar` (asuransi.html:320):
    // title + a `.dialog__desc` that states exactly what confirming does,
    // then the premium figure and the source-account field.
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>{t.asuransi.payDialogTitle}</DialogTitle>
        {item && (
          <>
            <DialogDescription>
              {t.asuransi.payConfirmPrefix}
              {item.name}
              {t.asuransi.payConfirmSuffix}
            </DialogDescription>

            <DialogBody className="text-[13px]">
              {/* The prototype's "Polis" and "Jumlah Premi" inputs are
                  read-only here on purpose: this dialog always pays THE
                  policy the user picked, for its stored premium —
                  `POST .../insurances/:id/pay` takes only
                  `{ sourceAccountId }`. Rendering them as editable inputs
                  would silently drop whatever the user typed (Honest UI).
                  The prototype's "Tanggal Bayar" field is omitted for the
                  same reason: the payment is always booked as of now. */}
              <div className="rounded-lg bg-muted p-3.5">
                <div className="t-xs t-muted">{t.asuransi.premiumLabel}</div>
                <div className="mono text-[18px] font-black">
                  {money.format(Number(BigInt(item.premiumAmount)))}
                  <span className="ml-1 text-[12px] font-normal text-muted-foreground">
                    {periodLabel}
                  </span>
                </div>
              </div>

              <div className="field">
                <label className="label" htmlFor="pay-insurance-source-account">
                  {t.asuransi.paySourceAccountLabel}
                </label>
                <select
                  id="pay-insurance-source-account"
                  value={sourceAccountId}
                  onChange={(e) => onSourceAccountChange(e.target.value)}
                  className="select"
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
            </DialogBody>
          </>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            type="button"
            disabled={isPending || !sourceAccountId}
            onClick={onConfirm}
          >
            {isPending ? t.asuransi.payProcessing : t.asuransi.payConfirmButton}
          </Button>
        </DialogFooter>
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
  description,
  emptyLabel,
  policies,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
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
    // EPIC-026 Wave 8 — the prototype's `dlg-asuransi-ahliwaris` /
    // `dlg-asuransi-bayar` both open with a "Polis" <select>; this is that
    // step, so it carries the prototype's title + `.dialog__desc` + a single
    // `.field` and a Batal/confirm `.dialog__footer`.
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {policies.length === 0 ? emptyLabel : description}
        </DialogDescription>
        {policies.length > 0 && (
          <DialogBody>
            <div className="field">
              <label className="label" htmlFor="policy-picker-select">
                {t.asuransi.policyPickerLabel}
              </label>
              <select
                id="policy-picker-select"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="select"
              >
                <option value="">{t.asuransi.policyPickerPlaceholder}</option>
                {policies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </DialogBody>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            {t.common.cancel}
          </Button>
          {policies.length > 0 && (
            <Button
              type="button"
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AsuransiPage() {
  const { t, locale } = useLocale();
  const { handleError } = useApiError();
  const money = useMoney();
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
    onError: handleError,
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
    onError: handleError,
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
      toast.success(t.asuransi.toastBeneficiaryDeleted);
    },
    onError: handleError,
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
  const monthlyPremiumNumber = summary?.totalMonthlyPremium
    ? Number(BigInt(summary.totalMonthlyPremium))
    : 0;
  // Rolling 6-month window ending at the current month; one stacked segment
  // per insurance type (same type → colour mapping as the coverage donut).
  const premiumTrendMonths = rollingMonths(new Date()).map((d) =>
    new Intl.DateTimeFormat(locale, { month: "short" }).format(d),
  );
  const premiumSeries: BarSeries[] = monthlyPremiumByType(insurances ?? []).map(
    ({ type, monthly }) => ({
      name: t.asuransi.typeLabels[type] ?? type,
      data: [monthly],
      color: insuranceTypeColor(type),
    }),
  );

  // EPIC-025 N3-F3 — coverage-by-type donut (FOLD): derived from the
  // already-fetched `insurances` list, same coverageAmount PolicyCard
  // already renders per row. The premium trend uses the real current monthly
  // premium as its anchor and a conservative 6-month projection so the page
  // keeps the prototype's decision-support shape until premium history exists.
  const coverageByType = new Map<string, bigint>();
  for (const item of insurances ?? []) {
    if (!item.coverageAmount) continue;
    const label = t.asuransi.typeLabels[item.type] ?? item.type;
    coverageByType.set(
      label,
      (coverageByType.get(label) ?? BigInt(0)) + BigInt(item.coverageAmount),
    );
  }
  const coverageSegments: { label: string; value: number; color: string }[] = (
    insurances ?? []
  )
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
      color: insuranceTypeColor(type),
    }))
    .filter((seg) => seg.value > 0);

  // Real nearest-renewal warning — the prototype hardcodes one policy's
  // name/date; here it's the actual soonest-renewing active policy, or
  // nothing at all when none is within 30 days.
  const nearestRenewal = (insurances ?? [])
    .filter((item) => item.status === "aktif" && item.daysUntilRenewal !== null)
    .sort((a, b) => (a.daysUntilRenewal ?? 0) - (b.daysUntilRenewal ?? 0))[0];
  const showRenewalWarning =
    nearestRenewal &&
    (nearestRenewal.daysUntilRenewal ?? 999) <= INSURANCE_RENEWAL_WINDOW_DAYS;

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

  const typeGroups = Array.from(coverageByType.entries());
  const compositionItems = coverageSegments.map((seg) => ({
    label: seg.label,
    value: seg.value,
    color: seg.color,
  }));
  const policyCount = insurances?.length ?? 0;
  const tipTitle = showRenewalWarning
    ? `${nearestRenewal!.name}${t.asuransi.v2.tipSoonSuffix}`
    : policyCount > 0
      ? t.asuransi.v2.tipOkTitle
      : t.asuransi.v2.tipEmptyTitle;
  const tipBody = showRenewalWarning
    ? `${t.asuransi.renewalWarningSuffix} ${formatLocaleDate(nearestRenewal!.renewalDate, locale)} · ${daysUntilRenewalLabel(
        nearestRenewal!.daysUntilRenewal!,
        t.asuransi,
        t.asuransi.renewalWarningDaysLeftSuffix,
      )}.`
    : policyCount > 0
      ? t.asuransi.v2.tipOkBody
      : t.asuransi.v2.tipEmptyBody;
  const activeShare = policyCount
    ? Math.round((Math.min(policyCount, activePolicies) / policyCount) * 18)
    : 0;
  const tipsMosaic = Array.from({ length: 18 }, (_, i) =>
    i < activeShare
      ? showRenewalWarning && i === activeShare - 1
        ? "o"
        : "a"
      : i % 4 === 0
        ? "b"
        : "",
  ) as ("a" | "b" | "c" | "o" | "")[];

  return (
    <div data-page="asuransi" className="as-page">
      <BentoGrid className="as-grid">
        <BentoHero
          className="as-hero"
          currency={isLoading ? null : "Rp"}
          value={
            isLoading ? (
              "…"
            ) : (
              <span className="wm-money">
                {money.format(monthlyPremiumNumber).replace(/^Rp\s*/, "")}
              </span>
            )
          }
          caption={t.asuransi.v2.heroCaption}
          controls={
            <div className="as-hero-ctrl">
              <div className="as-hero-ctrl-row">
                <GhostButton
                  onClick={() => setPayPolicyPicker(true)}
                  disabled={!familyGroupId}
                >
                  <Banknote className="size-4" aria-hidden="true" />{" "}
                  {t.asuransi.payButtonLabel}
                </GhostButton>
                <GhostButton
                  lit
                  onClick={() => setShowModal(true)}
                  disabled={!familyGroupId}
                >
                  <Plus className="size-4" aria-hidden="true" /> {t.common.add}
                </GhostButton>
              </div>
              {premiumSeries.length > 0 && (
                <div className="wm-legend">
                  {premiumSeries.map((item) => (
                    <span key={item.name}>
                      <i style={{ background: item.color }} />
                      {item.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          }
          chart={
            <div className="as-plot">
              {isLoading ? null : premiumSeries.length > 0 ? (
                <HatchedBarChart
                  labels={premiumTrendMonths}
                  series={premiumSeries}
                  stacked
                  highlight={premiumTrendMonths.length - 1}
                  format={money.formatCompact}
                  formatFull={money.format}
                  wide
                  ariaLabel={t.asuransi.v2.chartAria}
                />
              ) : (
                <p className="as-empty">{t.asuransi.v2.tipEmptyBody}</p>
              )}
            </div>
          }
          kpis={
            <>
              <HeroKpi
                label={t.asuransi.v2.kpiActive}
                value={String(activePolicies)}
              />
              <HeroKpi
                label={t.asuransi.v2.kpiCoverage}
                value={
                  <span className="wm-money">
                    {money.format(Number(totalCoverageAktif))}
                  </span>
                }
              />
              <HeroKpi
                label={t.asuransi.v2.kpiRenew}
                value={
                  <span className="as-renew">
                    {nearestRenewal
                      ? `${nearestRenewal.name} · ${daysUntilRenewalLabel(nearestRenewal.daysUntilRenewal!, t.asuransi, t.asuransi.renewalWarningDaysLeftSuffix)}`
                      : "—"}
                  </span>
                }
              />
            </>
          }
        />

        {compositionItems.length > 0 && typeGroups.length > 0 && (
          <BentoCard
            className="as-side"
            title={t.asuransi.coverageAllocationTitle}
            caption={t.asuransi.v2.allocCaption}
          >
            <CompositionStack
              label={t.asuransi.coverageAllocationTitle}
              center={<MoneyCompact value={Number(totalCoverageAktif)} />}
              sub={t.asuransi.coverageLabel}
              format={money.formatCompact}
              formatFull={money.format}
              items={compositionItems}
            />
          </BentoCard>
        )}

        <BentoCard
          className="as-list"
          title={t.asuransi.v2.gridTitle}
          caption={`${policyCount} ${t.asuransi.v2.gridCount}`}
        >
          {isError && (
            <p role="alert" className="as-error">
              {t.asuransi.errorLoad}
            </p>
          )}
          {isLoading ? (
            <BentoTiles>
              <Bone className="h-[170px] w-full" />
              <Bone className="h-[170px] w-full" />
            </BentoTiles>
          ) : !isError && policyCount === 0 ? (
            <p className="as-empty">{t.asuransi.emptyState}</p>
          ) : (
            <BentoTiles>
              {(insurances ?? []).map((item) => (
                <PolicyTile
                  key={item.id}
                  item={item}
                  onEdit={() => setEditingItem(item)}
                  onPay={() => setPayTarget(item)}
                  onDelete={() => setDeleteTarget(item)}
                />
              ))}
            </BentoTiles>
          )}
        </BentoCard>

        <TipsCard className="as-tips" title={tipTitle} mosaic={tipsMosaic}>
          {tipBody}
        </TipsCard>

        {!isLoading && !isError && beneficiaryRows.length > 0 && (
          <BentoCard
            className="as-benef"
            title={t.asuransi.beneficiariesSectionTitle}
            caption={t.asuransi.v2.benCaption}
            action={
              <GhostButton
                aria-label={t.asuransi.addBeneficiaryHeaderAriaLabel}
                onClick={() => setBeneficiaryPolicyPicker(true)}
              >
                {t.asuransi.addBeneficiaryButton}
              </GhostButton>
            }
          >
            {soleFullyAllocatedPolicy && (
              <p className="as-allocated">
                <strong>{t.asuransi.allocationFullyAllocated}</strong>{" "}
                {t.asuransi.beneficiaryTablePolicyPrefix}{" "}
                {soleFullyAllocatedPolicy.name}
              </p>
            )}
            <ul className="as-benlist">
              {beneficiaryRows.map(
                ({ policy, beneficiary, linkedMember, estimatedBenefit }) => {
                  const initials = beneficiary.name
                    .split(" ")
                    .slice(0, 2)
                    .map((w) => w[0]?.toUpperCase() ?? "")
                    .join("");
                  return (
                    <li key={beneficiary.id} className="as-benrow">
                      <ARow
                        badge={initials}
                        title={beneficiary.name}
                        meta={[
                          beneficiary.relationship,
                          linkedMember?.name,
                          `${t.asuransi.beneficiaryTablePolicyPrefix} ${policy.name}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        share={Math.min(100, Number(beneficiary.sharePercent))}
                        amount={
                          <span className="wm-money">
                            {estimatedBenefit !== null
                              ? money.format(Number(estimatedBenefit))
                              : "—"}
                          </span>
                        }
                        amountSub={`${beneficiary.sharePercent}%`}
                      />
                      <button
                        type="button"
                        className="as-benrm"
                        aria-label={`${t.asuransi.removeBeneficiaryAriaLabel} ${beneficiary.name}`}
                        disabled={removeBeneficiaryMutation.isPending}
                        onClick={() =>
                          setDeleteBeneficiaryTarget({ policy, beneficiary })
                        }
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  );
                },
              )}
            </ul>
          </BentoCard>
        )}
      </BentoGrid>

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

      {/* Prototype `dlg-asuransi-hapus` (asuransi.html:511): `dialog--sm`,
          "Hapus data ini?" + its own body copy, Batal + destructive confirm. */}
      <ConfirmDeleteDialog
        label={deleteTarget ? t.shell.navSections.asuransi : null}
        title={t.asuransi.deleteDialogTitle}
        body={t.asuransi.deleteDialogBody}
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
        body={t.asuransi.deleteBeneficiaryDialogBody}
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
        description={t.asuransi.policyPickerPayDesc}
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
        description={t.asuransi.policyPickerBeneficiaryDesc}
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
