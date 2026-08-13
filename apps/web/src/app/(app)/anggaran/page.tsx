"use client";

import { useState } from "react";
import { Plus, Save, TrendingDown, Calendar } from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  SectionCard,
  CardLink,
  HeroCard,
  AnimatedProgress,
  Rise,
  StatusBadge,
} from "@/components/wm";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/hooks/use-locale";
// EPIC-025 N3-E1 — J3 FOLD: "Terpakai per Kategori" budget-vs-actual bars,
// derived from the already-fetched budgets list — no new backend endpoint.
import { HBarChart } from "@/components/charts/apex-presets";
import { formatAmountInput, formatRupiah, parseRupiah } from "@/lib/format";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type {
  BudgetDto,
  BudgetPeriod,
  BudgetType,
  CreateBudgetDto,
  LiabilityDto,
  LiabilityType,
  InsuranceDto,
  InsuranceType,
} from "@wealthme/contracts";
import type { Locale } from "@/i18n";

type TypeBreakdownRow = {
  key: BudgetType | "OTHER";
  limit: number;
  spent: number;
  count: number;
};

/** Budget-vs-actual grouped by COA budgetType (EPIC-017 Task D). */
function buildTypeBreakdown(budgets: BudgetDto[]): TypeBreakdownRow[] {
  const order: (BudgetType | "OTHER")[] = [
    "FIXED",
    "VARIABLE",
    "REIMBURSEMENT",
    "OTHER",
  ];
  const map = new Map<
    string,
    { limit: number; spent: number; count: number }
  >();
  for (const b of budgets) {
    const key = b.budgetType ?? "OTHER";
    const e = map.get(key) ?? { limit: 0, spent: 0, count: 0 };
    map.set(key, {
      limit: e.limit + b.limitAmount,
      spent: e.spent + b.spentAmount,
      count: e.count + 1,
    });
  }
  const rows: TypeBreakdownRow[] = [];
  for (const k of order) {
    const agg = map.get(k);
    if (agg) rows.push({ key: k, ...agg });
  }
  return rows;
}

function budgetBarColor(dto: BudgetDto): string {
  if (dto.isOverBudget) return "var(--destructive)";
  if (dto.isNearLimit) return "var(--warning)";
  return "var(--success)";
}

function budgetPctLabel(dto: BudgetDto): string {
  const label = `${dto.usagePercent}%`;
  if (dto.isOverBudget) return `${label} ⚠️`;
  return label;
}

function budgetAmountsLabel(
  dto: BudgetDto,
  t: ReturnType<typeof useLocale>["t"],
): string {
  return `${formatRupiah(dto.spentAmount)}${t.anggaran.amountsMidDari}${formatRupiah(dto.limitAmount)}`;
}

const ICON_OPTIONS = ["🎓", "🎨", "🎁", "🐶", "👶", "📚", "💪", "🙏"];

const FIELD_CLASS =
  "w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card";

