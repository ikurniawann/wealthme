"use client";

import { useEffect, useState } from "react";
import { SharedToggle } from "@/components/forms/shared-toggle";
import {
  Plus,
  CreditCard,
  EllipsisVertical,
  Landmark,
  FileText,
  Pencil,
  Trash2,
  Banknote,
  CheckCircle2,
  Info,
  Split,
  StickyNote,
  TriangleAlert,
  X as XIcon,
  type LucideIcon,
} from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { useLocale } from "@/hooks/use-locale";
import type { Locale } from "@/i18n";
import { apiFetch } from "@/lib/api-client";
import { DUE_SOON_DAYS, dueState } from "@/lib/due-date";
import { formatPercent } from "@/lib/format";
import { useMoney } from "@/hooks/use-money";
import { queryKeys } from "@/lib/query-keys";
import {
  MoneyInput,
  anyMoneyPending,
  moneyDigits,
  useMoneyField,
  withFxInputs,
} from "@/components/money";
import type { MoneyField } from "@/components/money";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  PanelContent,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/crud";
import {
  BentoCard,
  BentoGrid,
  BentoHero,
  BentoTiles,
  DateField,
  GhostButton,
  HeroKpi,
  Segmented,
  StatusBadge,
  TipsCard,
  PillButton,
  Track,
} from "@/components/wm";
import { MoneyCompact } from "@/components/wm/money-compact";
import { HatchedBarChart } from "@/components/charts/bento-charts";
import "./liabilitas.css";
import { TrendChart } from "@/components/charts/apex-presets";

import {
  extractApiErrorMessage,
  extractPreviewErrorMessage,
} from "./api-error";
import {
  draftFromLiability,
  draftFromPreset,
  toRatePeriodsBody,
  type KprPlanDraft,
} from "./kpr-presets";
import { KprRatePeriodsField } from "./kpr-rate-periods-field";
import { KprFloatingRatesPanel } from "./kpr-floating-rates-panel";
import { KprPrepaymentSimulator } from "./kpr-prepayment-simulator";
import { ScheduleRateCell } from "./schedule-rate-cell";

import type {
  FxInput,
  InterestMethod,
  KprScheme,
  LiabilityDto,
  LiabilityPaymentPreviewDto,
  LiabilityRatePeriodDto,
  LiabilityScheduleDto,
  LiabilityType,
  NetWorthDto,
} from "@wealthme/contracts";

// ── Local helpers (EPIC-024 group G) ────────────────────────────────────────

// EPIC-023 E2 — mirrors `asuransi/page.tsx`'s local `AccountDto` shape; only
// the fields the source-account picker needs.
type AccountDto = { id: string; name: string; institution: string | null };

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

// Prefix of queryKeys.liabilities.all, so every liability mutation refreshes it.
function scheduleQueryOptions(
  familyGroupId: string,
  liabilityId: string,
  token: string | undefined,
) {
  return {
    queryKey: ["liabilities", familyGroupId, "schedule", liabilityId],
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiFetch<LiabilityScheduleDto>(
        `/family-groups/${familyGroupId}/liabilities/${liabilityId}/schedule`,
        { token, signal },
      ),
  };
}

const PROJECTION_MONTHS = 6;

/**
 * Month-by-month total remaining balance, read off each liability's server
 * schedule (`remaining` after installment m). A liability without a schedule
 * is carried flat rather than guessed.
 */
function projectRemainingBalance(
  liabilities: LiabilityDto[],
  schedules: ReadonlyMap<string, LiabilityScheduleDto>,
): number[] {
  return Array.from({ length: PROJECTION_MONTHS }, (_, month) =>
    liabilities.reduce((sum, l) => {
      const rows = schedules.get(l.id)?.rows ?? [];
      const row = rows[Math.min(month, rows.length - 1)];
      return sum + Number(row ? row.remaining : l.remainingBalance);
    }, 0),
  );
}

const PREVIEW_DEBOUNCE_MS = 300;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LIABILITY_TYPE_ICON: Record<string, { icon: LucideIcon }> = {
  kartu_kredit: { icon: CreditCard },
  pinjaman_pribadi: { icon: Landmark },
  kpr: { icon: Landmark },
  kendaraan: { icon: CreditCard },
  lainnya: { icon: CreditCard },
};

const LIABILITY_TYPES = [
  "kartu_kredit",
  "pinjaman_pribadi",
  "kpr",
  "kendaraan",
  "lainnya",
] as const;
type LiabilityTypeValue = LiabilityType;

const DEFAULT_INTEREST_METHOD: Record<LiabilityTypeValue, InterestMethod> = {
  kartu_kredit: "efektif",
  pinjaman_pribadi: "flat",
  kpr: "anuitas",
  kendaraan: "flat",
  lainnya: "efektif",
};

// Types without an entry have exactly one method, so no selector is shown.
const INTEREST_METHOD_OPTIONS: Partial<
  Record<LiabilityTypeValue, readonly InterestMethod[]>
> = {
  pinjaman_pribadi: ["flat", "anuitas"],
  // KPR flat — user decision 2026-09-27: syariah murabahah and some
  // conventional KPR use one fixed margin/instalment for the whole tenor
  // instead of anuitas.
  kpr: ["anuitas", "flat"],
  lainnya: ["efektif", "flat", "anuitas"],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// Server-derived installment due now (a KPR past its fixed period is re-amortised).
function installmentDue(liability: LiabilityDto): number {
  return Number(
    BigInt(liability.currentInstallmentAmount ?? liability.minimumPayment),
  );
}

function formatLocaleDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
  });
}

// Amortisation-schedule rows include the year (prototype: "25 Agu 2026").
function formatScheduleDate(date: Date, locale: Locale): string {
  return date.toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// fix-round1 (Minor) — mirrors the API's `dueDateForPeriod` (same
// month-end clamp: an akad on the 29th-31st falls due on the target
// month's own last day when it is shorter, instead of drifting via
// `anchor + index months`, which compounds wrong once `anchor` itself
// was already clamped to an earlier day than the akad's own day-of-month.
function scheduleRowDueDate(startDate: Date, period: number): Date {
  const targetYear = startDate.getFullYear();
  const targetMonthIndex = startDate.getMonth() + period;
  const lastDayOfTargetMonth = new Date(
    targetYear,
    targetMonthIndex + 1,
    0,
  ).getDate();
  const day = Math.min(startDate.getDate(), lastDayOfTargetMonth);
  return new Date(targetYear, targetMonthIndex, day);
}

// Prototype's payoff-projection x-axis uses real month labels (Agu Sep Okt
// …), not a relative "+1 … +6" — the 6 calendar months following today,
// matching `projectRemainingBalance`'s own month-by-month roll-forward.
function nextSixMonthLabels(locale: Locale): string[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + 1 + i, 1);
    return d.toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
      month: "short",
    });
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

