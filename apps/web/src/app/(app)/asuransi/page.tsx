"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/wm";
import {
  CardSideActions,
  ConfirmDeleteDialog,
  CrudModal,
  type CrudModalState,
} from "@/components/crud";
import { useLocale } from "@/hooks/use-locale";
import type { Locale } from "@/i18n";
import { apiFetch } from "@/lib/api-client";
import { formatAmountInput, formatRupiah, parseRupiah } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

import type {
  CreateInsuranceDto,
  InsuranceDto,
  InsuranceSummaryDto,
  InsuranceType,
  InsuranceStatus,
  PremiumPeriod,
} from "@wealthme/contracts";

const INSURANCE_TYPE_ICON: Record<string, string> = {
  jiwa: "🛡️",
  kesehatan: "🏥",
  kendaraan: "🚗",
  properti: "🏠",
  lainnya: "📋",
};

const INSURANCE_TYPE_BG: Record<string, string> = {
  jiwa: "#EDE9FE",
  kesehatan: "#DCFCE7",
  kendaraan: "#DBEAFE",
  properti: "#FEF9C3",
  lainnya: "#F3F4F6",
};

const FIELD_CLASS =
  "w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card";

const TYPE_OPTIONS: InsuranceType[] = [
  "jiwa",
  "kesehatan",
  "kendaraan",
  "properti",
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
        </div>
        <CardSideActions onEdit={onEdit} onPay={onPay} onDelete={onDelete} />
      </div>
    </Card>
  );
}

interface AddInsuranceModalProps {
  familyGroupId: string;
  token: string | undefined;
  onClose: () => void;
}

function AddInsuranceModal({
  familyGroupId,
  token,
  onClose,
}: AddInsuranceModalProps) {
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

  const [name, setName] = useState("");
  const [provider, setProvider] = useState("");
  const [type, setType] = useState<InsuranceType>("jiwa");
  const [status, setStatus] = useState<InsuranceStatus>("aktif");
  const [premiumAmount, setPremiumAmount] = useState("");
  const [premiumPeriod, setPremiumPeriod] = useState<PremiumPeriod>("monthly");
  const [coverageAmount, setCoverageAmount] = useState("");
  const [renewalDate, setRenewalDate] = useState("");
  const [autoRenewDate, setAutoRenewDate] = useState(false);
  const [policyNumber, setPolicyNumber] = useState("");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: (dto: CreateInsuranceDto) =>
      apiFetch<InsuranceDto>(`/family-groups/${familyGroupId}/insurances`, {
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
      toast.success(t.asuransi.toastAdded);
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
      toast.error(apiErr.message ?? t.asuransi.toastAddFailed);
    }
  }, [isMutationError, mutationError, t]);

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
      <div
        ref={innerRef}
        className="w-full max-w-[480px] rounded-[16px] bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="add-insurance-title" className="text-[17px] font-extrabold">
            {t.asuransi.modalTitle}
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

const CRUD_JENIS_BY_TYPE: Record<string, string> = {
  jiwa: "Jiwa",
  kesehatan: "Kesehatan",
  kendaraan: "Kendaraan",
  properti: "Properti",
};

export default function AsuransiPage() {
  const { t } = useLocale();
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  const familyGroupId = session?.familyGroupId as string | undefined;
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [crud, setCrud] = useState<CrudModalState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InsuranceDto | null>(null);

  const CRUD_TYPE_BY_JENIS: Record<string, string> = {
    Jiwa: "jiwa",
    Kesehatan: "kesehatan",
    Kendaraan: "kendaraan",
    Properti: "properti",
    Pendidikan: "lainnya",
  };

  async function handleEditSubmit(
    _entity: string,
    _mode: "add" | "edit",
    values: Record<string, string>,
  ) {
    if (!familyGroupId || !token || !editingId) return;
    try {
      await apiFetch(
        `/family-groups/${familyGroupId}/insurances/${editingId}`,
        {
          token,
          method: "PATCH",
          body: JSON.stringify({
            name: values.nama,
            type: CRUD_TYPE_BY_JENIS[values.jenis ?? ""] ?? "lainnya",
            premiumAmount: String(parseRupiah(values.premi ?? "0")),
            coverageAmount: values.pertanggungan
              ? String(parseRupiah(values.pertanggungan))
              : undefined,
            renewalDate: values.jatuhtempo || undefined,
          }),
        },
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.insurances.all(familyGroupId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.insurances.summary(familyGroupId),
      });
      toast.success(t.asuransi.toastUpdated);
    } catch {
      toast.error(t.asuransi.toastUpdateFailed);
    }
  }

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

  const openEdit = (item: InsuranceDto) => {
    setEditingId(item.id);
    setCrud({
      entity: "asuransi",
      mode: "edit",
      initialValues: {
        nama: item.name,
        ...(CRUD_JENIS_BY_TYPE[item.type] && {
          jenis: CRUD_JENIS_BY_TYPE[item.type],
        }),
        premi: String(Number(BigInt(item.premiumAmount))),
        pertanggungan: item.coverageAmount
          ? String(Number(BigInt(item.coverageAmount)))
          : "",
        jatuhtempo: item.renewalDate ? item.renewalDate.slice(0, 10) : "",
      },
    });
  };

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
            onEdit={() => openEdit(item)}
            onPay={() => toast(t.asuransi.payToast)}
            onDelete={() => setDeleteTarget(item)}
          />
        ))}

      {showModal && familyGroupId && (
        <AddInsuranceModal
          familyGroupId={familyGroupId}
          token={token}
          onClose={() => setShowModal(false)}
        />
      )}

      <CrudModal
        state={crud}
        onClose={() => setCrud(null)}
        onSubmit={handleEditSubmit}
      />
      <ConfirmDeleteDialog
        label={deleteTarget ? t.shell.navSections.asuransi : null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}
