"use client";

import { useEffect, useState } from "react";
import { Plus, X, CreditCard, Landmark, type LucideIcon } from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";
import { formatRupiah } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AnimatedProgress,
  CountUpRupiah,
  IconChip,
  Rise,
  StatusBadge,
} from "@/components/wm";

import type {
  LiabilityDto,
  LiabilityType,
  NetWorthDto,
} from "@wealthme/contracts";

// ── Constants ─────────────────────────────────────────────────────────────────

const LIABILITY_TYPE_LABEL: Record<string, string> = {
  kartu_kredit: "Kartu Kredit",
  pinjaman_pribadi: "Pinjaman Pribadi",
  kpr: "KPR",
  kendaraan: "Kredit Kendaraan",
  lainnya: "Lainnya",
};

const LIABILITY_TYPE_ICON: Record<string, { icon: LucideIcon; chip: string }> =
  {
    kartu_kredit: { icon: CreditCard, chip: "bg-red-100 text-red-600" },
    pinjaman_pribadi: { icon: Landmark, chip: "bg-blue-100 text-blue-600" },
    kpr: { icon: Landmark, chip: "bg-blue-100 text-blue-600" },
    kendaraan: { icon: CreditCard, chip: "bg-red-100 text-red-600" },
    lainnya: { icon: CreditCard, chip: "bg-red-100 text-red-600" },
  };

const LIABILITY_TYPES = [
  "kartu_kredit",
  "pinjaman_pribadi",
  "kpr",
  "kendaraan",
  "lainnya",
] as const;
type LiabilityTypeValue = LiabilityType;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDtaRiskLabel(dta: number): {
  label: string;
  color: string;
} {
  if (dta < 30) return { label: "Sangat Aman", color: "var(--success)" };
  if (dta < 50) return { label: "Aman", color: "var(--success)" };
  if (dta < 70) return { label: "Waspada", color: "var(--warning)" };
  return { label: "Berisiko", color: "var(--destructive)" };
}

