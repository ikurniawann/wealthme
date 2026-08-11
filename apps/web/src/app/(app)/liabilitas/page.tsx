"use client";

import { useEffect, useState } from "react";
import { Plus, X, CreditCard, Landmark, type LucideIcon } from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { useLocale } from "@/hooks/use-locale";
import type { Locale } from "@/i18n";
import { apiFetch } from "@/lib/api-client";
import { formatAmountInput, formatRupiah, parseRupiah } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CardSideActions, ConfirmDeleteDialog } from "@/components/crud";
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

// ── Local helpers (EPIC-024 group G) ────────────────────────────────────────

// EPIC-023 E2 — mirrors `asuransi/page.tsx`'s local `AccountDto` shape; only
// the fields the source-account picker needs.
type AccountDto = { id: string; name: string; institution: string | null };

// Mirrors the local `extractApiErrorMessage` helper already used on
// /rekening, /dana, /tax, /mastercoa, /akun, /masterdata — the server's real
// message (e.g. `remove()`'s ConflictException naming the blocking budget,
// or `pay()`'s BadRequestException naming the max payable amount) must reach
// the user instead of a generic fallback (silent-failure-hunter routing).
function extractApiErrorMessage(err: unknown, fallback: string): string {
  // silent-failure-hunter (review round 2) — a browser network TypeError
  // ("Failed to fetch") also satisfies `"message" in err`; only trust the
  // message when the object also carries the ApiError shape's `status`
  // field, otherwise a raw network/abort error would leak to the user
  // verbatim instead of the localized fallback.
  return err && typeof err === "object" && "status" in err && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

// Review round 2 (HIGH) — every liability mutation (create/edit/delete/pay)
// changes remainingBalance, which feeds net worth and the dashboard summary
// the same way a normal transaction does. `payMutation` already invalidated
// this full set; create/edit/delete only invalidated the liabilities lists,
// leaving the net-worth hero and dashboard stale after those actions.
function invalidateLiabilityRelatedQueries(
  queryClient: QueryClient,
  familyGroupId: string,
) {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.liabilities.all(familyGroupId),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.liabilities.summary(familyGroupId),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.budgets.all(familyGroupId),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.accounts.all(familyGroupId),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.dashboard.summary(familyGroupId),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.netWorth.summary(familyGroupId),
  });
  void queryClient.invalidateQueries({ queryKey: ["reports", familyGroupId] });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.transactions.all(familyGroupId),
  });
}

/**
 * Client-side amortisation PREVIEW only — mirrors the shape of the backend's
 * `splitPayment` (apps/api/src/liabilities/amortisation.util.ts) using plain
 * numbers (not BigInt) since this never posts a transaction itself; the real
 * split for an actual payment is always computed server-side in `pay()`.
 */
function computeAmortisationPreview(
  remainingBalance: number,
  monthlyPaymentAmount: number,
  annualRatePercent: number,
): {
  monthlyInterest: number;
  monthlyPrincipal: number;
  months: number | null;
} {
  const monthlyRate = annualRatePercent / 100 / 12;
  const monthlyInterest = Math.min(
    Math.round(remainingBalance * monthlyRate),
    monthlyPaymentAmount,
  );
  const monthlyPrincipal = Math.max(
    0,
    Math.min(monthlyPaymentAmount - monthlyInterest, remainingBalance),
  );
  const months =
    monthlyPrincipal > 0
      ? Math.ceil(remainingBalance / monthlyPrincipal)
      : null;
  return { monthlyInterest, monthlyPrincipal, months };
}

// ── Constants ─────────────────────────────────────────────────────────────────

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

function formatLocaleDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
  });
}

function getDtaRiskLabel(
  dta: number,
  t: ReturnType<typeof useLocale>["t"],
): {
  label: string;
  color: string;
} {
  if (dta < 30)
    return { label: t.liabilitas.riskVerySafe, color: "var(--success)" };
  if (dta < 50)
    return { label: t.liabilitas.riskSafe, color: "var(--success)" };
  if (dta < 70)
    return { label: t.liabilitas.riskCaution, color: "var(--warning)" };
  return { label: t.liabilitas.riskRisky, color: "var(--destructive)" };
}