function BudgetItem({ dto, index }: { dto: BudgetDto; index: number }) {
  const { t } = useLocale();
  const color = budgetBarColor(dto);
  const icon = dto.categoryIcon ?? "📦";
  return (
    <Rise index={index}>
      <div className="rounded-[12px] border bg-card p-3.5 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
        <div className="mb-2 flex items-center gap-2.5">
          <div className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-accent text-[14px]">
            {icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5 text-[13.5px] font-semibold">
              <span>{dto.categoryName}</span>
              {dto.budgetType && (
                <StatusBadge variant="gray">
                  {t.anggaran.budgetTypeLabels[dto.budgetType]}
                </StatusBadge>
              )}
            </div>
            <div className="text-[11.5px] text-muted-foreground">
              {budgetAmountsLabel(dto, t)}
            </div>
          </div>
          <div className="text-[13px] font-bold" style={{ color }}>
            {budgetPctLabel(dto)}
          </div>
        </div>
        <AnimatedProgress
          value={Math.min(dto.usagePercent, 100)}
          color={color}
        />
        {/* EPIC-025 N3 rework — prototype's per-card footer line: "Sisa
            Rp N" for a healthy category, a red "Lewat anggaran Rp N" once
            spend has exceeded the limit. Both derived from `dto`, no new
            data. */}
        <div
          className={
            "mt-1.5 text-[11px] " +
            (dto.isOverBudget ? "text-destructive" : "text-muted-foreground")
          }
        >
          {dto.isOverBudget
            ? `${t.anggaran.categoryFooterOverBudgetPrefix}${formatRupiah(dto.spentAmount - dto.limitAmount)}`
            : `${t.anggaran.categoryFooterRemainingPrefix}${formatRupiah(dto.remainingAmount)}`}
        </div>
      </div>
    </Rise>
  );
}

function BudgetSkeleton() {
  return (
    <div className="space-y-3 py-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse space-y-2 rounded-[12px] border bg-card p-3.5"
        >
          <div className="flex items-center gap-2.5">
            <div className="size-[34px] rounded-[9px] bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-32 rounded bg-muted" />
              <div className="h-2.5 w-48 rounded bg-muted" />
            </div>
            <div className="h-3 w-8 rounded bg-muted" />
          </div>
          <div className="h-2 w-full rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );
}

// EPIC-023 E2 — mirrors transaction-dialog.tsx's local `AccountDto` shape.
type AccountDto = { id: string; name: string; institution: string | null };

type Obligation = {
  kind: "liability" | "insurance";
  id: string;
  name: string;
  amountDue: number;
  paidThisPeriod: boolean;
  // EPIC-025 N3 rework — prototype's row icon + due-date text
  // (`docs/prototype/pages/anggaran.html`'s "Kewajiban Bulan Ini"). Both
  // derived from real fields already on the DTO (`type` → icon,
  // `dueDate`/`renewalDate` → due date) — no fabricated data.
  dueDate: string | null;
  icon: string;
};

// EPIC-025 N3 rework — one emoji per liability/insurance `type`, matching
// the prototype's per-row icon. Falls back to a generic document icon for
// any type not explicitly mapped.
const LIABILITY_ICONS: Record<LiabilityType, string> = {
  kpr: "🏠",
  kartu_kredit: "💳",
  pinjaman_pribadi: "🏦",
  kendaraan: "🚗",
  lainnya: "📄",
};
const INSURANCE_ICONS: Record<InsuranceType, string> = {
  jiwa: "🛡️",
  kesehatan: "🏥",
  kendaraan: "🚗",
  properti: "🏠",
  pendidikan: "🎓",
  lainnya: "📄",
};

/**
 * EPIC-023 E2 (D11, US-LIAB-3) — "this period's obligations" is built by
 * listing active liabilities/insurances directly (NOT derived from the
 * `Budget` rows themselves): every liability in a family shares ONE FIXED
 * budget line per category (`LiabilitiesService.create()`'s doc comment),
 * so a single Budget row cannot unambiguously identify "which liability" for
 * a per-item Pay action. The underlying obligation lists (already tenant-
 * scoped, already carrying `paidThisPeriod` from EPIC-023 E2's backend
 * change) give an unambiguous 1:1 Pay target per row instead.
 */
function toObligations(
  liabilities: LiabilityDto[],
  insurances: InsuranceDto[],
): Obligation[] {
  const fromLiabilities: Obligation[] = liabilities
    .filter(
      (l) => Number(l.minimumPayment) > 0 && Number(l.remainingBalance) > 0,
    )
    .map((l) => ({
      kind: "liability",
      id: l.id,
      name: l.name,
      // EPIC-023 Task E retry (MEDIUM 7) — truncate once, here, so the
      // amount the row DISPLAYS (`formatRupiah(obligation.amountDue)`) is
      // byte-identical to the amount the pay mutation POSTS
      // (`String(Math.trunc(obligation.amountDue))`) instead of the two
      // computing the truncation independently and drifting apart.
      amountDue: Math.trunc(Number(l.minimumPayment)),
      paidThisPeriod: l.paidThisPeriod,
      dueDate: l.dueDate,
      icon: LIABILITY_ICONS[l.type] ?? "📄",
    }));
  const fromInsurances: Obligation[] = insurances
    .filter((i) => i.status === "aktif" && Number(i.premiumAmount) > 0)
    .map((i) => ({
      kind: "insurance",
      id: i.id,
      name: i.name,
      amountDue: Number(i.premiumAmount),
      paidThisPeriod: i.paidThisPeriod,
      dueDate: i.renewalDate,
      icon: INSURANCE_ICONS[i.type] ?? "📄",
    }));
  return [...fromLiabilities, ...fromInsurances];
}

function formatLocaleDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function PayObligationDialog({
  obligation,
  accounts,
  sourceAccountId,
  onSourceAccountChange,
  isPending,
  onClose,
  onConfirm,
}: {
  obligation: Obligation | null;
  accounts: AccountDto[];
  sourceAccountId: string;
  onSourceAccountChange: (id: string) => void;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useLocale();
  return (
    <Dialog
      open={obligation !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="sm:max-w-[380px]">
        <DialogTitle className="text-[17px] font-extrabold">
          {t.anggaran.obligationsPayDialogTitle}
        </DialogTitle>
        {obligation && (
          <div className="space-y-3 text-[13px]">
            <div className="rounded-lg bg-muted p-3.5">
              <div className="text-[11px] text-muted-foreground">
                {obligation.name}
              </div>
              <div className="text-[18px] font-black">
                {formatRupiah(obligation.amountDue)}
              </div>
            </div>
            <div>
              <label
                htmlFor="obligation-source-account"
                className="mb-1.5 block text-[12.5px] font-semibold"
              >
                {t.anggaran.obligationsSourceAccountLabel}
              </label>
              <select
                id="obligation-source-account"
                value={sourceAccountId}
                onChange={(e) => onSourceAccountChange(e.target.value)}
                className={FIELD_CLASS}
              >
                <option value="">
                  {t.anggaran.obligationsSourceAccountPlaceholder}
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
            disabled={isPending || !sourceAccountId}
            onClick={onConfirm}
          >
            {isPending
              ? t.anggaran.obligationsPayProcessing
              : t.anggaran.obligationsPayConfirmButton}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ObligationRow({
  obligation,
  index,
  onPay,
}: {
  obligation: Obligation;
  index: number;
  onPay: () => void;
}) {
  const { t, locale } = useLocale();
  const dueDateLabel = obligation.dueDate
    ? formatLocaleDate(obligation.dueDate, locale)
    : null;
  return (
    <Rise index={index}>
      <div className="flex items-center gap-2.5 rounded-[12px] border bg-card p-3.5">
        <div className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-accent text-[14px]">
          {obligation.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1.5 text-[13.5px] font-semibold">
            <span>{obligation.name}</span>
            <StatusBadge
              variant={obligation.paidThisPeriod ? "success" : "gray"}
            >
              {obligation.paidThisPeriod
                ? t.anggaran.obligationsPaidBadge
                : t.anggaran.obligationsDueBadge}
            </StatusBadge>
          </div>
          <div className="text-[11.5px] text-muted-foreground">
            {formatRupiah(obligation.amountDue)}
          </div>
          {dueDateLabel && (
            <div className="text-[11px] text-muted-foreground">
              {t.anggaran.obligationsDueDatePrefix}
              {dueDateLabel}
            </div>
          )}
        </div>
        {/* EPIC-023 Task E retry (CRITICAL 1) — an already-paid obligation
            must not accept a second Pay click: the label previously stayed
            "Bayar" and onClick was fully live regardless of
            `paidThisPeriod`, so clicking it opened the same confirm dialog
            and debited the source account a second time for the same
            period, silently. Honest UI: disable the control and say why
            instead of letting the copy imply an action it must not take. */}
        <Button
          size="sm"
          variant={obligation.paidThisPeriod ? "outline" : "default"}
          disabled={obligation.paidThisPeriod}
          onClick={onPay}
        >
          {obligation.paidThisPeriod
            ? t.anggaran.obligationsAlreadyPaidButton
            : t.anggaran.obligationsPayButton}
        </Button>
      </div>
    </Rise>
  );
}

/**
 * EPIC-023 E2 (D11, US-LIAB-3) — "this period's obligations" list with a
 * Pay action + source-account picker, calling the REAL liability/insurance
 * pay endpoints. Section is hidden entirely when there are no obligations
 * (Honest UI — no empty promise of a feature with nothing to show).
 */
export function ObligationsSection({
  familyGroupId,
  token,
}: {
  familyGroupId: string;
  token: string | undefined;
}) {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<Obligation | null>(null);
  const [sourceAccountId, setSourceAccountId] = useState("");

  const { data: liabilities = [] } = useQuery<LiabilityDto[]>({
    queryKey: queryKeys.liabilities.all(familyGroupId),
    queryFn: () =>
      apiFetch<LiabilityDto[]>(`/family-groups/${familyGroupId}/liabilities`, {
        token,
      }),
    enabled: !!token && !!familyGroupId,
  });

  const { data: insurances = [] } = useQuery<InsuranceDto[]>({
    queryKey: queryKeys.insurances.all(familyGroupId),
    queryFn: () =>
      apiFetch<InsuranceDto[]>(`/family-groups/${familyGroupId}/insurances`, {
        token,
      }),
    enabled: !!token && !!familyGroupId,
  });

  const { data: accounts = [] } = useQuery<AccountDto[]>({
    queryKey: queryKeys.accounts.all(familyGroupId),
    queryFn: () =>
      apiFetch<AccountDto[]>(`/family-groups/${familyGroupId}/accounts`, {
        token,
      }),
    enabled: !!token && !!familyGroupId,
  });

  const payMutation = useMutation({
    mutationFn: (params: {
      obligation: Obligation;
      sourceAccountId: string;
    }) => {
      const path =
        params.obligation.kind === "liability"
          ? `/family-groups/${familyGroupId}/liabilities/${params.obligation.id}/pay`
          : `/family-groups/${familyGroupId}/insurances/${params.obligation.id}/pay`;
      const body: { sourceAccountId: string; amount?: string } = {
        sourceAccountId: params.sourceAccountId,
      };
      // Liability pay() requires an explicit amount (variable balance); the
      // insurance side defaults to premiumAmount when omitted. `amountDue`
      // is already truncated in `toObligations` (MEDIUM 7) — posting it
      // as-is here keeps this value byte-identical to what the row and the
      // dialog displayed, instead of truncating a second time and risking
      // the two drifting apart.
      if (params.obligation.kind === "liability") {
        body.amount = String(params.obligation.amountDue);
      }
      return apiFetch(path, {
        token,
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      // Paying moves money — invalidate every view it can change, mirroring
      // transaction-dialog.tsx's invalidation set.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.budgets.all(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.accounts.all(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.liabilities.all(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.liabilities.summary(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.insurances.all(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.insurances.summary(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.transactions.all(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.summary(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.netWorth.summary(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: ["reports", familyGroupId],
      });
      setTarget(null);
      setSourceAccountId("");
      toast.success(t.anggaran.obligationsToastPaySuccess);
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? t.anggaran.obligationsToastPayFailed);
    },
  });

  const obligations = toObligations(liabilities, insurances);
  if (obligations.length === 0) return null;

  // EPIC-025 N3 rework — prototype's right-aligned section summary
  // ("3 dari 5 belum dibayar · Rp 5.945.000"), derived from the same
  // obligations list already rendered below — no new data.
  const unpaid = obligations.filter((o) => !o.paidThisPeriod);
  const unpaidTotal = unpaid.reduce((sum, o) => sum + o.amountDue, 0);

  return (
    <SectionCard
      title={t.anggaran.obligationsSectionTitle}
      action={
        // EPIC-025 N3 rework — kept as ONE text node (no nested `mono` span
        // around the amount): a per-row amount can equal this total exactly
        // when only one obligation is unpaid, and an isolated element with
        // the same exact text would make `getByText` in
        // obligations-section.test.tsx ambiguous between the two.
        <span className="text-xs text-muted-foreground">
          {unpaid.length}
          {t.anggaran.obligationsSummaryMidPrefix}
          {obligations.length}
          {t.anggaran.obligationsSummaryMidSuffix}
          {formatRupiah(unpaidTotal)}
        </span>
      }
      bodyClassName="-mt-1 space-y-3"
    >
      {obligations.map((o, i) => (
        <ObligationRow
          key={`${o.kind}-${o.id}`}
          obligation={o}
          index={i}
          onPay={() => setTarget(o)}
        />
      ))}
      <PayObligationDialog
        obligation={target}
        accounts={accounts}
        sourceAccountId={sourceAccountId}
        onSourceAccountChange={setSourceAccountId}
        isPending={payMutation.isPending}
        onClose={() => {
          setTarget(null);
          setSourceAccountId("");
        }}
        onConfirm={() => {
          if (target && sourceAccountId) {
            payMutation.mutate({ obligation: target, sourceAccountId });
          }
        }}
      />
    </SectionCard>
  );
}

export default function AnggaranPage() {
  const { t, locale } = useLocale();
  const { data: session } = useSession();
  const token = session?.accessToken;
  const familyGroupId = session?.familyGroupId;
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(ICON_OPTIONS[0] ?? "🎓");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<BudgetPeriod>("monthly");

  const {
    data: budgets,
    isLoading,
    isError,
  } = useQuery<BudgetDto[]>({
    queryKey: queryKeys.budgets.all(familyGroupId ?? ""),
    queryFn: ({ signal }) => {
      if (!familyGroupId) throw new Error("familyGroupId not available");
      return apiFetch<BudgetDto[]>(`/family-groups/${familyGroupId}/budgets`, {
        token,
        signal,
      });
    },
    enabled: !!token && !!familyGroupId,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      icon: string;
      limitAmount: number;
      period: BudgetPeriod;
    }) => {
      if (!familyGroupId) throw new Error("familyGroupId missing");

      let categoryId: string;
      try {
        const cat = await apiFetch<{ id: string }>(
          `/family-groups/${familyGroupId}/categories`,
          {
            method: "POST",
            token,
            body: JSON.stringify({
              name: payload.name,
              kind: "expense",
              icon: payload.icon,
            }),
          },
        );
        categoryId = cat.id;
      } catch (err) {
        const apiErr = err as { status?: number; message?: string };
        if (apiErr.status === 409) {
          const cats = await apiFetch<Array<{ id: string; name: string }>>(
            `/family-groups/${familyGroupId}/categories?kind=expense`,
            { token },
          );
          const match = cats.find(
            (c) => c.name.toLowerCase() === payload.name.toLowerCase(),
          );
          if (!match)
            throw new Error(t.anggaran.errorCategoryNotFoundAfterConflict);
          categoryId = match.id;
        } else {
          throw err;
        }
      }

      const dto: CreateBudgetDto = {
        categoryId,
        period: payload.period,
        limitAmount: payload.limitAmount,
      };
      return apiFetch<BudgetDto>(`/family-groups/${familyGroupId}/budgets`, {
        method: "POST",
        token,
        body: JSON.stringify(dto),
      });
    },
    onSuccess: (budget) => {
      if (familyGroupId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.budgets.all(familyGroupId),
        });
      }
      setOpen(false);
      resetForm();
      toast.success(
        `${t.anggaran.toastCategoryAddedPrefix}${budget.categoryName}${t.anggaran.toastCategoryAddedSuffix}`,
      );
    },
    onError: (err: unknown) => {
      const apiErr = err as { message?: string };
      toast.error(apiErr.message ?? t.anggaran.toastSaveFailedDefault);
    },
  });

  function resetForm() {
    setName("");
    setIcon(ICON_OPTIONS[0] ?? "🎓");
    setAmount("");
    setPeriod("monthly");
  }

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.warning(t.anggaran.toastNameRequired);
      return;
    }
    const limitAmount = parseRupiah(amount);
    if (limitAmount <= 0) {
      toast.warning(t.anggaran.toastAmountInvalid);
      return;
    }
    if (!familyGroupId) {
      toast.error(t.anggaran.toastNoFamilyGroup);
      return;
    }
    createMutation.mutate({ name: trimmed, icon, limitAmount, period });
  }

  const totalLimit = budgets?.reduce((s, b) => s + b.limitAmount, 0) ?? 0;
  const totalSpent = budgets?.reduce((s, b) => s + b.spentAmount, 0) ?? 0;
  const typeBreakdown = budgets ? buildTypeBreakdown(budgets) : [];
  // EPIC-025 N3-E1 — J3 FOLD: "Terpakai per Kategori" bars, sorted by
  // spentAmount desc like the prototype's `hbar()` mount, over the same
  // already-fetched budgets list.
  const categoryBarBudgets = (budgets ?? [])
    .slice()
    .sort((a, b) => b.spentAmount - a.spentAmount);
  const categoryBarCategories = categoryBarBudgets.map((b) => b.categoryName);
  const categoryBarData = categoryBarBudgets.map((b) => b.spentAmount);
  const totalRemaining = Math.max(0, totalLimit - totalSpent);
  const overBudgetItems = budgets?.filter((b) => b.isOverBudget) ?? [];
  const nearLimitItems = budgets?.filter((b) => b.isNearLimit) ?? [];

  const now = new Date();
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  ).getDate();
  const daysLeft = daysInMonth - now.getDate();
  const usagePct =
    totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <div className="text-[15px] font-bold">
            {t.anggaran.pageTitlePrefix}
            {now.toLocaleString(locale === "en" ? "en-US" : "id-ID", {
              month: "long",
              year: "numeric",
            })}
          </div>
          <div className="text-xs text-muted-foreground">
            {t.anggaran.totalBudgetPrefix}
            {formatRupiah(totalLimit)}
          </div>
        </div>
        <Button
          onClick={() => setOpen(true)}
          disabled={!familyGroupId}
          className="h-auto px-[18px] py-2.5"
        >
          <Plus className="size-4" /> {t.anggaran.addCategoryButton}
        </Button>
      </div>

      {/* EPIC-025 N3 rework — prototype's `budget-summary-grid`: a gradient
          hero (remaining budget, usage badge, days-left, spent/planned
          progress bar) plus 2 stacked mini-stats, replacing the previous
          flat 3-stat-card row. All values are the same already-computed
          `totalRemaining`/`totalSpent`/`daysLeft` this page already fetched
          — no new data. */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        <Rise index={0} className="lg:col-span-2">
          <HeroCard className="gradient-emerald h-full">
            <div className="mb-1 text-xs opacity-80">
              {t.anggaran.remainingBudgetLabel}
            </div>
            <div className="mono text-[26px] font-black">
              {formatRupiah(totalRemaining)}
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold">
                {totalLimit > 0
                  ? `${100 - usagePct}${t.anggaran.pctOfBudgetSuffix}`
                  : t.anggaran.noBudgetYet}
              </span>
              <span className="text-[11px] opacity-85">
                {daysLeft}
                {t.anggaran.heroDaysLeftMid}
                {daysInMonth}
                {t.anggaran.heroDaysLeftSuffix}
              </span>
            </div>
            <div className="mt-3.5 h-[7px] overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-white transition-[width] duration-700"
                style={{ width: `${Math.min(100, usagePct)}%` }}
              />
            </div>
            <div className="mono mt-1.5 flex items-center justify-between text-[11px] opacity-90">
              <span>
                {t.anggaran.heroTerpakaiPrefix}
                {formatRupiah(totalSpent)}
              </span>
              <span>
                {t.anggaran.heroRencanaPrefix}
                {formatRupiah(totalLimit)}
              </span>
            </div>
          </HeroCard>
        </Rise>
        <Rise index={1}>
          <div className="flex h-full flex-col justify-between gap-4 rounded-[14px] border bg-card p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-[34px] shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                <TrendingDown className="size-4" />
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">
                  {t.anggaran.totalSpentLabel}
                </div>
                <div className="mono text-[15px] font-extrabold text-destructive">
                  {formatRupiah(totalSpent)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {usagePct}
                  {t.anggaran.pctOfBudgetSuffix}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex size-[34px] shrink-0 items-center justify-center rounded-md bg-warning-soft text-warning">
                <Calendar className="size-4" />
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">
                  {t.anggaran.daysLeftLabel}
                </div>
                <div className="text-[15px] font-extrabold">
                  {daysLeft}
                  {t.anggaran.daysSuffix}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {t.anggaran.statAvgSafePrefix}
                  <span className="mono">
                    {formatRupiah(
                      daysLeft > 0
                        ? Math.round(totalRemaining / daysLeft)
                        : totalRemaining,
                    )}
                  </span>
                  {t.anggaran.statAvgSafeSuffix}
                </div>
              </div>
            </div>
          </div>
        </Rise>
      </div>

      {/* EPIC-025 N3 rework — prototype places the over-budget/near-limit
          alert directly under the hero, not at the bottom of the page
          (same computed `overBudgetItems`/`nearLimitItems`, only moved). */}
      {(overBudgetItems.length > 0 || nearLimitItems.length > 0) && (
        <div className="flex items-center gap-3 rounded-[14px] border border-primary/20 bg-accent p-4">
          <div className="text-[24px]">⚠️</div>
          <div className="flex-1">
            {overBudgetItems.length > 0 ? (
              <>
                <div className="text-[13px] font-bold text-primary-strong">
                  {overBudgetItems[0]!.categoryName}
                  {t.anggaran.overBudgetMidText}
                  {overBudgetItems[0]!.usagePercent - 100}
                  {t.anggaran.overBudgetSuffix}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {t.anggaran.overBudgetDesc}
                </div>
              </>
            ) : (
              <>
                <div className="text-[13px] font-bold text-primary-strong">
                  {nearLimitItems[0]!.categoryName}
                  {t.anggaran.nearLimitMidText}
                  {nearLimitItems[0]!.usagePercent}
                  {t.anggaran.nearLimitSuffix}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {t.anggaran.nearLimitDesc}
                </div>
              </>
            )}
          </div>
          <span
            aria-disabled="true"
            className="shrink-0 text-[12.5px] font-bold text-primary opacity-60"
          >
            {t.anggaran.tipsSavingLink}
          </span>
        </div>
      )}

      {familyGroupId && (
        <ObligationsSection familyGroupId={familyGroupId} token={token} />
      )}

      <SectionCard
        title={t.anggaran.categoryBreakdownTitle}
        action={
          <CardLink onClick={() => setOpen(true)}>
            {t.anggaran.categoryAddAction}
          </CardLink>
        }
        bodyClassName="-mt-1"
      >
        {isLoading && <BudgetSkeleton />}
        {isError && (
          <div className="py-4 text-center text-[13px] text-destructive">
            {t.anggaran.errorLoad}
          </div>
        )}
        {!isLoading && !isError && (!budgets || budgets.length === 0) && (
          <div className="py-6 text-center text-[13px] text-muted-foreground">
            {t.anggaran.emptyState}
          </div>
        )}
        {!isLoading && !isError && budgets && budgets.length > 0 && (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            {budgets.map((b, i) => (
              <BudgetItem key={b.id} dto={b} index={i} />
            ))}
          </div>
        )}
      </SectionCard>

      {(categoryBarBudgets.length > 0 || typeBreakdown.length > 0) && (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          {/* EPIC-025 N3-E1 — J3 FOLD: "Terpakai per Kategori" HBarChart,
              same data `BudgetItem` rows above already render, sliced
              differently (sorted by spentAmount desc, like the prototype). */}
          <SectionCard title={t.anggaran.categoryBarChartTitle}>
            {categoryBarBudgets.length === 0 ? (
              <div className="py-4 text-center text-[13px] text-muted-foreground">
                {t.anggaran.emptyCategoryBarChart}
              </div>
            ) : (
              <HBarChart
                categories={categoryBarCategories}
                data={categoryBarData}
                color="var(--primary)"
                ariaLabel={`${t.anggaran.categoryBarChartTitle}: ${categoryBarBudgets
                  .map(
                    (b) => `${b.categoryName} ${formatRupiah(b.spentAmount)}`,
                  )
                  .join(", ")}`}
              />
            )}
          </SectionCard>

          {typeBreakdown.length > 0 && (
            <SectionCard
              title={t.anggaran.typeBreakdownTitle}
              bodyClassName="-mt-1 space-y-3"
            >
              {typeBreakdown.map((row) => {
                const pct =
                  row.limit > 0 ? Math.round((row.spent / row.limit) * 100) : 0;
                const color =
                  row.spent > row.limit
                    ? "var(--destructive)"
                    : pct >= 80
                      ? "var(--warning)"
                      : "var(--success)";
                return (
                  <div key={row.key}>
                    <div className="mb-1.5 flex items-center gap-2 text-[13px]">
                      <StatusBadge variant="gray">
                        {t.anggaran.budgetTypeLabels[row.key]}
                      </StatusBadge>
                      <span className="text-[11.5px] text-muted-foreground">
                        {row.count}
                        {t.anggaran.categoriesSuffix}
                      </span>
                      <span className="ml-auto font-semibold" style={{ color }}>
                        {pct}%
                      </span>
                    </div>
                    <div className="mb-1 text-[11.5px] text-muted-foreground">
                      {formatRupiah(row.spent)}
                      {t.anggaran.amountsMidDari}
                      {formatRupiah(row.limit)}
                    </div>
                    <AnimatedProgress
                      value={Math.min(pct, 100)}
                      color={color}
                    />
                  </div>
                );
              })}
            </SectionCard>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[480px] p-6 sm:max-w-[480px]">
          <DialogTitle className="mb-4 text-[17px] font-extrabold">
            {t.anggaran.modalAddTitle}
          </DialogTitle>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="budget-name"
                className="mb-1.5 block text-[12.5px] font-semibold"
              >
                {t.anggaran.fieldCategoryNameLabel}
              </label>
              <input
                id="budget-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.anggaran.fieldCategoryNamePlaceholder}
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <div
                role="group"
                aria-label={t.anggaran.iconGroupAriaLabel}
                className="mb-1.5 text-[12.5px] font-semibold"
              >
                {t.anggaran.iconLabel}
              </div>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    aria-label={`${t.anggaran.iconAriaLabelPrefix}${opt}`}
                    aria-pressed={icon === opt}
                    onClick={() => setIcon(opt)}
                    className={
                      "flex size-[42px] items-center justify-center rounded-[10px] border text-[18px] transition-colors " +
                      (icon === opt
                        ? "border-primary bg-accent"
                        : "border-border bg-background hover:bg-accent/50")
                    }
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label
                htmlFor="budget-amount"
                className="mb-1.5 block text-[12.5px] font-semibold"
              >
                {t.anggaran.fieldAmountLabel}
              </label>
              <div className="flex items-center gap-2 rounded-md border bg-background px-3.5 py-2.5 transition-colors focus-within:border-primary focus-within:bg-card">
                <span className="text-[13.5px] text-muted-foreground">Rp</span>
                <input
                  id="budget-amount"
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(formatAmountInput(e.target.value))}
                  placeholder="0"
                  className="w-full bg-transparent text-[13.5px] outline-none"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="budget-period"
                className="mb-1.5 block text-[12.5px] font-semibold"
              >
                {t.anggaran.fieldPeriodLabel}
              </label>
              <select
                id="budget-period"
                value={period}
                onChange={(e) => setPeriod(e.target.value as BudgetPeriod)}
                className={FIELD_CLASS}
              >
                <option value="monthly">
                  {t.anggaran.periodLabels.monthly}
                </option>
                <option value="weekly">{t.anggaran.periodLabels.weekly}</option>
                <option value="yearly">{t.anggaran.periodLabels.yearly}</option>
              </select>
            </div>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending}
              className="w-full"
            >
              <Save className="size-4" />
              {createMutation.isPending
                ? t.anggaran.savingLabel
                : t.anggaran.saveCategoryButton}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