// fix-round1 (Important) — `nextDueDate` is UTC midnight (07:00 WIB), so
// comparing it against the browser's current instant with a plain
// `floor((due-now)/day) < 0` made a KPR due TODAY show "Terlambat" the
// moment the clock passed 07:00 WIB, even though the server's own rule
// (`dueInstallment`) says late only starts the day AFTER the due date
// (inside a 5-day grace window). `isLate` — the API's own
// `currentInstallmentLate`, already WIB-calendar-day aware — is
// authoritative whenever the row has a real `nextDueDate`; `null` falls
// back to the date-diff heuristic for a row with only the legacy manual
// `dueDate` (kartu_kredit never has a `nextDueDate`/schedule to derive
// `currentInstallmentLate` from).
function getDueDateStatus(
  dueDate: string | null,
  isLate: boolean | null,
  t: ReturnType<typeof useLocale>["t"],
  locale: Locale,
): {
  text: string;
  variant: "gray" | "danger" | "warning";
} {
  if (!dueDate) return { text: t.liabilitas.statusOngoing, variant: "gray" };
  const { state } = dueState(dueDate, { isLate });
  if (state === "overdue")
    return { text: t.liabilitas.statusOverdue, variant: "danger" };
  const text = `${t.liabilitas.statusDuePrefix}${formatLocaleDate(dueDate, locale)}`;
  // Amber only when the installment falls due within DUE_SOON_DAYS; a later
  // date is just information (neutral), never lime/green.
  return { text, variant: state === "soon" ? "warning" : "gray" };
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Bone({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-muted ${className ?? ""}`} />
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
  isPrivate?: boolean;
  interestMethod: InterestMethod;
  tenorMonths?: number;
  startDate?: string | null;
  installmentAmount?: string;
  kprScheme?: KprScheme;
  ratePeriods?: LiabilityRatePeriodDto[];
  fxInputs?: FxInput[];
}

function LiabilityModal({
  familyGroupId,
  editing,
  onClose,
}: LiabilityModalProps) {
  const { t, locale } = useLocale();
  const money = useMoney();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;

  const [name, setName] = useState(editing?.name ?? "");
  const [institution, setInstitution] = useState(editing?.institution ?? "");
  const [type, setType] = useState<LiabilityTypeValue>(
    editing?.type ?? "kartu_kredit",
  );
  const totalDebtField = useMoneyField({
    initialRaw: editing ? BigInt(editing.totalDebt).toString() : "",
    isEdit: !!editing,
  });
  const remainingField = useMoneyField({
    initialRaw: editing ? BigInt(editing.remainingBalance).toString() : "",
    isEdit: !!editing,
  });
  // Review round 2 (MEDIUM) — always prefill from the saved value, including
  // an explicit 0 (e.g. an interest-free family loan). The old `> 0` guard
  // blanked the field for a saved 0, making it indistinguishable from
  // "never set" and impossible to re-save as an explicit 0 below.
  const minPaymentField = useMoneyField({
    initialRaw: editing ? BigInt(editing.minimumPayment).toString() : "",
    isEdit: !!editing,
  });
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
  const [shared, setShared] = useState(!(editing?.isPrivate ?? false));
  const [interestMethod, setInterestMethod] = useState<InterestMethod>(
    editing?.interestMethod ?? DEFAULT_INTEREST_METHOD.kartu_kredit,
  );
  const [tenorMonths, setTenorMonths] = useState(
    editing?.tenorMonths ? String(editing.tenorMonths) : "",
  );
  const [startDate, setStartDate] = useState(
    editing?.startDate ? editing.startDate.slice(0, 10) : "",
  );
  // Empty = let the server compute it; a PATCH without it recomputes from the terms.
  const installmentField = useMoneyField({ initialRaw: "", isEdit: !!editing });
  const [kprPlan, setKprPlan] = useState<KprPlanDraft>(() =>
    editing ? draftFromLiability(editing) : draftFromPreset("manual"),
  );

  const methodOptions = INTEREST_METHOD_OPTIONS[type];
  const usesTenor = interestMethod !== "efektif";
  const usesRatePlan = type === "kpr" && interestMethod === "anuitas";
  const rateLabel =
    type === "kartu_kredit"
      ? t.liabilitas.fieldRateMonthlyLabel
      : type === "kpr"
        ? interestMethod === "flat"
          ? t.liabilitas.rateLabels.flat
          : t.liabilitas.fieldRateFixedLabel
        : t.liabilitas.rateLabels[interestMethod];

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
    onSuccess: (saved: LiabilityDto) => {
      invalidateLiabilityRelatedQueries(queryClient, familyGroupId);
      const base = editing
        ? t.liabilitas.toastUpdated
        : t.liabilitas.toastAdded;
      toast.success(
        saved.installmentAmount
          ? `${base} · ${t.liabilitas.toastInstallmentPrefix}${money.format(Number(saved.installmentAmount))}`
          : base,
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
    if (
      anyMoneyPending(
        totalDebtField,
        remainingField,
        minPaymentField,
        installmentField,
      )
    ) {
      toast.error(t.money.rateNotReady);
      return;
    }
    const totalDigits = moneyDigits(totalDebtField);
    const remainDigits = moneyDigits(remainingField);
    if (!name.trim() || !totalDigits || !remainDigits) return;
    const tenorDigits = toDigits(tenorMonths);
    // M5 — the form always sends ratePeriods when usesRatePlan, and the
    // server 400s any such PATCH (even a rename) without a tenor
    // (`validateRatePeriods`: "Isi tenor sebelum periode bunga"). Block the
    // save client-side instead of surfacing that as an opaque toast.
    if (usesRatePlan && !tenorDigits) {
      toast.error(t.liabilitas.kpr.tenorRequiredHint);
      return;
    }
    const ratePeriods = usesRatePlan
      ? toRatePeriodsBody(kprPlan.periods)
      : undefined;
    if (ratePeriods === null) {
      toast.error(t.liabilitas.kpr.planInvalid);
      return;
    }
    mutation.mutate(
      withFxInputs(
        {
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
          minimumPayment: usesTenor
            ? undefined
            : moneyDigits(minPaymentField) || "0",
          interestRate: usesRatePlan
            ? ratePeriods?.[0]?.ratePercent
            : toDecimalString(interestRate),
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          autoAdvanceDueDate: dueDate ? autoAdvanceDueDate : undefined,
          notes: notes.trim() || undefined,
          isPrivate: !shared,
          interestMethod,
          tenorMonths:
            usesTenor && tenorDigits ? Number(tenorDigits) : undefined,
          startDate: !usesTenor
            ? undefined
            : startDate
              ? new Date(startDate).toISOString()
              : editing?.startDate
                ? null
                : undefined,
          installmentAmount: usesTenor
            ? moneyDigits(installmentField) || undefined
            : undefined,
          kprScheme: type === "kpr" ? (kprPlan.scheme ?? undefined) : undefined,
          ratePeriods,
        },
        [
          ["totalDebt", totalDebtField],
          ["remainingBalance", remainingField],
          ["minimumPayment", usesTenor ? null : minPaymentField],
          ["installmentAmount", usesTenor ? installmentField : null],
        ],
      ),
    );
  }

  return (
    // EPIC-026 Wave 8 — was a hand-rolled fixed overlay; now the real Base UI
    // Dialog so it inherits `.dialog` (focus trap, Escape, scroll lock, the
    // mobile bottom sheet) and can express the prototype's
    // `dialog__title`/`__desc`/`__body`/`__footer` structure
    // (docs/prototype/pages/liabilitas.html `dlg-lia-edit`).
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <PanelContent variant="side" className="wm-form-panel">
        <header className="wm-panel-head">
          <div className="min-w-0">
            <DialogTitle className="wm-panel-title">
              {editing ? t.liabilitas.modalEditTitle : t.liabilitas.modalTitle}
            </DialogTitle>
          </div>
          <DialogClose className="wm-panel-x" aria-label={t.common.close}>
            <XIcon aria-hidden="true" />
          </DialogClose>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="wm-panel-body wm-form">
            <fieldset className="space-y-3 rounded-lg border p-3">
              <legend className="px-1 text-[13px] font-semibold">
                {t.liabilitas.fieldGroups.identity}
              </legend>
              {/* Prototype pairs Nama + Institusi 2-up (liabilitas.html:432). */}
              <div className="wm-form__grid wm-form__grid--two">
                <div className="field mt-0">
                  <label className="label" htmlFor="liability-name">
                    {t.liabilitas.fieldNameLabel}
                  </label>
                  <input
                    id="liability-name"
                    className="input"
                    placeholder={t.liabilitas.fieldNamePlaceholder}
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="field mt-0">
                  <label className="label" htmlFor="liability-institution">
                    {t.liabilitas.fieldInstitutionLabel}
                  </label>
                  <input
                    id="liability-institution"
                    className="input"
                    placeholder={t.liabilitas.fieldInstitutionPlaceholder}
                    maxLength={100}
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <label className="label" htmlFor="liability-type">
                  {t.liabilitas.fieldTypeLabel}
                </label>
                <select
                  id="liability-type"
                  className="select"
                  value={type}
                  onChange={(e) => {
                    const next = e.target.value as LiabilityTypeValue;
                    setType(next);
                    setInterestMethod(DEFAULT_INTEREST_METHOD[next]);
                  }}
                >
                  {LIABILITY_TYPES.map((liabilityType) => (
                    <option key={liabilityType} value={liabilityType}>
                      {t.liabilitas.typeLabels[liabilityType]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="label" htmlFor="liability-notes">
                  {t.liabilitas.fieldNotesLabel}
                </label>
                <input
                  id="liability-notes"
                  className="input"
                  placeholder={t.liabilitas.fieldNotesPlaceholder}
                  maxLength={500}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <SharedToggle checked={shared} onChange={setShared} />
            </fieldset>

            <fieldset className="mt-3 space-y-3 rounded-lg border p-3">
              <legend className="px-1 text-[13px] font-semibold">
                {t.liabilitas.fieldGroups.amount}
              </legend>
              <div className="wm-form__grid wm-form__grid--two">
                <div className="field mt-0">
                  <label className="label" htmlFor="liability-total-debt">
                    {t.liabilitas.fieldTotalDebtLabel}
                  </label>
                  <MoneyInput
                    field={totalDebtField}
                    id="liability-total-debt"
                    placeholder={t.liabilitas.fieldTotalDebtPlaceholder}
                  />
                </div>
                <div className="field mt-0">
                  <label className="label" htmlFor="liability-remaining">
                    {t.liabilitas.fieldRemainingLabel}
                  </label>
                  <MoneyInput
                    field={remainingField}
                    id="liability-remaining"
                    placeholder={t.liabilitas.fieldRemainingPlaceholder}
                  />
                </div>
              </div>

              {!usesTenor && (
                <div className="field">
                  <label className="label" htmlFor="liability-min-payment">
                    {t.liabilitas.fieldMinPaymentLabel}
                  </label>
                  <MoneyInput
                    field={minPaymentField}
                    id="liability-min-payment"
                    placeholder={t.liabilitas.fieldMinPaymentPlaceholder}
                  />
                </div>
              )}
            </fieldset>

            <fieldset className="mt-3 space-y-3 rounded-lg border p-3">
              <legend className="px-1 text-[13px] font-semibold">
                {t.liabilitas.fieldGroups.interestTenor}
              </legend>

              {methodOptions && (
                <div className="field">
                  <label className="label" htmlFor="liability-interest-method">
                    {t.liabilitas.fieldInterestMethodLabel}
                  </label>
                  <select
                    id="liability-interest-method"
                    className="select"
                    value={interestMethod}
                    onChange={(e) =>
                      setInterestMethod(e.target.value as InterestMethod)
                    }
                  >
                    {methodOptions.map((method) => (
                      <option key={method} value={method}>
                        {t.liabilitas.interestMethodLabels[method]}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!usesRatePlan && (
                <div className="field mt-3">
                  <label className="label" htmlFor="liability-interest-rate">
                    {rateLabel}
                  </label>
                  <input
                    id="liability-interest-rate"
                    className="input mono"
                    placeholder={t.liabilitas.fieldInterestRatePlaceholder}
                    inputMode="decimal"
                    pattern={PERCENT_PATTERN}
                    title={t.common.percentRangeError}
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                  />
                  {type === "kpr" && interestMethod === "flat" && (
                    <div className="hint">{t.liabilitas.kpr.flatHint}</div>
                  )}
                </div>
              )}
              {usesTenor && (
                <div className="field mt-3">
                  <label className="label" htmlFor="liability-tenor">
                    {t.liabilitas.fieldTenorLabel}
                  </label>
                  <input
                    id="liability-tenor"
                    className="input mono"
                    inputMode="numeric"
                    placeholder="36"
                    value={tenorMonths}
                    onChange={(e) =>
                      setTenorMonths(e.target.value.replace(/\D/g, ""))
                    }
                  />
                  {usesRatePlan && (
                    <div className="hint">
                      {t.liabilitas.kpr.tenorRequiredHint}
                    </div>
                  )}
                </div>
              )}

              {usesTenor && (
                <div className="wm-form__grid wm-form__grid--two">
                  <div className="field mt-0">
                    <label className="label" htmlFor="liability-start-date">
                      {t.liabilitas.fieldStartDateLabel}
                    </label>
                    <DateField
                      id="liability-start-date"
                      value={startDate}
                      locale={locale}
                      label={t.liabilitas.fieldStartDateLabel}
                      onChange={setStartDate}
                    />
                  </div>
                  <div className="field mt-0">
                    <label className="label" htmlFor="liability-installment">
                      {t.liabilitas.fieldInstallmentLabel}
                    </label>
                    <MoneyInput
                      field={installmentField}
                      id="liability-installment"
                      placeholder={
                        editing?.installmentAmount
                          ? formatNum(editing.installmentAmount)
                          : ""
                      }
                    />
                    <div className="hint" id="liability-installment-hint">
                      {t.liabilitas.fieldInstallmentHint}
                    </div>
                  </div>
                </div>
              )}

              {usesRatePlan && (
                <KprRatePeriodsField
                  value={kprPlan}
                  onChange={(next) => {
                    setKprPlan(next);
                    // Presets: syariah_murabahah is a single fixed margin for
                    // the whole tenor — switch Metode Bunga to flat so the
                    // rate-plan/floating UI (which only makes sense for
                    // anuitas) hides itself; other presets stay anuitas.
                    if (next.scheme === "syariah_murabahah") {
                      setInterestMethod("flat");
                      setInterestRate(next.periods[0]?.ratePercent ?? "");
                    }
                  }}
                />
              )}

              <div className="field">
                <label className="label" htmlFor="liability-due-date">
                  {t.liabilitas.fieldDueDateLabel}
                </label>
                <DateField
                  id="liability-due-date"
                  value={dueDate}
                  locale={locale}
                  label={t.liabilitas.fieldDueDateLabel}
                  onChange={setDueDate}
                />
              </div>

              {/* Prototype's `.row` + `.switch` auto-advance toggle
                (liabilitas.html:479). Still gated on a due date being set —
                `autoAdvanceDueDate` is only sent when `dueDate` is, so
                showing the switch without one would be a control that does
                nothing (Honest UI). */}
              {dueDate && (
                <div className="row mt-3">
                  <Switch
                    checked={autoAdvanceDueDate}
                    onCheckedChange={setAutoAdvanceDueDate}
                    aria-labelledby="liability-auto-advance-label"
                  />
                  <span
                    className="text-[13px]"
                    id="liability-auto-advance-label"
                  >
                    {t.liabilitas.autoAdvanceLabel}
                  </span>
                </div>
              )}
            </fieldset>
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
              {mutation.isPending
                ? t.liabilitas.saving
                : t.liabilitas.saveButton}
            </PillButton>
          </div>
        </form>
      </PanelContent>
    </Dialog>
  );
}

// Prototype's bottom action bar (docs/prototype/pages/liabilitas.html) —
// labelled Detail/Edit/Hapus on the left, a primary Bayar on the right.
// Page-local (not the shared `CardSideActions` in components/crud, which
// /asuransi also uses and stays untouched) so only this page's layout
// changes from the icon-only vertical column to a labelled bottom row.
interface LiabilityTileProps {
  item: LiabilityDto;
  onDetail: () => void;
  onEdit: () => void;
  onPay: () => void;
  onDelete: () => void;
}

function LiabilityTile({
  item,
  onDetail,
  onEdit,
  onPay,
  onDelete,
}: LiabilityTileProps) {
  const { t, locale } = useLocale();
  const money = useMoney();
  const isCreditCard = item.type === "kartu_kredit";
  const nextDue = item.nextDueDate ?? item.dueDate;
  const status = getDueDateStatus(
    nextDue,
    item.nextDueDate ? item.currentInstallmentLate : null,
    t,
    locale,
  );
  const remaining = item.remainingBalance
    ? Number(BigInt(item.remainingBalance))
    : 0;
  const installment = installmentDue(item);
  const progress = isCreditCard ? 100 - item.paymentRatio : item.paymentRatio;
  // Repayment is progress, not alarm: loans always fill lime (red is reserved
  // for the overdue amount); a card's usage turns amber only near its limit.
  const fill = isCreditCard && progress >= 80 ? "orange" : "lime";
  const Icon = (LIABILITY_TYPE_ICON[item.type] ?? { icon: CreditCard }).icon;
  const typeLabel =
    t.liabilitas.typeLabels[item.type as LiabilityTypeValue] ?? item.type;
  const isOverdue = status.variant === "danger" && !item.paidThisPeriod;
  const progressLabel = isCreditCard
    ? t.liabilitas.progressUsageLabel
    : t.liabilitas.progressPayoffLabel;

  return (
    <div className="li-tilewrap">
      <div className="li-tile-tt">
        <span className="wm-ci">
          <Icon aria-hidden="true" />
        </span>
        <span className="li-tile-name">{item.name}</span>
        <StatusBadge
          variant={
            item.paidThisPeriod && status.variant !== "danger"
              ? "success"
              : status.variant
          }
        >
          {status.text}
        </StatusBadge>
      </div>
      <span className="wm-pv li-tile-amount">
        <span className="wm-money li-remaining">{money.format(remaining)}</span>
      </span>
      <Track value={progress} fill={fill} />
      <small className="li-tile-meta">
        {progressLabel} {progress}%
      </small>
      <small className="li-tile-meta">
        {installment > 0 ? (
          <MoneyCompact value={installment} suffix="/bln" />
        ) : (
          typeLabel
        )}
        {item.institution ? ` · ${item.institution}` : ""}
      </small>
      {isOverdue && (
        <small className="li-late">
          <TriangleAlert className="size-3" aria-hidden="true" />{" "}
          {t.liabilitas.overdueWarningPrefix}
          {nextDue ? formatLocaleDate(nextDue, locale) : ""}
          {t.liabilitas.overdueWarningSuffix}
        </small>
      )}
      <div className="li-foot">
        <button type="button" className="li-detail" onClick={onDetail}>
          <FileText className="size-3.5" aria-hidden="true" />{" "}
          {t.liabilitas.tileDetailButton}
        </button>
        {item.paidThisPeriod ? (
          <span className="wm-paid-note">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />{" "}
            {t.liabilitas.payAlreadyPaidTooltip}
          </span>
        ) : (
          <button type="button" className="wm-pill wm-pay-sm" onClick={onPay}>
            <Banknote className="size-3.5" aria-hidden="true" />{" "}
            {t.liabilitas.tilePayButton}
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t.liabilitas.tileMoreOptionsLabel}
            render={<button type="button" className="li-opts" />}
          >
            <EllipsisVertical className="size-3.5" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[140px]">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="size-3.5" aria-hidden="true" />{" "}
              {t.liabilitas.tileEditButton}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 className="size-3.5" aria-hidden="true" />{" "}
              {t.liabilitas.tileDeleteButton}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ── Detail Dialog ─────────────────────────────────────────────────────────
// EPIC-024 group G (G1) — read-only Detail dialog: full field info + a
// server-projected amortisation schedule (US-LIAB-6). Labeled as an estimate
// (`amortisationDisclaimer`): projected from current state, nothing persisted.

function LiabilityDetailDialog({
  item,
  familyGroupId,
  token,
  onClose,
  onPay,
}: {
  item: LiabilityDto | null;
  familyGroupId: string | undefined;
  token: string | undefined;
  onClose: () => void;
  /** Prototype `dlg-lia-detail` footer's "Bayar Cicilan" (liabilitas.html:412)
   *  — closes Detail and hands off to the existing real pay flow. */
  onPay: (item: LiabilityDto) => void;
}) {
  const { t, locale } = useLocale();
  const money = useMoney();
  const queryClient = useQueryClient();
  const typeLabel = item
    ? (t.liabilitas.typeLabels[item.type as LiabilityTypeValue] ?? item.type)
    : "";
  const totalDebt = item ? Number(BigInt(item.totalDebt)) : 0;
  const remaining = item ? Number(BigInt(item.remainingBalance)) : 0;
  const minimumPayment = item ? installmentDue(item) : 0;
  const interestRatePercent = item ? parseFloat(item.interestRate) || 0 : 0;
  const scheduleQuery = useQuery<LiabilityScheduleDto>({
    ...scheduleQueryOptions(familyGroupId ?? "", item?.id ?? "", token),
    enabled: Boolean(item && familyGroupId && token),
  });
  const scheduleRows = scheduleQuery.data?.rows ?? [];
  const rateBands = scheduleQuery.data?.rateBands ?? [];
  const hasFloatingPeriod = scheduleQuery.data?.hasFloatingPeriod ?? false;
  const firstRow = scheduleRows[0];
  const paysOff = scheduleRows[scheduleRows.length - 1]?.remaining === "0";
  // E2E round 1 bug 2 — `dueDate` (legacy manual field) never reflects the
  // real akad-anchored schedule; `nextDueDate` is the row-1 due date the
  // schedule below is actually built from.
  const nextDue = item?.nextDueDate ?? item?.dueDate;
  const anchor = nextDue ? new Date(nextDue) : new Date();
  // fix-round1 (Minor) — when the liability has a real Tanggal Akad, each
  // row's date is derived straight from it via `scheduleRowDueDate`
  // (matches the API's own `dueDateForPeriod`, including the month-end
  // clamp); `anchor + index months` is kept only as the kartu_kredit
  // fallback, which has no akad to anchor against at all.
  const startDate = item?.startDate ? new Date(item.startDate) : null;

  return (
    // EPIC-026 Wave 8 — prototype `dlg-lia-detail` (liabilitas.html:312) is a
    // read-only data sheet on `dialog--wide`: the liability's name as the
    // title, `institusi · jenis` as the description, then stat grids, the
    // amortisation table and a `.notice` for the note.
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="dialog--wide">
        {item && (
          <>
            <DialogTitle>{item.name}</DialogTitle>
            <DialogDescription>
              {[item.institution, typeLabel].filter(Boolean).join(" · ")}
            </DialogDescription>

            <DialogBody className="space-y-3.5 text-[13px]">
              {/* Prototype's `grid grid--4` headline figures. */}
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted p-3.5 md:grid-cols-4">
                <div>
                  <div className="t-xs t-muted">
                    {t.liabilitas.loanRemainingPrincipalLabel}
                  </div>
                  <div
                    className="mono text-[14px] font-bold"
                    style={{ color: "var(--destructive)" }}
                  >
                    {money.format(remaining)}
                  </div>
                </div>
                <div>
                  <div className="t-xs t-muted">
                    {t.liabilitas.loanTotalLabel}
                  </div>
                  <div className="mono text-[14px] font-bold">
                    {money.format(totalDebt)}
                  </div>
                </div>
                <div>
                  <div className="t-xs t-muted">
                    {t.liabilitas.loanInstallmentLabel}
                  </div>
                  <div className="mono text-[14px] font-bold">
                    {minimumPayment > 0 ? money.format(minimumPayment) : "—"}
                  </div>
                </div>
                <div>
                  <div className="t-xs t-muted">
                    {t.liabilitas.loanInterestYearlyLabel}
                  </div>
                  <div className="mono text-[14px] font-bold">
                    {interestRatePercent > 0 ? `${item.interestRate}%` : "—"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div>
                  <div className="t-xs t-muted mb-[3px]">
                    {t.liabilitas.detailNextDueLabel}
                  </div>
                  <div className="text-[13px] font-semibold">
                    {nextDue ? formatLocaleDate(nextDue, locale) : "—"}
                  </div>
                </div>
                <div>
                  <div className="t-xs t-muted mb-[3px]">
                    {t.liabilitas.detailStatusLabel}
                  </div>
                  <StatusBadge
                    variant={item.paidThisPeriod ? "success" : "gray"}
                  >
                    {item.paidThisPeriod
                      ? t.liabilitas.detailPaidThisPeriodLabel
                      : t.liabilitas.detailNotPaidThisPeriodLabel}
                  </StatusBadge>
                </div>
                <div>
                  <div className="t-xs t-muted mb-[3px]">
                    {t.liabilitas.fieldInterestMethodLabel}
                  </div>
                  <div className="text-[13px] font-semibold">
                    {t.liabilitas.interestMethodLabels[item.interestMethod]}
                  </div>
                </div>
                <div>
                  <div className="t-xs t-muted mb-[3px]">
                    {t.liabilitas.detailTenorLabel}
                  </div>
                  <div className="text-[13px] font-semibold">
                    {item.tenorMonths
                      ? `${item.tenorMonths}${t.liabilitas.tenorMonthsSuffix}`
                      : "—"}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-3.5">
                <div className="mb-2 text-[12.5px] font-bold">
                  {t.liabilitas.amortisationTitle}
                </div>
                {scheduleQuery.isError ? (
                  <div className="text-[12px] text-destructive">
                    {t.liabilitas.amortisationScheduleError}
                  </div>
                ) : scheduleQuery.isLoading ? (
                  <div className="text-[12px] text-muted-foreground">
                    {t.liabilitas.amortisationScheduleLoading}
                  </div>
                ) : firstRow ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="t-xs t-muted">
                          {t.liabilitas.amortisationMonthlyPrincipalLabel}
                        </div>
                        <div className="mono text-[13.5px] font-bold">
                          {money.format(Number(firstRow.principal))}
                        </div>
                      </div>
                      <div>
                        <div className="t-xs t-muted">
                          {t.liabilitas.amortisationMonthlyInterestLabel}
                        </div>
                        <div
                          className="mono text-[13.5px] font-bold"
                          style={{ color: "var(--destructive)" }}
                        >
                          {money.format(Number(firstRow.interest))}
                        </div>
                      </div>
                    </div>
                    {paysOff ? (
                      <div className="mt-2.5 text-[12.5px] font-semibold text-success">
                        {t.liabilitas.amortisationEstimatedPayoffPrefix}
                        {scheduleRows.length}
                        {t.liabilitas.amortisationEstimatedPayoffSuffix}
                      </div>
                    ) : (
                      <div className="mt-2.5 text-[12px] text-destructive">
                        {t.liabilitas.amortisationNoPayoffNote}
                      </div>
                    )}
                    <div className="mt-3">
                      <div className="section-title mb-2 flex items-baseline justify-between gap-2 text-[13px]">
                        <span>
                          {t.liabilitas.amortisationScheduleTitle} (
                          {scheduleRows.length}
                          {t.liabilitas.amortisationScheduleCountSuffix})
                        </span>
                        <span className="t-xs t-muted font-normal whitespace-nowrap">
                          {t.liabilitas.amortisationScheduleScrollHint}
                        </span>
                      </div>
                      <div className="table-wrap max-h-80 overflow-y-auto overflow-x-auto">
                        <table className="table table--num">
                          <thead>
                            <tr>
                              <th>
                                {t.liabilitas.amortisationScheduleHeaderIndex}
                              </th>
                              <th>
                                {t.liabilitas.amortisationScheduleHeaderDate}
                              </th>
                              <th>{t.liabilitas.kpr.scheduleRateHeader}</th>
                              <th className="text-right">
                                {
                                  t.liabilitas
                                    .amortisationScheduleHeaderInstallment
                                }
                              </th>
                              <th className="text-right">
                                {
                                  t.liabilitas
                                    .amortisationScheduleHeaderPrincipal
                                }
                              </th>
                              <th className="text-right">
                                {
                                  t.liabilitas
                                    .amortisationScheduleHeaderInterest
                                }
                              </th>
                              <th>
                                {t.liabilitas.loanRemainingPrincipalLabel}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {scheduleRows.map((row, index) => (
                              <tr key={row.period}>
                                <td className="mono">{row.period}</td>
                                <td className="whitespace-nowrap">
                                  {formatScheduleDate(
                                    startDate
                                      ? scheduleRowDueDate(
                                          startDate,
                                          row.period,
                                        )
                                      : new Date(
                                          anchor.getFullYear(),
                                          anchor.getMonth() + index,
                                          anchor.getDate(),
                                        ),
                                    locale,
                                  )}
                                </td>
                                <td className="mono whitespace-nowrap">
                                  <ScheduleRateCell
                                    bands={rateBands}
                                    period={row.period}
                                    estimateLabel={
                                      t.liabilitas.kpr.floatingEstimateBadge
                                    }
                                  />
                                </td>
                                <td className="mono text-right whitespace-nowrap">
                                  {money.format(Number(row.installment))}
                                </td>
                                <td className="mono text-right whitespace-nowrap">
                                  {money.format(Number(row.principal))}
                                </td>
                                <td className="mono text-right whitespace-nowrap">
                                  {money.format(Number(row.interest))}
                                </td>
                                <td className="mono whitespace-nowrap">
                                  {money.format(Number(row.remaining))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="hint">
                      {t.liabilitas.amortisationDisclaimer}
                    </div>
                    {hasFloatingPeriod && (
                      <div className="notice notice--warning mt-2">
                        {t.liabilitas.kpr.floatingEstimateNote}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-[12px] text-muted-foreground">
                    {t.liabilitas.amortisationUnavailableNote}
                  </div>
                )}
              </div>

              {item.type === "kpr" &&
                (item.interestMethod === "anuitas" ||
                  item.interestMethod === "flat") &&
                familyGroupId && (
                  <>
                    {hasFloatingPeriod && item.interestMethod === "anuitas" && (
                      <KprFloatingRatesPanel
                        familyGroupId={familyGroupId}
                        liabilityId={item.id}
                        token={token}
                        onChanged={() =>
                          invalidateLiabilityRelatedQueries(
                            queryClient,
                            familyGroupId,
                          )
                        }
                      />
                    )}
                    <KprPrepaymentSimulator
                      familyGroupId={familyGroupId}
                      liabilityId={item.id}
                      token={token}
                      onRecorded={() =>
                        invalidateLiabilityRelatedQueries(
                          queryClient,
                          familyGroupId,
                        )
                      }
                    />
                  </>
                )}

              {/* Prototype's `.notice` note row (liabilitas.html:405). */}
              {item.notes && (
                <div className="notice">
                  <StickyNote className="size-4 shrink-0" aria-hidden="true" />
                  <span>
                    {t.liabilitas.fieldNotesLabel}: {item.notes}
                  </span>
                </div>
              )}
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t.liabilitas.detailCloseButton}
              </Button>
              <Button
                type="button"
                disabled={item.paidThisPeriod}
                title={
                  item.paidThisPeriod
                    ? t.liabilitas.payAlreadyPaidTooltip
                    : undefined
                }
                onClick={() => onPay(item)}
              >
                {t.liabilitas.detailPayButton}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Pay Dialog ─────────────────────────────────────────────────────────────
// EPIC-024 group G (G1) — records a REAL payment via
// `POST .../liabilities/:id/pay`: debits the chosen source account, and the
// server splits principal/interest (`splitPayment`). The preview below comes
// from `GET .../:id/payment-preview`, the same split `pay()` books; the web
// does no interest math of its own.

function PayLiabilityDialog({
  item,
  familyGroupId,
  token,
  accounts,
  payField,
  sourceAccountId,
  onSourceAccountChange,
  isPending,
  onClose,
  onConfirm,
}: {
  item: LiabilityDto | null;
  familyGroupId: string | undefined;
  token: string | undefined;
  accounts: AccountDto[];
  payField: MoneyField;
  sourceAccountId: string;
  onSourceAccountChange: (id: string) => void;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t, locale } = useLocale();
  const money = useMoney();
  const parsedAmount = Number(moneyDigits(payField) || "0");
  const remainingBalance = item ? Number(BigInt(item.remainingBalance)) : 0;
  const minimumPayment = item ? installmentDue(item) : 0;
  const previewAmount = useDebouncedValue(parsedAmount, PREVIEW_DEBOUNCE_MS);
  const previewQuery = useQuery<LiabilityPaymentPreviewDto>({
    queryKey: [
      "liabilities",
      familyGroupId ?? "",
      "payment-preview",
      item?.id ?? "",
      previewAmount,
    ],
    enabled: Boolean(
      item &&
      familyGroupId &&
      token &&
      previewAmount > 0 &&
      !payField.resolved.isPending,
    ),
    retry: false,
    queryFn: ({ signal }) => {
      if (!item || !familyGroupId) throw new Error("liability not selected");
      return apiFetch<LiabilityPaymentPreviewDto>(
        `/family-groups/${familyGroupId}/liabilities/${item.id}/payment-preview?amount=${previewAmount}`,
        { token, signal },
      );
    },
  });
  const preview =
    previewAmount === parsedAmount && !previewQuery.isFetching
      ? previewQuery.data
      : undefined;

  // Prototype's `.segmented` amount presets (liabilitas.html:524). The
  // prototype offers "Cicilan penuh / Minimum / Pelunasan sebagian"; the API
  // stores ONE `minimumPayment`, so only the two presets backed by real
  // fields are offered — a third would be an invented number (Honest UI).
  // These only prefill the amount input; the amount posted is always whatever
  // the input holds, and the authoritative principal/interest split is
  // computed server-side by `pay()`.
  const presets = [
    ...(minimumPayment > 0
      ? [
          {
            key: "installment",
            label: t.liabilitas.payPresetInstallment,
            value: minimumPayment,
          },
        ]
      : []),
    {
      key: "payoff",
      label: t.liabilitas.payPresetPayoff,
      value: remainingBalance,
    },
  ];

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>{t.liabilitas.payDialogTitle}</DialogTitle>
        {item && (
          <>
            {/* Prototype `.dialog__desc`: name · institution · due date
                (liabilitas.html:521). */}
            <DialogDescription>
              {[
                item.name,
                item.institution,
                (item.nextDueDate ?? item.dueDate)
                  ? `${t.liabilitas.statusDuePrefix}${formatLocaleDate(item.nextDueDate ?? item.dueDate!, locale)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </DialogDescription>

            <DialogBody>
              {item.currentInstallmentLate && (
                <div className="notice notice--warning" role="status">
                  <span className="badge badge--danger">
                    {t.liabilitas.payLateBadge}
                  </span>{" "}
                  {t.liabilitas.payLateNote}
                </div>
              )}
              <div className="field">
                <span className="label" id="pay-liability-preset-label">
                  {t.liabilitas.payPresetLabel}
                </span>
                <div
                  className="segmented flex w-full"
                  role="tablist"
                  aria-labelledby="pay-liability-preset-label"
                >
                  {presets.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      role="tab"
                      aria-selected={parsedAmount === preset.value}
                      onClick={() => payField.reset(String(preset.value))}
                      className="segmented__item flex-1"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label className="label" htmlFor="pay-liability-amount">
                  {t.liabilitas.payAmountLabel}
                </label>
                <MoneyInput
                  field={payField}
                  id="pay-liability-amount"
                  placeholder="0"
                />
              </div>

              <div className="field">
                <label className="label" htmlFor="pay-liability-source-account">
                  {t.liabilitas.paySourceAccountLabel}
                </label>
                <select
                  id="pay-liability-source-account"
                  aria-describedby="pay-liability-source-account-hint"
                  value={sourceAccountId}
                  onChange={(e) => onSourceAccountChange(e.target.value)}
                  className="select"
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
                <span className="hint" id="pay-liability-source-account-hint">
                  {t.liabilitas.paySourceAccountHint}
                </span>
              </div>

              {/* The prototype also has a "Tanggal Bayar" date input. OMITTED:
                  `POST .../liabilities/:id/pay` accepts only
                  `{ sourceAccountId, amount }` and always books the payment
                  as of now, so a date picker here would silently drop the
                  user's choice (Honest UI). */}

              {/* Prototype's `notice notice--info` split preview
                  (liabilitas.html:566), computed server-side by the same
                  split `pay()` books. */}
              {parsedAmount > 0 &&
                (previewQuery.isError && previewAmount === parsedAmount ? (
                  <div className="notice notice--danger mt-3.5" role="alert">
                    <TriangleAlert
                      className="size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      {extractPreviewErrorMessage(
                        previewQuery.error,
                        t.liabilitas.payPreviewError,
                      )}
                    </span>
                  </div>
                ) : preview ? (
                  <div className="notice notice--info mt-3.5">
                    <Split className="size-4 shrink-0" aria-hidden="true" />
                    <span>
                      <strong>
                        {t.liabilitas.payPrincipalPreviewLabel}{" "}
                        <span className="mono">
                          {money.format(Number(preview.principal))}
                        </span>
                      </strong>{" "}
                      ·{" "}
                      <strong>
                        {t.liabilitas.payInterestPreviewLabel}{" "}
                        <span className="mono">
                          {money.format(Number(preview.interest))}
                        </span>
                      </strong>
                      <br />
                      <span className="t-xs">
                        {t.liabilitas.payRemainingAfterLabel}:{" "}
                        <span className="mono">
                          {money.format(Number(preview.remainingAfter))}
                        </span>
                      </span>
                    </span>
                  </div>
                ) : (
                  <div
                    className="notice notice--info mt-3.5"
                    role="status"
                    aria-live="polite"
                  >
                    <Split className="size-4 shrink-0" aria-hidden="true" />
                    <span className="flex-1">
                      <span className="sr-only">
                        {t.liabilitas.payPreviewLoading}
                      </span>
                      <Bone className="h-3.5 w-3/4" />
                      <Bone className="mt-2 h-3 w-1/2" />
                    </span>
                  </div>
                ))}
            </DialogBody>
          </>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            type="button"
            disabled={
              isPending ||
              !sourceAccountId ||
              parsedAmount <= 0 ||
              payField.resolved.isPending
            }
            onClick={onConfirm}
          >
            {isPending
              ? t.liabilitas.payProcessing
              : t.liabilitas.payConfirmButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

/** 0–100 with up to two decimals ("7,5", "11.25", "100"). */
const PERCENT_PATTERN = "^(100([.,]0{1,2})?|\\d{1,2}([.,]\\d{1,2})?)$";

export default function LiabilitasPage() {
  const { t, locale } = useLocale();
  const money = useMoney();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<LiabilityDto | null>(null);
  const [detailItem, setDetailItem] = useState<LiabilityDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LiabilityDto | null>(null);
  const [payTarget, setPayTarget] = useState<LiabilityDto | null>(null);
  const [paySourceAccountId, setPaySourceAccountId] = useState("");
  const payField = useMoneyField();
  // EPIC-025 N3-F4 — type filter tabs, matching the /aset and /investasi
  // filter-tab pattern (role="group"+aria-pressed, never a fake tablist).
  const [activeTypeFilter, setActiveTypeFilter] = useState<
    LiabilityTypeValue | "semua"
  >("semua");

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
          body: JSON.stringify(
            withFxInputs(
              {
                sourceAccountId: params.sourceAccountId,
                amount: params.amount,
              },
              [["amount", payField]],
            ),
          ),
        },
      ),
    onSuccess: () => {
      // Mirrors /asuransi's own pay-mutation invalidation set — paying
      // moves money and touches budgets/accounts/reports/net worth exactly
      // like a normal transaction does.
      invalidateLiabilityRelatedQueries(queryClient, familyGroupId ?? "");
      setPayTarget(null);
      setPaySourceAccountId("");
      payField.reset();
      toast.success(t.liabilitas.toastPaid);
    },
    // silent-failure-hunter routing — `pay()` can 400 (amount exceeds max
    // payable) or 409 (already paid this period); the real message must
    // reach the user, not a generic fallback.
    onError: (err: unknown) => {
      toast.error(extractApiErrorMessage(err, t.liabilitas.toastPayFailed));
    },
  });

  // "Rasio Utang terhadap Aset" needs TOTAL assets. `NetWorthDto.assetsTotal`
  // is only the physical/Asset-table slice (rumah, kendaraan, …) — cash and
  // investments are separate fields — so using it alone inflated the ratio by
  // whatever share of the family's wealth sits in accounts and portfolio
  // (37.6% instead of 17.7% on the demo data). Same three-part sum /aset and
  // the balance sheet report as "Total Aset".
  const assetsTotal = netWorthData
    ? Number(netWorthData.accountsTotal) +
      Number(netWorthData.investmentsTotal) +
      Number(netWorthData.assetsTotal)
    : 0;
  const liabilitiesTotal = netWorthData
    ? Number(netWorthData.liabilitiesTotal)
    : 0;
  const dtaRatio =
    assetsTotal > 0 ? (liabilitiesTotal / assetsTotal) * 100 : null;
  const dtaDisplay = dtaRatio !== null ? formatPercent(dtaRatio) : "—";
  const dtaRisk =
    dtaRatio !== null
      ? getDtaRiskLabel(dtaRatio, t)
      : { label: "—", color: "var(--muted-foreground)" };

  useEffect(() => {
    if (isError) {
      toast.error(t.liabilitas.errorLoad);
    }
  }, [isError, t]);

  // Shared by the card's "Bayar" action and the Detail dialog's prototype
  // "Bayar Cicilan" footer button — same real pay flow, amount prefilled from
  // the liability's own minimum payment.
  function openPayDialog(liability: LiabilityDto) {
    setPayTarget(liability);
    const due = installmentDue(liability);
    payField.reset(due > 0 ? String(due) : undefined);
  }

  const totalRemaining = (liabilities ?? []).reduce(
    (sum, l) =>
      sum + (l.remainingBalance ? BigInt(l.remainingBalance) : BigInt(0)),
    BigInt(0),
  );

  // EPIC-025 N3-F4 — "Cicilan Bulan Ini" 3rd stat + type filter tabs, both
  // derived from the same already-fetched `liabilities` list.
  const totalMinimumPayment = (liabilities ?? []).reduce(
    (sum, l) => sum + BigInt(installmentDue(l)),
    BigInt(0),
  );
  // E2E round 1 bug 2 — prefer the real `nextDueDate` over the legacy
  // manual `dueDate` field, same as everywhere else on this page.

  const filteredLiabilities = (liabilities ?? []).filter(
    (l) => activeTypeFilter === "semua" || l.type === activeTypeFilter,
  );

  // Payoff projection read off each scheduled liability's server schedule
  // (same query the Detail dialog uses, so the cache is shared).
  const scheduledLiabilities = (liabilities ?? []).filter(
    (l) => installmentDue(l) > 0,
  );
  const projectionSchedules = useQueries({
    queries: scheduledLiabilities.map((l) => ({
      ...scheduleQueryOptions(familyGroupId ?? "", l.id, token),
      enabled: Boolean(familyGroupId && token),
    })),
    combine: (results) => ({
      isPending: results.some((r) => r.isPending),
      isError: results.some((r) => r.isError),
      byId: new Map(
        results.flatMap((r) => (r.data ? [[r.data.liabilityId, r.data]] : [])),
      ) as ReadonlyMap<string, LiabilityScheduleDto>,
    }),
  });
  const payoffProjectionMonths = nextSixMonthLabels(locale);
  const payoffProjectionSeries = projectRemainingBalance(
    liabilities ?? [],
    projectionSchedules.byId,
  );

  const loanRemaining = (liabilities ?? []).reduce(
    (sum, l) =>
      l.type === "kartu_kredit"
        ? sum
        : sum + (l.remainingBalance ? BigInt(l.remainingBalance) : BigInt(0)),
    BigInt(0),
  );
  const cardRemaining = totalRemaining - loanRemaining;
  const typeGroups = LIABILITY_TYPES.map((type) => {
    const items = (liabilities ?? []).filter((l) => l.type === type);
    const total = items.reduce(
      (sum, l) => sum + (l.totalDebt ? Number(BigInt(l.totalDebt)) : 0),
      0,
    );
    const left = items.reduce(
      (sum, l) =>
        sum + (l.remainingBalance ? Number(BigInt(l.remainingBalance)) : 0),
      0,
    );
    return {
      label: t.liabilitas.typeLabels[type],
      total,
      paid: Math.max(0, total - left),
    };
  }).filter((g) => g.total > 0);

  const worstDue = (liabilities ?? [])
    .map((l) => ({
      item: l,
      due: l.nextDueDate ?? l.dueDate,
      status: getDueDateStatus(
        l.nextDueDate ?? l.dueDate,
        l.nextDueDate ? l.currentInstallmentLate : null,
        t,
        locale,
      ),
    }))
    .filter((x) => x.status.variant !== "gray")
    .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"))[0];
  const tipTitle = worstDue
    ? `${worstDue.item.name}${worstDue.status.variant === "danger" ? t.liabilitas.v2.tipOverdueSuffix : t.liabilitas.v2.tipSoonSuffix}`
    : (liabilities ?? []).length > 0
      ? t.liabilitas.v2.tipOkTitle
      : t.liabilitas.v2.tipEmptyTitle;
  const tipBody = worstDue
    ? `${t.liabilitas.v2.tipInstallment} ${money.format(installmentDue(worstDue.item))} · ${worstDue.status.text}.`
    : (liabilities ?? []).length > 0
      ? t.liabilitas.v2.tipOkBody.replace("{days}", String(DUE_SOON_DAYS))
      : t.liabilitas.v2.tipEmptyBody;
  const dtaFilled = Math.round((Math.min(100, dtaRatio ?? 0) / 100) * 18);
  const tipsMosaic = Array.from({ length: 18 }, (_, i) =>
    i < dtaFilled
      ? (dtaRatio ?? 0) >= 70
        ? "o"
        : i > dtaFilled - 4
          ? "c"
          : "a"
      : i % 5 === 0
        ? "b"
        : "",
  ) as ("a" | "b" | "c" | "o" | "")[];

  return (
    <div data-page="liabilitas" className="li-page">
      <BentoGrid className="li-grid">
        <BentoHero
          className="li-hero"
          currency={null}
          value={
            isLoading ? (
              "…"
            ) : (
              <span className="wm-money">
                {money.format(Number(totalRemaining))}
              </span>
            )
          }
          caption={t.liabilitas.v2.heroCaption}
          controls={
            <div className="li-hero-ctrl">
              <div className="li-hero-ctrl-row">
                <GhostButton
                  lit
                  onClick={() => setShowAddModal(true)}
                  disabled={!familyGroupId || !token}
                >
                  <Plus className="size-4" aria-hidden="true" />{" "}
                  {t.liabilitas.addButton}
                </GhostButton>
              </div>
              <span className="li-legend" aria-hidden="true">
                <span>
                  <i className="li-dot-paid" />
                  {t.liabilitas.v2.legendPaid}
                </span>
                <span>
                  <i className="li-dot-total" />
                  {t.liabilitas.v2.legendTotal}
                </span>
              </span>
            </div>
          }
          chart={
            <div className="li-plot">
              {isLoading ? null : typeGroups.length === 0 ? (
                <p className="li-empty">{t.liabilitas.v2.chartEmpty}</p>
              ) : (
                <HatchedBarChart
                  labels={typeGroups.map((g) => g.label)}
                  series={[
                    {
                      name: t.liabilitas.v2.legendTotal,
                      data: typeGroups.map((g) => g.total),
                      color: "var(--wm-ghost)",
                    },
                    {
                      name: t.liabilitas.v2.legendPaid,
                      data: typeGroups.map((g) => g.paid),
                      color: "var(--wm-lime)",
                    },
                  ]}
                  format={money.formatCompact}
                  axis={money.formatAxis}
                  formatFull={money.format}
                  wide
                  ariaLabel={t.liabilitas.v2.chartAria}
                />
              )}
            </div>
          }
          kpis={
            <>
              <HeroKpi
                label={t.liabilitas.v2.kpiLoan}
                value={
                  <span className="wm-money">
                    {money.format(Number(loanRemaining))}
                  </span>
                }
              />
              <HeroKpi
                label={t.liabilitas.v2.kpiCard}
                value={
                  <span className="wm-money">
                    {money.format(Number(cardRemaining))}
                  </span>
                }
              />
              <HeroKpi
                label={t.liabilitas.v2.kpiMonthly}
                value={
                  <span className="wm-money">
                    {money.format(Number(totalMinimumPayment))}
                  </span>
                }
              />
            </>
          }
        />

        <BentoCard
          className="li-risk"
          title={
            <span className="inline-flex items-center gap-1">
              {t.liabilitas.v2.riskTitle}
              <Tooltip>
                <TooltipTrigger
                  aria-label={t.liabilitas.v2.riskTooltip}
                  className="inline-flex"
                >
                  <Info className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>{t.liabilitas.v2.riskTooltip}</TooltipContent>
              </Tooltip>
            </span>
          }
          caption={t.liabilitas.v2.riskCaption}
        >
          <p className="li-dta" style={{ color: dtaRisk.color }}>
            {isNetWorthLoading ? "…" : dtaDisplay}
            <span>{dtaRisk.label}</span>
          </p>
          <Track
            value={Math.min(100, dtaRatio ?? 0)}
            fill={
              (dtaRatio ?? 0) >= 70
                ? "bad"
                : (dtaRatio ?? 0) >= 50
                  ? "orange"
                  : "lime"
            }
            className="li-riskbar"
          />
          <p className="li-risknote">
            {dtaRatio === null
              ? ""
              : dtaRatio < 50
                ? t.liabilitas.v2.riskHealthy
                : t.liabilitas.v2.riskWarn}
          </p>
        </BentoCard>

        <BentoCard
          className="li-list"
          title={t.liabilitas.v2.gridTitle}
          caption={`${filteredLiabilities.length} ${t.liabilitas.v2.gridCount}`}
          action={
            <Segmented
              label={t.liabilitas.fieldTypeLabel}
              value={activeTypeFilter}
              onChange={setActiveTypeFilter}
              options={[
                { value: "semua", label: t.liabilitas.filterAllLabel },
                ...LIABILITY_TYPES.map((type) => ({
                  value: type,
                  label: t.liabilitas.typeLabels[type],
                })),
              ]}
            />
          }
        >
          {isError && (
            <p role="alert" className="li-error">
              {t.liabilitas.errorLoad}
            </p>
          )}
          {isLoading ? (
            <BentoTiles>
              <Bone className="h-[150px] w-full" />
              <Bone className="h-[150px] w-full" />
            </BentoTiles>
          ) : filteredLiabilities.length === 0 ? (
            <p className="li-empty">{t.liabilitas.emptyState}</p>
          ) : (
            <BentoTiles>
              {filteredLiabilities.map((item) => (
                <LiabilityTile
                  key={item.id}
                  item={item}
                  onDetail={() => setDetailItem(item)}
                  onEdit={() => setEditingItem(item)}
                  onPay={() => openPayDialog(item)}
                  onDelete={() => setDeleteTarget(item)}
                />
              ))}
            </BentoTiles>
          )}
        </BentoCard>

        <TipsCard className="li-tips" title={tipTitle} mosaic={tipsMosaic}>
          {tipBody}
        </TipsCard>

        {!isLoading && scheduledLiabilities.length > 0 && (
          <BentoCard
            className="li-proj"
            title={t.liabilitas.payoffProjectionTitle}
          >
            {projectionSchedules.isError ? (
              <p className="notice notice--danger" role="alert">
                <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
                <span>{t.liabilitas.payoffProjectionError}</span>
              </p>
            ) : projectionSchedules.isPending ? (
              <div role="status" aria-live="polite">
                <span className="sr-only">
                  {t.liabilitas.amortisationScheduleLoading}
                </span>
                <Bone className="h-[220px] w-full" />
              </div>
            ) : (
              <TrendChart
                categories={payoffProjectionMonths}
                series={[
                  {
                    name: t.liabilitas.payoffProjectionSeriesLabel,
                    data: payoffProjectionSeries,
                  },
                ]}
                ariaLabel={`${t.liabilitas.payoffProjectionTitle}: ${money.format(Number(totalRemaining))} → ${money.format(payoffProjectionSeries[payoffProjectionSeries.length - 1] ?? 0)}`}
                money={money}
              />
            )}
            <p className="li-disclaimer">
              {t.liabilitas.amortisationDisclaimer}
            </p>
          </BentoCard>
        )}
      </BentoGrid>

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
        familyGroupId={familyGroupId ?? undefined}
        token={token}
        onClose={() => setDetailItem(null)}
        onPay={(liability) => {
          setDetailItem(null);
          openPayDialog(liability);
        }}
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
        familyGroupId={familyGroupId ?? undefined}
        token={token}
        accounts={accounts}
        payField={payField}
        sourceAccountId={paySourceAccountId}
        onSourceAccountChange={setPaySourceAccountId}
        isPending={payMutation.isPending}
        onClose={() => {
          setPayTarget(null);
          setPaySourceAccountId("");
          payField.reset();
        }}
        onConfirm={() => {
          if (anyMoneyPending(payField)) {
            toast.error(t.money.rateNotReady);
            return;
          }
          const amountDigits = moneyDigits(payField);
          if (
            !payTarget ||
            !paySourceAccountId ||
            Number(amountDigits || "0") <= 0
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
