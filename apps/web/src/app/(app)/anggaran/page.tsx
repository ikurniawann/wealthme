"use client";

import { useState } from "react";
import { Plus, Save } from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  SectionCard,
  CountUpRupiah,
  AnimatedProgress,
  Rise,
  StatusBadge,
} from "@/components/wm";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/hooks/use-locale";
import { formatAmountInput, formatRupiah, parseRupiah } from "@/lib/format";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type {
  BudgetDto,
  BudgetPeriod,
  BudgetType,
  CreateBudgetDto,
} from "@wealthme/contracts";

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
          data-tour="add-anggaran"
        >
          <Plus className="size-4" /> {t.anggaran.addCategoryButton}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <Rise index={0}>
          <div className="rounded-[14px] border border-[#86EFAC] bg-[#DCFCE7] p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
            <div className="mb-1 text-[11px] text-[#15803D]">
              {t.anggaran.remainingBudgetLabel}
            </div>
            <div className="mono text-[22px] font-black text-[#15803D]">
              <CountUpRupiah value={totalRemaining} />
            </div>
            <div className="text-[11px] text-[#15803D]">
              {totalLimit > 0
                ? `${100 - usagePct}${t.anggaran.pctOfBudgetSuffix}`
                : t.anggaran.noBudgetYet}
            </div>
          </div>
        </Rise>
        <Rise index={1}>
          <div className="rounded-[14px] border bg-card p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
            <div className="mb-1 text-[11px] text-muted-foreground">
              {t.anggaran.totalSpentLabel}
            </div>
            <div className="mono text-[22px] font-black text-destructive">
              <CountUpRupiah value={totalSpent} />
            </div>
            <div className="text-[11px] text-muted-foreground">
              {usagePct}
              {t.anggaran.pctOfBudgetSuffix}
            </div>
          </div>
        </Rise>
        <Rise index={2}>
          <div className="rounded-[14px] border bg-card p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
            <div className="mb-1 text-[11px] text-muted-foreground">
              {t.anggaran.daysLeftLabel}
            </div>
            <div className="text-[22px] font-black text-primary">
              {daysLeft}
              {t.anggaran.daysSuffix}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {t.anggaran.daysOfPrefix}
              {daysInMonth}
              {t.anggaran.daysOfSuffix}
            </div>
          </div>
        </Rise>
      </div>

      <SectionCard
        title={t.anggaran.categoryBreakdownTitle}
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
          <div className="space-y-3">
            {budgets.map((b, i) => (
              <BudgetItem key={b.id} dto={b} index={i} />
            ))}
          </div>
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
                <AnimatedProgress value={Math.min(pct, 100)} color={color} />
              </div>
            );
          })}
        </SectionCard>
      )}

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