function getDueDateStatus(
  dueDate: string | null,
  t: ReturnType<typeof useLocale>["t"],
  locale: Locale,
): {
  text: string;
  variant: "success" | "danger" | "warning";
} {
  if (!dueDate) return { text: t.liabilitas.statusOngoing, variant: "success" };
  const due = new Date(dueDate);
  const now = new Date();
  const diffDays = Math.floor(
    (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays < 0)
    return { text: t.liabilitas.statusOverdue, variant: "danger" };
  const text = `${t.liabilitas.statusDuePrefix}${formatLocaleDate(dueDate, locale)}`;
  if (diffDays <= 7) return { text, variant: "warning" };
  return { text, variant: "success" };
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

// ── Add / Edit Liability Modal ─────────────────────────────────────────────
// EPIC-024 group G (G1) — unified into one modal (mirrors asuransi's
// InsuranceModal) so editing an existing liability (`PATCH /:id`) reuses the
// exact same field set/validation as creating one, instead of duplicating
// the form.

interface LiabilityModalProps {
  familyGroupId: string;
  editing: LiabilityDto | null;
  onClose: () => void;
}

interface LiabilityBody {
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

function LiabilityModal({
  familyGroupId,
  editing,
  onClose,
}: LiabilityModalProps) {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;

  const [name, setName] = useState(editing?.name ?? "");
  const [institution, setInstitution] = useState(editing?.institution ?? "");
  const [type, setType] = useState<LiabilityTypeValue>(
    editing?.type ?? "kartu_kredit",
  );
  const [totalDebt, setTotalDebt] = useState(
    editing ? Number(BigInt(editing.totalDebt)).toLocaleString("id-ID") : "",
  );
  const [remainingBalance, setRemainingBalance] = useState(
    editing
      ? Number(BigInt(editing.remainingBalance)).toLocaleString("id-ID")
      : "",
  );
  // Review round 2 (MEDIUM) — always prefill from the saved value, including
  // an explicit 0 (e.g. an interest-free family loan). The old `> 0` guard
  // blanked the field for a saved 0, making it indistinguishable from
  // "never set" and impossible to re-save as an explicit 0 below.
  const [minimumPayment, setMinimumPayment] = useState(
    editing
      ? Number(BigInt(editing.minimumPayment)).toLocaleString("id-ID")
      : "",
  );
  const [interestRate, setInterestRate] = useState(
    editing && parseFloat(editing.interestRate) > 0 ? editing.interestRate : "",
  );
  const [dueDate, setDueDate] = useState(
    editing?.dueDate ? editing.dueDate.slice(0, 10) : "",
  );
  const [autoAdvanceDueDate, setAutoAdvanceDueDate] = useState(
    editing?.autoAdvanceDueDate ?? false,
  );
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const mutation = useMutation({
    mutationFn: (body: LiabilityBody) => {
      if (!token || !familyGroupId) {
        return Promise.reject(new Error("Not authenticated"));
      }
      return editing
        ? apiFetch<LiabilityDto>(
            `/family-groups/${familyGroupId}/liabilities/${editing.id}`,
            { method: "PATCH", token, body: JSON.stringify(body) },
          )
        : apiFetch<LiabilityDto>(
            `/family-groups/${familyGroupId}/liabilities`,
            { method: "POST", token, body: JSON.stringify(body) },
          );
    },
    onSuccess: () => {
      invalidateLiabilityRelatedQueries(queryClient, familyGroupId);
      toast.success(
        editing ? t.liabilitas.toastUpdated : t.liabilitas.toastAdded,
      );
      onClose();
    },
    onError: (err: unknown) => {
      toast.error(
        extractApiErrorMessage(
          err,
          editing
            ? t.liabilitas.toastUpdateFailed
            : t.liabilitas.toastAddFailed,
        ),
      );
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
      // Review round 2 (MEDIUM) — `toDigits(...) || undefined` used to
      // coalesce an explicit "0" the same as "field cleared/never touched",
      // silently omitting the field from the request and leaving the old
      // (possibly non-zero) minimumPayment on the server untouched. Send
      // "0" explicitly instead so a cleared field always persists as 0.
      minimumPayment: toDigits(minimumPayment) || "0",
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
          <span className="text-[15px] font-bold">
            {editing ? t.liabilitas.modalEditTitle : t.liabilitas.modalTitle}
          </span>
          <button
            type="button"
            aria-label={t.liabilitas.modalCloseAriaLabel}
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
              {t.liabilitas.fieldNameLabel}
            </label>
            <input
              id="liability-name"
              className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
              placeholder={t.liabilitas.fieldNamePlaceholder}
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
              {t.liabilitas.fieldInstitutionLabel}
            </label>
            <input
              id="liability-institution"
              className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
              placeholder={t.liabilitas.fieldInstitutionPlaceholder}
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
              {t.liabilitas.fieldTypeLabel}
            </label>
            <select
              id="liability-type"
              className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
              value={type}
              onChange={(e) => setType(e.target.value as LiabilityTypeValue)}
            >
              {LIABILITY_TYPES.map((liabilityType) => (
                <option key={liabilityType} value={liabilityType}>
                  {t.liabilitas.typeLabels[liabilityType]}
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
                {t.liabilitas.fieldTotalDebtLabel}
              </label>
              <input
                id="liability-total-debt"
                className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
                placeholder={t.liabilitas.fieldTotalDebtPlaceholder}
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
                {t.liabilitas.fieldRemainingLabel}
              </label>
              <input
                id="liability-remaining"
                className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
                placeholder={t.liabilitas.fieldRemainingPlaceholder}
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
                {t.liabilitas.fieldMinPaymentLabel}
              </label>
              <input
                id="liability-min-payment"
                className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
                placeholder={t.liabilitas.fieldMinPaymentPlaceholder}
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
                {t.liabilitas.fieldInterestRateLabel}
              </label>
              <input
                id="liability-interest-rate"
                className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
                placeholder={t.liabilitas.fieldInterestRatePlaceholder}
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
              {t.liabilitas.fieldDueDateLabel}
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
                {t.liabilitas.autoAdvanceLabel}
              </label>
            )}
          </div>

          <div>
            <label
              htmlFor="liability-notes"
              className="mb-1 block text-[12px] font-semibold text-muted-foreground"
            >
              {t.liabilitas.fieldNotesLabel}
            </label>
            <input
              id="liability-notes"
              className="w-full rounded-[10px] border bg-background px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary"
              placeholder={t.liabilitas.fieldNotesPlaceholder}
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
            {mutation.isPending ? t.liabilitas.saving : t.liabilitas.saveButton}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ── Liability Card ─────────────────────────────────────────────────────────────

interface LiabilityCardProps {
  item: LiabilityDto;
  onDetail: () => void;
  onEdit: () => void;
  onPay: () => void;
  onDelete: () => void;
}

function LiabilityCard({
  item,
  onDetail,
  onEdit,
  onPay,
  onDelete,
}: LiabilityCardProps) {
  const { t, locale } = useLocale();
  const isCreditCard = item.type === "kartu_kredit";
  const status = getDueDateStatus(item.dueDate, t, locale);

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
  const progressLabel = isCreditCard
    ? t.liabilitas.progressUsageLabel
    : t.liabilitas.progressPayoffLabel;

  const iconCfg = LIABILITY_TYPE_ICON[item.type] ?? {
    icon: CreditCard,
    chip: "bg-red-100 text-red-600",
  };
  const typeLabel =
    t.liabilitas.typeLabels[item.type as LiabilityTypeValue] ?? item.type;

  return (
    <div className="transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
      <Card className="gap-0 p-[18px]">
        <div className="flex items-stretch gap-3">
          <div className="min-w-0 flex-1">
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
                    ? `${item.institution} · ${typeLabel}`
                    : typeLabel}
                </div>
              </div>
              <div className="ml-auto">
                <StatusBadge variant={status.variant}>
                  {status.text}
                </StatusBadge>
              </div>
            </div>

            <div className="mb-3.5 grid grid-cols-2 gap-3.5 md:grid-cols-4">
              <div>
                <div className="mb-[3px] text-[11px] text-muted-foreground">
                  {isCreditCard
                    ? t.liabilitas.ccCurrentBillLabel
                    : t.liabilitas.loanRemainingPrincipalLabel}
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
                  {isCreditCard
                    ? t.liabilitas.ccLimitLabel
                    : t.liabilitas.loanTotalLabel}
                </div>
                <div className="text-[13.5px] font-bold">
                  {formatRupiah(totalDebt)}
                </div>
              </div>
              {minimumPayment > 0 && (
                <div>
                  <div className="mb-[3px] text-[11px] text-muted-foreground">
                    {isCreditCard
                      ? t.liabilitas.ccMinPaymentLabel
                      : t.liabilitas.loanInstallmentLabel}
                  </div>
                  <div className="text-[13.5px] font-bold">
                    {formatRupiah(minimumPayment)}
                  </div>
                </div>
              )}
              {parseFloat(item.interestRate) > 0 && (
                <div>
                  <div className="mb-[3px] text-[11px] text-muted-foreground">
                    {isCreditCard
                      ? t.liabilitas.ccInterestMonthlyLabel
                      : t.liabilitas.loanInterestYearlyLabel}
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
                <span className="text-[11.5px] font-semibold">
                  {progressLabel}
                </span>
                <span
                  className="text-[12px] font-bold"
                  style={{ color: progressColor }}
                >
                  {progressValue}%
                </span>
              </div>
              <AnimatedProgress value={progressValue} color={progressColor} />
            </div>
          </div>
          <CardSideActions
            onDetail={onDetail}
            onEdit={onEdit}
            onPay={onPay}
            onDelete={onDelete}
            payDisabled={item.paidThisPeriod}
            payDisabledLabel={t.liabilitas.payAlreadyPaidTooltip}
          />
        </div>
      </Card>
    </div>
  );
}

// ── Detail Dialog ─────────────────────────────────────────────────────────
// EPIC-024 group G (G1) — read-only Detail dialog: full field info + a
// client-side amortisation summary (US-LIAB-6). Honestly labeled as an
// estimate (`amortisationDisclaimer`) — no schedule is persisted server-side.

function LiabilityDetailDialog({
  item,
  onClose,
}: {
  item: LiabilityDto | null;
  onClose: () => void;
}) {
  const { t, locale } = useLocale();
  const typeLabel = item
    ? (t.liabilitas.typeLabels[item.type as LiabilityTypeValue] ?? item.type)
    : "";
  const totalDebt = item ? Number(BigInt(item.totalDebt)) : 0;
  const remaining = item ? Number(BigInt(item.remainingBalance)) : 0;
  const minimumPayment = item ? Number(BigInt(item.minimumPayment)) : 0;
  const interestRatePercent = item ? parseFloat(item.interestRate) || 0 : 0;
  const preview = computeAmortisationPreview(
    remaining,
    minimumPayment,
    interestRatePercent,
  );

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogTitle className="text-[17px] font-extrabold">
          {t.liabilitas.detailDialogTitle}
        </DialogTitle>
        {item && (
          <div className="space-y-3.5 text-[13px]">
            <div>
              <div className="text-[15px] font-bold">{item.name}</div>
              <div className="text-[11.5px] text-muted-foreground">
                {item.institution
                  ? `${item.institution} · ${typeLabel}`
                  : typeLabel}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted p-3.5">
              <div>
                <div className="text-[11px] text-muted-foreground">
                  {t.liabilitas.loanRemainingPrincipalLabel}
                </div>
                <div
                  className="text-[14px] font-bold"
                  style={{ color: "var(--danger)" }}
                >
                  {formatRupiah(remaining)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">
                  {t.liabilitas.loanTotalLabel}
                </div>
                <div className="text-[14px] font-bold">
                  {formatRupiah(totalDebt)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">
                  {t.liabilitas.loanInstallmentLabel}
                </div>
                <div className="text-[14px] font-bold">
                  {minimumPayment > 0 ? formatRupiah(minimumPayment) : "—"}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">
                  {t.liabilitas.loanInterestYearlyLabel}
                </div>
                <div className="text-[14px] font-bold">
                  {interestRatePercent > 0 ? `${item.interestRate}%` : "—"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-[3px] text-[11px] text-muted-foreground">
                  {t.liabilitas.fieldDueDateLabel}
                </div>
                <div className="text-[13px] font-semibold">
                  {item.dueDate ? formatLocaleDate(item.dueDate, locale) : "—"}
                </div>
              </div>
              <div>
                <div className="mb-[3px] text-[11px] text-muted-foreground">
                  {t.liabilitas.detailStatusLabel}
                </div>
                <StatusBadge variant={item.paidThisPeriod ? "success" : "gray"}>
                  {item.paidThisPeriod
                    ? t.liabilitas.detailPaidThisPeriodLabel
                    : t.liabilitas.detailNotPaidThisPeriodLabel}
                </StatusBadge>
              </div>
            </div>

            {item.notes && (
              <div>
                <div className="mb-[3px] text-[11px] text-muted-foreground">
                  {t.liabilitas.fieldNotesLabel}
                </div>
                <div className="text-[13px]">{item.notes}</div>
              </div>
            )}

            <div className="rounded-lg border p-3.5">
              <div className="mb-2 text-[12.5px] font-bold">
                {t.liabilitas.amortisationTitle}
              </div>
              {minimumPayment > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[11px] text-muted-foreground">
                        {t.liabilitas.amortisationMonthlyPrincipalLabel}
                      </div>
                      <div className="text-[13.5px] font-bold">
                        {formatRupiah(preview.monthlyPrincipal)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">
                        {t.liabilitas.amortisationMonthlyInterestLabel}
                      </div>
                      <div
                        className="text-[13.5px] font-bold"
                        style={{ color: "var(--danger)" }}
                      >
                        {formatRupiah(preview.monthlyInterest)}
                      </div>
                    </div>
                  </div>
                  {preview.months !== null ? (
                    <div className="mt-2.5 text-[12.5px] font-semibold text-success">
                      {t.liabilitas.amortisationEstimatedPayoffPrefix}
                      {preview.months}
                      {t.liabilitas.amortisationEstimatedPayoffSuffix}
                    </div>
                  ) : (
                    <div className="mt-2.5 text-[12px] text-destructive">
                      {t.liabilitas.amortisationNoPayoffNote}
                    </div>
                  )}
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {t.liabilitas.amortisationDisclaimer}
                  </div>
                </>
              ) : (
                <div className="text-[12px] text-muted-foreground">
                  {t.liabilitas.amortisationUnavailableNote}
                </div>
              )}
            </div>
          </div>
        )}
        <div className="pt-2">
          <Button variant="outline" className="w-full" onClick={onClose}>
            {t.liabilitas.detailCloseButton}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Pay Dialog ─────────────────────────────────────────────────────────────
// EPIC-024 group G (G1) — records a REAL payment via
// `POST .../liabilities/:id/pay`: debits the chosen source account, and the
// server splits principal/interest (`splitPayment`). This dialog's
// principal/interest numbers are only a client-side PREVIEW of that split —
// the authoritative split always happens server-side.

function PayLiabilityDialog({
  item,
  accounts,
  amount,
  onAmountChange,
  sourceAccountId,
  onSourceAccountChange,
  isPending,
  onClose,
  onConfirm,
}: {
  item: LiabilityDto | null;
  accounts: AccountDto[];
  amount: string;
  onAmountChange: (v: string) => void;
  sourceAccountId: string;
  onSourceAccountChange: (id: string) => void;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useLocale();
  const parsedAmount = parseRupiah(amount);
  const preview = item
    ? computeAmortisationPreview(
        Number(BigInt(item.remainingBalance)),
        parsedAmount,
        parseFloat(item.interestRate) || 0,
      )
    : { monthlyInterest: 0, monthlyPrincipal: 0, months: null };

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogTitle className="text-[17px] font-extrabold">
          {t.liabilitas.payDialogTitle}
        </DialogTitle>
        {item && (
          <div className="space-y-3 text-[13px]">
            <div>
              <label
                htmlFor="pay-liability-amount"
                className="mb-1.5 block text-[12.5px] font-semibold"
              >
                {t.liabilitas.payAmountLabel}
              </label>
              <div className="flex items-center gap-2 rounded-md border bg-background px-3.5 py-2.5 transition-colors focus-within:border-primary focus-within:bg-card">
                <span className="text-[13.5px] text-muted-foreground">Rp</span>
                <input
                  id="pay-liability-amount"
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) =>
                    onAmountChange(formatAmountInput(e.target.value))
                  }
                  placeholder="0"
                  className="w-full bg-transparent text-[13.5px] outline-none"
                />
              </div>
            </div>

            {parsedAmount > 0 && (
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted p-3.5">
                <div>
                  <div className="text-[11px] text-muted-foreground">
                    {t.liabilitas.payPrincipalPreviewLabel}
                  </div>
                  <div className="text-[13.5px] font-bold">
                    {formatRupiah(preview.monthlyPrincipal)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">
                    {t.liabilitas.payInterestPreviewLabel}
                  </div>
                  <div
                    className="text-[13.5px] font-bold"
                    style={{ color: "var(--danger)" }}
                  >
                    {formatRupiah(preview.monthlyInterest)}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="pay-liability-source-account"
                className="mb-1.5 block text-[12.5px] font-semibold"
              >
                {t.liabilitas.paySourceAccountLabel}
              </label>
              <select
                id="pay-liability-source-account"
                value={sourceAccountId}
                onChange={(e) => onSourceAccountChange(e.target.value)}
                className="w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card"
              >
                <option value="">
                  {t.liabilitas.paySourceAccountPlaceholder}
                </option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.institution ? ` (${a.institution})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        <div className="flex gap-2.5 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            className="flex-1"
            disabled={isPending || !sourceAccountId || parsedAmount <= 0}
            onClick={onConfirm}
          >
            {isPending
              ? t.liabilitas.payProcessing
              : t.liabilitas.payConfirmButton}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LiabilitasPage() {
  const { t } = useLocale();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<LiabilityDto | null>(null);
  const [detailItem, setDetailItem] = useState<LiabilityDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LiabilityDto | null>(null);
  const [payTarget, setPayTarget] = useState<LiabilityDto | null>(null);
  const [paySourceAccountId, setPaySourceAccountId] = useState("");
  const [payAmount, setPayAmount] = useState("");

  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  const familyGroupId = session?.familyGroupId;
  const queryClient = useQueryClient();

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

  // EPIC-024 group G (G1) — source-account picker for the real liability
  // payment (mirrors /asuransi's own accounts query).
  const { data: accounts = [] } = useQuery<AccountDto[]>({
    queryKey: queryKeys.accounts.all(familyGroupId ?? ""),
    queryFn: () =>
      apiFetch<AccountDto[]>(`/family-groups/${familyGroupId}/accounts`, {
        token,
      }),
    enabled: Boolean(familyGroupId) && Boolean(token),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/family-groups/${familyGroupId}/liabilities/${id}`, {
        method: "DELETE",
        token,
      }),
    onSuccess: () => {
      invalidateLiabilityRelatedQueries(queryClient, familyGroupId ?? "");
      toast.success(t.liabilitas.toastDeleted);
    },
    // silent-failure-hunter routing — the API refuses deletion with a real
    // reason (`ConflictException` naming the blocking budget line, see
    // `LiabilitiesService.remove()`); surface it instead of a generic toast.
    onError: (err: unknown) => {
      toast.error(extractApiErrorMessage(err, t.liabilitas.toastDeleteFailed));
    },
  });

  // EPIC-024 group G (G1) — calls the REAL pay endpoint
  // (`LiabilitiesService.pay()`): debits `paySourceAccountId`, splits
  // principal/interest server-side, and reduces `remainingBalance`.
  const payMutation = useMutation({
    mutationFn: (params: {
      item: LiabilityDto;
      sourceAccountId: string;
      amount: string;
    }) =>
      apiFetch<LiabilityDto>(
        `/family-groups/${familyGroupId}/liabilities/${params.item.id}/pay`,
        {
          token,
          method: "POST",
          body: JSON.stringify({
            sourceAccountId: params.sourceAccountId,
            amount: params.amount,
          }),
        },
      ),
    onSuccess: () => {
      // Mirrors /asuransi's own pay-mutation invalidation set — paying
      // moves money and touches budgets/accounts/reports/net worth exactly
      // like a normal transaction does.
      invalidateLiabilityRelatedQueries(queryClient, familyGroupId ?? "");
      setPayTarget(null);
      setPaySourceAccountId("");
      setPayAmount("");
      toast.success(t.liabilitas.toastPaid);
    },
    // silent-failure-hunter routing — `pay()` can 400 (amount exceeds max
    // payable) or 409 (already paid this period); the real message must
    // reach the user, not a generic fallback.
    onError: (err: unknown) => {
      toast.error(extractApiErrorMessage(err, t.liabilitas.toastPayFailed));
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
      ? getDtaRiskLabel(dtaRatio, t)
      : { label: "—", color: "var(--muted-foreground)" };

  useEffect(() => {
    if (isError) {
      toast.error(t.liabilitas.errorLoad);
    }
  }, [isError, t]);

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
            {t.liabilitas.totalLiabilitiesLabel}
          </div>
          {isLoading ? (
            <div className="animate-pulse h-7 w-36 rounded bg-red-200" />
          ) : (
            <div className="mono text-[22px] font-black text-destructive">
              <CountUpRupiah value={Number(totalRemaining)} />
            </div>
          )}
          <div className="text-[11px] text-[#B91C1C]">
            {t.liabilitas.remainingActiveSuffix}
          </div>
        </div>
        <div className="rounded-[14px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">
            {t.liabilitas.dtaRatioLabel}
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
        >
          <Plus className="size-4" /> {t.liabilitas.addButton}
        </Button>
      </div>

      {isError && (
        <div
          role="alert"
          className="rounded-[14px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive"
        >
          {t.liabilitas.errorLoad}
        </div>
      )}

      {isLoading ? (
        <>
          <LiabilityCardSkeleton />
          <LiabilityCardSkeleton />
        </>
      ) : (liabilities ?? []).length === 0 ? (
        <div className="rounded-[14px] border bg-card px-4 py-10 text-center text-[13px] text-muted-foreground">
          {t.liabilitas.emptyState}
        </div>
      ) : (
        (liabilities ?? []).map((item, i) => (
          <Rise key={item.id} index={i}>
            <LiabilityCard
              item={item}
              onDetail={() => setDetailItem(item)}
              onEdit={() => setEditingItem(item)}
              onPay={() => {
                setPayTarget(item);
                setPayAmount(
                  Number(BigInt(item.minimumPayment)) > 0
                    ? Number(BigInt(item.minimumPayment)).toLocaleString(
                        "id-ID",
                      )
                    : "",
                );
              }}
              onDelete={() => setDeleteTarget(item)}
            />
          </Rise>
        ))
      )}

      {showAddModal && familyGroupId && (
        <LiabilityModal
          familyGroupId={familyGroupId}
          editing={null}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {editingItem && familyGroupId && (
        <LiabilityModal
          familyGroupId={familyGroupId}
          editing={editingItem}
          onClose={() => setEditingItem(null)}
        />
      )}

      <LiabilityDetailDialog
        item={detailItem}
        onClose={() => setDetailItem(null)}
      />

      <ConfirmDeleteDialog
        label={deleteTarget?.name ?? null}
        body={t.liabilitas.deleteConfirmBody}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />

      <PayLiabilityDialog
        item={payTarget}
        accounts={accounts}
        amount={payAmount}
        onAmountChange={setPayAmount}
        sourceAccountId={paySourceAccountId}
        onSourceAccountChange={setPaySourceAccountId}
        isPending={payMutation.isPending}
        onClose={() => {
          setPayTarget(null);
          setPaySourceAccountId("");
          setPayAmount("");
        }}
        onConfirm={() => {
          const amountDigits = parseRupiah(payAmount).toString();
          if (
            !payTarget ||
            !paySourceAccountId ||
            parseRupiah(payAmount) <= 0
          ) {
            toast.warning(t.liabilitas.validationPayAmountPositive);
            return;
          }
          payMutation.mutate({
            item: payTarget,
            sourceAccountId: paySourceAccountId,
            amount: amountDigits,
          });
        }}
      />
    </div>
  );
}
