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

const INSURANCE_TYPE_LABEL: Record<string, string> = {
  jiwa: "Asuransi Jiwa",
  kesehatan: "Asuransi Kesehatan",
  kendaraan: "Asuransi Kendaraan",
  properti: "Asuransi Properti",
  lainnya: "Lainnya",
};

const PREMIUM_PERIOD_LABEL: Record<string, string> = {
  monthly: "/bln",
  quarterly: "/3 bln",
  yearly: "/thn",
};

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

function formatIndonesianDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", {
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
  /** Undefined when the policy has no renewal date to advance. */
  onPay?: () => void;
  /** True while THIS card's pay-premium request is in flight. */
  payPending?: boolean;
  onDelete: () => void;
}

function PolicyCard({
  item,
  onEdit,
  onPay,
  payPending,
  onDelete,
}: PolicyCardProps) {
  const icon = INSURANCE_TYPE_ICON[item.type] ?? "📋";
  const iconBg = INSURANCE_TYPE_BG[item.type] ?? "#F3F4F6";
  const typeLabel = INSURANCE_TYPE_LABEL[item.type] ?? item.type;
  const periodLabel = PREMIUM_PERIOD_LABEL[item.premiumPeriod] ?? "";
  const renewalVariant = renewalBadgeVariant(item.daysUntilRenewal);

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
            <StatusBadge variant={statusVariant}>
              {item.status === "aktif"
                ? "Aktif"
                : item.status === "kadaluarsa"
                  ? "Kadaluarsa"
                  : "Tidak Aktif"}
            </StatusBadge>
          </div>

          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
            {item.coverageAmount && (
              <div>
                <div className="mb-[3px] text-[11px] text-muted-foreground">
                  Uang Pertanggungan
                </div>
                <div className="text-[13.5px] font-bold">
                  {formatRupiah(Number(BigInt(item.coverageAmount)))}
                </div>
              </div>
            )}
            <div>
              <div className="mb-[3px] text-[11px] text-muted-foreground">
                Premi
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
                  Jatuh Tempo
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="text-[13.5px] font-bold">
                    {formatIndonesianDate(item.renewalDate)}
                  </div>
                  {item.daysUntilRenewal !== null && (
                    <StatusBadge
                      variant={renewalVariant}
                      className="text-[10px]"
                    >
                      {item.daysUntilRenewal} hari
                    </StatusBadge>
                  )}
                </div>
              </div>
            )}
            {item.policyNumber && (
              <div>
                <div className="mb-[3px] text-[11px] text-muted-foreground">
                  No. Polis
                </div>
                <div className="text-[13.5px] font-bold">
                  {item.policyNumber}
                </div>
              </div>
            )}
          </div>
        </div>
        <CardSideActions
          onEdit={onEdit}
          onPay={onPay}
          payPending={payPending}
          onDelete={onDelete}
        />
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
      toast.success("Asuransi berhasil ditambahkan");
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
      toast.error(apiErr.message ?? "Gagal menyimpan asuransi");
    }
  }, [isMutationError, mutationError]);

  function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.warning("Nama asuransi wajib diisi");
      return;
    }
    const parsedPremium = parseRupiah(premiumAmount);
    if (parsedPremium <= 0) {
      toast.warning("Premi harus lebih dari Rp 0");
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
            Tambah Asuransi
          </h2>
          <button
            type="button"
            aria-label="Tutup modal"
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
              Nama Asuransi *
            </label>
            <input
              id="ins-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="cth: Asuransi Jiwa Keluarga"
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <label
              htmlFor="ins-provider"
              className="mb-1.5 block text-[12.5px] font-semibold"
            >
              Perusahaan
            </label>
            <input
              id="ins-provider"
              type="text"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="cth: Prudential, AXA, Allianz"
              className={FIELD_CLASS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="ins-type"
                className="mb-1.5 block text-[12.5px] font-semibold"
              >
                Jenis *
              </label>
              <select
                id="ins-type"
                value={type}
                onChange={(e) => setType(e.target.value as InsuranceType)}
                className={FIELD_CLASS}
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {INSURANCE_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="ins-status"
                className="mb-1.5 block text-[12.5px] font-semibold"
              >
                Status
              </label>
              <select
                id="ins-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as InsuranceStatus)}
                className={FIELD_CLASS}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s === "aktif"
                      ? "Aktif"
                      : s === "kadaluarsa"
                        ? "Kadaluarsa"
                        : "Tidak Aktif"}
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
              Premi (Rp) *
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
              Periode Premi
            </label>
            <select
              id="ins-period"
              value={premiumPeriod}
              onChange={(e) =>
                setPremiumPeriod(e.target.value as PremiumPeriod)
              }
              className={FIELD_CLASS}
            >
              {PERIOD_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p === "monthly"
                    ? "Bulanan"
                    : p === "quarterly"
                      ? "3 Bulanan"
                      : "Tahunan"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="ins-coverage"
              className="mb-1.5 block text-[12.5px] font-semibold"
            >
              Uang Pertanggungan (Rp)
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
              Tanggal Jatuh Tempo
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
                Perpanjang otomatis setiap periode premi setelah lewat jatuh
                tempo
              </label>
            )}
          </div>

          <div>
            <label
              htmlFor="ins-policy-number"
              className="mb-1.5 block text-[12.5px] font-semibold"
            >
              No. Polis
            </label>
            <input
              id="ins-policy-number"
              type="text"
              value={policyNumber}
              onChange={(e) => setPolicyNumber(e.target.value)}
              placeholder="cth: POL-12345678"
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <label
              htmlFor="ins-notes"
              className="mb-1.5 block text-[12.5px] font-semibold"
            >
              Catatan
            </label>
            <textarea
              id="ins-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Catatan tambahan..."
              className={`${FIELD_CLASS} resize-none`}
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="w-full"
          >
            {mutation.isPending ? "Menyimpan..." : "Simpan Asuransi"}
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
      toast.success("Asuransi berhasil diperbarui!");
    } catch {
      toast.error("Gagal memperbarui asuransi. Coba lagi.");
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
      toast.success("Asuransi dihapus");
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "Gagal menghapus asuransi");
    },
  });

  // Tracks policy ids with a pay-premium request currently in flight.
  // `payPremiumMutation.isPending` only updates after react-query's
  // notification pipe runs (a real setTimeout(0) macrotask), and
  // `payPremiumMutation` is a brand-new object every render — so neither can
  // be read synchronously inside an onClick closure to block a same-tick
  // double-click. A ref mutation IS synchronous and immediately visible to
  // the very next call in the same tick, so it's the only thing that can
  // actually stop a real double-POST. `payPending` (below) is kept purely
  // as complementary UX feedback (disabled/aria-busy), not as the guard.
  const payInFlightRef = useRef<Set<string>>(new Set());

  // Records a real premium payment: the backend advances the policy's
  // renewalDate by one billing period (reusing the same auto-renew logic
  // as the billing-cycle cron). Success only toasts after the write lands.
  const payPremiumMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<InsuranceDto>(
        `/family-groups/${familyGroupId}/insurances/${id}/pay-premium`,
        { method: "POST", token },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.insurances.all(familyGroupId ?? ""),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.insurances.summary(familyGroupId ?? ""),
      });
      toast.success("Pembayaran premi dicatat, jatuh tempo diperbarui");
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "Gagal mencatat pembayaran premi");
    },
    onSettled: (_data, _error, id) => {
      // Clear the in-flight lock regardless of outcome (success or error)
      // so a genuinely failed/completed request can be retried.
      if (id) payInFlightRef.current.delete(id);
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
            {activePolicies} Polis Aktif
          </div>
          <div className="text-xs text-muted-foreground">
            Total premi: {totalMonthlyPremium}/bln
          </div>
        </div>
        <Button
          onClick={() => setShowModal(true)}
          disabled={!familyGroupId}
          className="h-auto px-4 py-[9px]"
          data-tour="add-asuransi"
        >
          <Plus className="size-4" /> Tambah
        </Button>
      </div>

      {isError && (
        <div
          role="alert"
          className="rounded-[14px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive"
        >
          Gagal memuat data asuransi. Silakan refresh halaman.
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
          Belum ada polis asuransi. Klik &quot;Tambah&quot; untuk mulai.
        </div>
      )}

      {!isLoading &&
        !isError &&
        insurances?.map((item) => (
          <PolicyCard
            key={item.id}
            item={item}
            onEdit={() => openEdit(item)}
            // No renewal date on the policy means there's nothing real to
            // advance yet — hide the action rather than show a button that
            // would fail (or no-op) on click.
            onPay={
              item.renewalDate
                ? () => {
                    // payPremium is NOT idempotent server-side (it
                    // unconditionally advances renewalDate by one billing
                    // period), so a double-click must never fire twice.
                    // This check-and-set on a ref happens synchronously in
                    // this same click handler call — unlike
                    // `payPremiumMutation.isPending`, which only flips after
                    // a setTimeout(0) macrotask and can't observe a second
                    // click that lands before that tick. `payPending` below
                    // still disables the button once it does catch up, as
                    // complementary UX feedback.
                    if (payInFlightRef.current.has(item.id)) return;
                    payInFlightRef.current.add(item.id);
                    payPremiumMutation.mutate(item.id);
                  }
                : undefined
            }
            payPending={
              payPremiumMutation.isPending &&
              payPremiumMutation.variables === item.id
            }
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
        label={deleteTarget ? "Asuransi" : null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}