function getDueDateStatus(dueDate: string | null): {
  text: string;
  variant: "success" | "danger" | "warning";
} {
  if (!dueDate) return { text: "Berjalan", variant: "success" };
  const due = new Date(dueDate);
  const now = new Date();
  const diffDays = Math.floor(
    (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays < 0) return { text: "Sudah Jatuh Tempo", variant: "danger" };
  if (diffDays <= 7)
    return {
      text: `Jatuh Tempo ${due.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}`,
      variant: "warning",
    };
  return {
    text: `Jatuh Tempo ${due.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}`,
    variant: "success",
  };
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Bone({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-muted ${className ?? ""}`} />
  );
}

function LiabilityCardSkeleton() {
  return (
    <Card className="gap-0 p-[18px]">
      <div className="mb-3.5 flex items-center gap-2.5">
        <Bone className="size-[38px] rounded-[10px]" />
        <div className="flex-1 space-y-1.5">
          <Bone className="h-3.5 w-40" />
          <Bone className="h-2.5 w-28" />
        </div>
        <Bone className="h-5 w-24 rounded-full" />
      </div>
      <div className="mb-3.5 grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-1">
            <Bone className="h-2.5 w-20" />
            <Bone className="h-3.5 w-24" />
          </div>
        ))}
      </div>
      <Bone className="h-2 w-full rounded-full" />
    </Card>
  );
}

// ── Add Liability Modal ───────────────────────────────────────────────────────

interface AddLiabilityModalProps {
  familyGroupId: string;
  onClose: () => void;
}

interface CreateLiabilityBody {
  name: string;
  institution?: string;
  type: string;
  totalDebt: string;
  remainingBalance: string;
  minimumPayment?: string;
  interestRate?: string;
  dueDate?: string;
  autoAdvanceDueDate?: boolean;
  notes?: string;
}

function AddLiabilityModal({ familyGroupId, onClose }: AddLiabilityModalProps) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;

  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [type, setType] = useState<LiabilityTypeValue>("kartu_kredit");
  const [totalDebt, setTotalDebt] = useState("");
  const [remainingBalance, setRemainingBalance] = useState("");
  const [minimumPayment, setMinimumPayment] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [autoAdvanceDueDate, setAutoAdvanceDueDate] = useState(false);
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: (body: CreateLiabilityBody) => {
      if (!token || !familyGroupId) {
        return Promise.reject(new Error("Not authenticated"));
      }
      return apiFetch<LiabilityDto>(
        `/family-groups/${familyGroupId}/liabilities`,
        { method: "POST", token, body: JSON.stringify(body) },
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.liabilities.all(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.liabilities.summary(familyGroupId),
      });
      toast.success("Liabilitas berhasil ditambahkan");
      onClose();
    },
    onError: () => {
      toast.error("Gagal menambahkan liabilitas. Silakan coba lagi.");
    },
  });

  function toDigits(v: string) {
    return v.replace(/\D/g, "");
  }
  function formatNum(v: string) {
    const d = toDigits(v);
    return d ? parseInt(d, 10).toLocaleString("id-ID") : "";
  }
  // The API requires a dot-decimal string ("2.25"), but Indonesian input
  // conventions use a comma for the decimal separator ("2,25") — normalize
  // before sending, or the backend 400s with no field-level feedback shown
  // to the user (surfaces as a generic "Gagal menambahkan" toast).
  function toDecimalString(v: string): string | undefined {
    const cleaned = v
      .trim()
      .replace(",", ".")
      .replace(/[^\d.]/g, "");
    return cleaned.match(/^\d+(\.\d{1,2})?/)?.[0] || undefined;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const totalDigits = toDigits(totalDebt);
    const remainDigits = toDigits(remainingBalance);
    if (!name.trim() || !totalDigits || !remainDigits) return;
    mutation.mutate({
      name: name.trim(),
      institution: institution.trim() || undefined,
      type,
      totalDebt: totalDigits,
      remainingBalance: remainDigits,
      minimumPayment: toDigits(minimumPayment) || undefined,
      interestRate: toDecimalString(interestRate),
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      autoAdvanceDueDate: dueDate ? autoAdvanceDueDate : undefined,
      notes: notes.trim() || undefined,
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
          <span className="text-[15px] font-bold">Tambah Liabilitas</span>
          <button
            type="button"
            aria-label="Tutup modal"
            onClick={onClose}
            className="rounded-md p-1 hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label
              htmlFor="liability-name"
              className="mb-1 block text-[12px] font-semibold text-muted-foreground"
            >
              Nama
            </label>
            <input
              id="liability-name"
              className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
              placeholder="cth. Kartu Kredit BCA"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label
              htmlFor="liability-institution"
              className="mb-1 block text-[12px] font-semibold text-muted-foreground"
            >
              Institusi (opsional)
            </label>
            <input
              id="liability-institution"
              className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
              placeholder="cth. BCA"
              maxLength={100}
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
            />
          </div>

          <div>
            <label
              htmlFor="liability-type"
              className="mb-1 block text-[12px] font-semibold text-muted-foreground"
            >
              Jenis
            </label>
            <select
              id="liability-type"
              className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
              value={type}
              onChange={(e) => setType(e.target.value as LiabilityTypeValue)}
            >
              {LIABILITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {LIABILITY_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="liability-total-debt"
                className="mb-1 block text-[12px] font-semibold text-muted-foreground"
              >
                Total Utang / Limit (Rp)
              </label>
              <input
                id="liability-total-debt"
                className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
                placeholder="30.000.000"
                inputMode="numeric"
                value={totalDebt}
                onChange={(e) => setTotalDebt(formatNum(e.target.value))}
                required
              />
            </div>
            <div>
              <label
                htmlFor="liability-remaining"
                className="mb-1 block text-[12px] font-semibold text-muted-foreground"
              >
                Sisa Tagihan (Rp)
              </label>
              <input
                id="liability-remaining"
                className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
                placeholder="8.000.000"
                inputMode="numeric"
                value={remainingBalance}
                onChange={(e) => setRemainingBalance(formatNum(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="liability-min-payment"
                className="mb-1 block text-[12px] font-semibold text-muted-foreground"
              >
                Min. Bayar (Rp, opsional)
              </label>
              <input
                id="liability-min-payment"
                className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
                placeholder="800.000"
                inputMode="numeric"
                value={minimumPayment}
                onChange={(e) => setMinimumPayment(formatNum(e.target.value))}
              />
            </div>
            <div>
              <label
                htmlFor="liability-interest-rate"
                className="mb-1 block text-[12px] font-semibold text-muted-foreground"
              >
                Bunga % (opsional)
              </label>
              <input
                id="liability-interest-rate"
                className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
                placeholder="2.25"
                inputMode="decimal"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="liability-due-date"
              className="mb-1 block text-[12px] font-semibold text-muted-foreground"
            >
              Tanggal Jatuh Tempo (opsional)
            </label>
            <input
              id="liability-due-date"
              type="date"
              className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            {dueDate && (
              <label className="mt-2 flex items-center gap-2 text-[12px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={autoAdvanceDueDate}
                  onChange={(e) => setAutoAdvanceDueDate(e.target.checked)}
                  className="size-3.5"
                />
                Majukan otomatis ke bulan berikutnya setelah lewat jatuh tempo
              </label>
            )}
          </div>

          <div>
            <label
              htmlFor="liability-notes"
              className="mb-1 block text-[12px] font-semibold text-muted-foreground"
            >
              Catatan (opsional)
            </label>
            <input
              id="liability-notes"
              className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
              placeholder="cth. Visa Platinum · jatuh tempo tgl 15"
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
            {mutation.isPending ? "Menyimpan…" : "Simpan Liabilitas"}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ── Liability Card ─────────────────────────────────────────────────────────────

function LiabilityCard({ item }: { item: LiabilityDto }) {
  const isCreditCard = item.type === "kartu_kredit";
  const status = getDueDateStatus(item.dueDate);

  const totalDebt = item.totalDebt ? Number(BigInt(item.totalDebt)) : 0;
  const remaining = item.remainingBalance
    ? Number(BigInt(item.remainingBalance))
    : 0;
  const minimumPayment = item.minimumPayment
    ? Number(BigInt(item.minimumPayment))
    : 0;

  const progressValue = isCreditCard
    ? 100 - item.paymentRatio
    : item.paymentRatio;
  const progressColor =
    progressValue >= 80
      ? "var(--danger)"
      : progressValue >= 50
        ? "var(--warning)"
        : "var(--success)";
  const progressLabel = isCreditCard ? "Penggunaan Limit" : "Progres Pelunasan";

  const iconCfg = LIABILITY_TYPE_ICON[item.type] ?? {
    icon: CreditCard,
    chip: "bg-red-100 text-red-600",
  };

  return (
    <div className="transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
      <Card className="gap-0 p-[18px]">
        <div className="mb-3.5 flex items-center gap-2.5">
          <IconChip
            icon={iconCfg.icon}
            className={iconCfg.chip}
            size={38}
            rounded="rounded-[10px]"
          />
          <div>
            <div className="text-[14px] font-bold">{item.name}</div>
            <div className="text-[11.5px] text-muted-foreground">
              {item.institution
                ? `${item.institution} · ${LIABILITY_TYPE_LABEL[item.type] ?? item.type}`
                : (LIABILITY_TYPE_LABEL[item.type] ?? item.type)}
            </div>
          </div>
          <div className="ml-auto">
            <StatusBadge variant={status.variant}>{status.text}</StatusBadge>
          </div>
        </div>

        <div className="mb-3.5 grid grid-cols-2 gap-3.5 md:grid-cols-4">
          <div>
            <div className="mb-[3px] text-[11px] text-muted-foreground">
              {isCreditCard ? "Tagihan Berjalan" : "Sisa Pokok"}
            </div>
            <div
              className="text-[13.5px] font-bold"
              style={{ color: "var(--danger)" }}
            >
              {formatRupiah(remaining)}
            </div>
          </div>
          <div>
            <div className="mb-[3px] text-[11px] text-muted-foreground">
              {isCreditCard ? "Limit Kredit" : "Total Pinjaman"}
            </div>
            <div className="text-[13.5px] font-bold">
              {formatRupiah(totalDebt)}
            </div>
          </div>
          {minimumPayment > 0 && (
            <div>
              <div className="mb-[3px] text-[11px] text-muted-foreground">
                {isCreditCard ? "Minimum Bayar" : "Cicilan/Bulan"}
              </div>
              <div className="text-[13.5px] font-bold">
                {formatRupiah(minimumPayment)}
              </div>
            </div>
          )}
          {parseFloat(item.interestRate) > 0 && (
            <div>
              <div className="mb-[3px] text-[11px] text-muted-foreground">
                {isCreditCard ? "Bunga/Bulan" : "Bunga/Tahun"}
              </div>
              <div
                className="text-[13.5px] font-bold"
                style={{ color: "var(--danger)" }}
              >
                {item.interestRate}%
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11.5px] font-semibold">{progressLabel}</span>
            <span
              className="text-[12px] font-bold"
              style={{ color: progressColor }}
            >
              {progressValue}%
            </span>
          </div>
          <AnimatedProgress value={progressValue} color={progressColor} />
        </div>
      </Card>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LiabilitasPage() {
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  const familyGroupId = session?.familyGroupId;

  const {
    data: liabilities,
    isLoading,
    isError,
  } = useQuery<LiabilityDto[]>({
    queryKey: queryKeys.liabilities.all(familyGroupId ?? ""),
    enabled: Boolean(familyGroupId) && Boolean(token),
    queryFn: ({ signal }) => {
      if (!familyGroupId) throw new Error("familyGroupId not available");
      return apiFetch<LiabilityDto[]>(
        `/family-groups/${familyGroupId}/liabilities`,
        { token, signal },
      );
    },
  });

  const { data: netWorthData, isLoading: isNetWorthLoading } =
    useQuery<NetWorthDto>({
      queryKey: queryKeys.netWorth.summary(familyGroupId ?? ""),
      enabled: Boolean(familyGroupId) && Boolean(token),
      queryFn: ({ signal }) => {
        if (!familyGroupId) throw new Error("familyGroupId not available");
        return apiFetch<NetWorthDto>(
          `/family-groups/${familyGroupId}/dashboard/net-worth`,
          { token, signal },
        );
      },
    });

  const assetsTotal = netWorthData ? Number(netWorthData.assetsTotal) : 0;
  const liabilitiesTotal = netWorthData
    ? Number(netWorthData.liabilitiesTotal)
    : 0;
  const dtaRatio =
    assetsTotal > 0 ? (liabilitiesTotal / assetsTotal) * 100 : null;
  const dtaDisplay = dtaRatio !== null ? `${dtaRatio.toFixed(1)}%` : "—";
  const dtaRisk =
    dtaRatio !== null
      ? getDtaRiskLabel(dtaRatio)
      : { label: "—", color: "var(--muted-foreground)" };

  useEffect(() => {
    if (isError) {
      toast.error("Gagal memuat data liabilitas. Silakan refresh halaman.");
    }
  }, [isError]);

  const totalRemaining = (liabilities ?? []).reduce(
    (sum, l) =>
      sum + (l.remainingBalance ? BigInt(l.remainingBalance) : BigInt(0)),
    BigInt(0),
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3.5">
        <div className="rounded-[14px] border border-[#FECACA] bg-[#FEE2E2] p-4">
          <div className="mb-1 text-[11px] text-[#B91C1C]">
            Total Liabilitas
          </div>
          {isLoading ? (
            <div className="animate-pulse h-7 w-36 rounded bg-red-200" />
          ) : (
            <div className="mono text-[22px] font-black text-destructive">
              <CountUpRupiah value={Number(totalRemaining)} />
            </div>
          )}
          <div className="text-[11px] text-[#B91C1C]">Sisa tagihan aktif</div>
        </div>
        <div className="rounded-[14px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">
            Rasio Utang terhadap Aset
          </div>
          {isNetWorthLoading ? (
            <div className="animate-pulse h-7 w-20 rounded bg-muted" />
          ) : (
            <div
              className="text-[22px] font-black"
              style={{ color: dtaRisk.color }}
            >
              {dtaDisplay}
            </div>
          )}
          <div
            className="text-[11px] font-medium"
            style={{ color: dtaRisk.color }}
          >
            {dtaRisk.label}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => setShowAddModal(true)}
          disabled={!familyGroupId || !token}
          className="h-auto px-[14px] py-2"
          data-tour="add-liabilitas"
        >
          <Plus className="size-4" /> Tambah Liabilitas
        </Button>
      </div>

      {isError && (
        <div
          role="alert"
          className="rounded-[14px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive"
        >
          Gagal memuat data liabilitas. Silakan refresh halaman.
        </div>
      )}

      {isLoading ? (
        <>
          <LiabilityCardSkeleton />
          <LiabilityCardSkeleton />
        </>
      ) : (liabilities ?? []).length === 0 ? (
        <div className="rounded-[14px] border bg-card px-4 py-10 text-center text-[13px] text-muted-foreground">
          Belum ada liabilitas. Tambahkan kartu kredit atau pinjaman Anda.
        </div>
      ) : (
        (liabilities ?? []).map((item, i) => (
          <Rise key={item.id} index={i}>
            <LiabilityCard item={item} />
          </Rise>
        ))
      )}

      {showAddModal && familyGroupId && (
        <AddLiabilityModal
          familyGroupId={familyGroupId}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
