"use client";

import { useState } from "react";
import {
  Plus,
  Save,
  TrendingDown,
  Calendar,
  TriangleAlert,
  Pencil,
  Trash2,
} from "lucide-react";
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
import { IconPickerField } from "@/components/crud/icon-picker-field";
import { AdvancedDisclosure } from "@/components/crud/advanced-disclosure";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/crud/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useLocale } from "@/hooks/use-locale";
import { useCanManage } from "@/hooks/use-role-permissions";
import { formatRupiah, parseRupiah } from "@/lib/format";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  MoneyInput,
  useMoneyField,
  moneyIdr,
  withFxInputs,
} from "@/components/money";

import type {
  BudgetDto,
  BudgetPeriod,
  BudgetType,
  CreateBudgetDto,
  UpdateBudgetDto,
  LiabilityDto,
  LiabilityType,
  InsuranceDto,
  InsuranceType,
  FxInput,
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

function BudgetUsageList({ budgets }: { budgets: BudgetDto[] }) {
  const maxSpent = Math.max(...budgets.map((budget) => budget.spentAmount), 1);

  return (
    <div className="space-y-3">
      {budgets.map((budget) => {
        const usagePct = budget.usagePercent ?? 0;
        const barWidth =
          budget.spentAmount > 0
            ? Math.max(4, Math.round((budget.spentAmount / maxSpent) * 100))
            : 0;
        const color = budgetBarColor(budget);

        return (
          <div
            key={budget.id}
            className="rounded-[11px] border bg-secondary/25 px-3 py-2.5"
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[12.5px] font-semibold">
                  {budget.categoryName}
                </div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                  {usagePct}% dari {formatRupiah(budget.limitAmount)}
                </div>
              </div>
              <div className="mono shrink-0 text-right text-[12.5px] font-semibold text-foreground">
                {formatRupiah(budget.spentAmount)}
              </div>
            </div>
            <div className="mt-2 h-[7px] overflow-hidden rounded-full bg-secondary">
              {barWidth > 0 && (
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{
                    width: `${Math.min(100, barWidth)}%`,
                    background: color,
                  }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BudgetTypeSummary({
  rows,
  totalSpent,
  totalLimit,
  totalRemaining,
  overBudgetCount,
  nearLimitCount,
  t,
}: {
  rows: TypeBreakdownRow[];
  totalSpent: number;
  totalLimit: number;
  totalRemaining: number;
  overBudgetCount: number;
  nearLimitCount: number;
  t: ReturnType<typeof useLocale>["t"];
}) {
  const totalPct =
    totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;
  const totalColor =
    totalSpent > totalLimit
      ? "var(--destructive)"
      : totalPct >= 80
        ? "var(--warning)"
        : "var(--success)";

  return (
    <div className="space-y-4">
      <div className="rounded-[12px] border bg-secondary/25 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11.5px] text-muted-foreground">
              Total tipe aktif
            </div>
            <div className="text-[14px] font-semibold">{rows.length} tipe</div>
          </div>
          <div className="text-right">
            <div className="text-[11.5px] text-muted-foreground">Terpakai</div>
            <div
              className="mono text-[14px] font-semibold"
              style={{ color: totalColor }}
            >
              {totalPct}%
            </div>
          </div>
        </div>
        <AnimatedProgress value={Math.min(totalPct, 100)} color={totalColor} />
        <div className="mt-2 flex items-center justify-between gap-3 text-[11.5px] text-muted-foreground">
          <span>{formatRupiah(totalSpent)} dipakai</span>
          <span>{formatRupiah(totalLimit)} rencana</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[10px] border bg-card p-2.5">
          <div className="text-[11px] text-muted-foreground">Sisa budget</div>
          <div className="mono mt-1 text-[13px] font-semibold">
            {formatRupiah(totalRemaining)}
          </div>
        </div>
        <div className="rounded-[10px] border bg-card p-2.5">
          <div className="text-[11px] text-muted-foreground">
            Perlu perhatian
          </div>
          <div className="mt-1 text-[13px] font-semibold">
            {overBudgetCount + nearLimitCount} kategori
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        {rows.map((row) => {
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
              <div className="mb-1.5 flex items-center gap-2 text-[12.5px]">
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
              <AnimatedProgress value={Math.min(pct, 100)} color={color} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BudgetItem({
  dto,
  index,
  canManage,
  onEdit,
  onDelete,
}: {
  dto: BudgetDto;
  index: number;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useLocale();
  const color = budgetBarColor(dto);
  const icon = dto.categoryIcon ?? "📦";
  return (
    <Rise index={index}>
      {/* EPIC-026 Wave 4 — prototype tints an over-budget card's border
          destructive (anggaran.html:168). */}
      <div
        className={
          "rounded-[12px] border bg-card p-3.5 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)] " +
          (dto.isOverBudget ? "border-destructive/40" : "")
        }
      >
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
          {/* EPIC-022 C2 — the API already had PATCH/DELETE for a budget;
              this was the only surface with no way to reach either. */}
          {canManage && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={onEdit}
                aria-label={`${t.anggaran.editAriaLabelPrefix}${dto.categoryName}`}
                className="flex size-[26px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                aria-label={`${t.anggaran.deleteAriaLabelPrefix}${dto.categoryName}`}
                className="flex size-[26px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          )}
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
      amountDue: Math.trunc(
        Number(l.currentInstallmentAmount ?? l.minimumPayment),
      ),
      paidThisPeriod: l.paidThisPeriod,
      // fix-round1 (Minor) — `dueDate` is the legacy manual field the KPR
      // form never sets; `nextDueDate` (same anchor rule /liabilitas uses)
      // is the real "next due" value when present.
      dueDate: l.nextDueDate ?? l.dueDate,
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

function formatLocaleDate(
  iso: string,
  locale: Locale,
  month: "short" | "long" = "long",
): string {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month,
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
  const { t, locale } = useLocale();
  return (
    <Dialog
      open={obligation !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      {/* EPIC-026 — composition ported 1:1 from the prototype's `dlg-pay`
          (docs/prototype/pages/anggaran.html:454): `dialog--sm` box, title +
          `.dialog__desc`, a `.notice` carrying name / amount / due date, one
          `.field` source-account select, and a Batal / Bayar Sekarang
          `.dialog__footer`. */}
      <DialogContent className="dialog--sm">
        <DialogTitle>{t.anggaran.obligationsPayDialogTitle}</DialogTitle>
        <DialogDescription>
          {t.anggaran.obligationsPayDialogDesc}
        </DialogDescription>
        {obligation && (
          <DialogBody>
            <div className="notice">
              <div className="flex-1">
                <div className="t-xs t-muted">{obligation.name}</div>
                <div className="t-xl t-black mono">
                  {formatRupiah(obligation.amountDue)}
                </div>
                {/* EPIC-026 Wave 4 — prototype's pay-dialog notice carries the
                    due date under the amount (`dlg-pay`, anggaran.html:463);
                    same `dueDate` the row already renders. */}
                {obligation.dueDate && (
                  <div className="t-xs t-muted">
                    {t.anggaran.obligationsDueDateNoticePrefix}
                    {formatLocaleDate(obligation.dueDate, locale)}
                  </div>
                )}
              </div>
            </div>
            <div className="field mt-3">
              <label className="label" htmlFor="obligation-source-account">
                {t.anggaran.obligationsSourceAccountLabel}
              </label>
              <select
                id="obligation-source-account"
                value={sourceAccountId}
                onChange={(e) => onSourceAccountChange(e.target.value)}
                className="select"
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
          </DialogBody>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button disabled={isPending || !sourceAccountId} onClick={onConfirm}>
            {isPending
              ? t.anggaran.obligationsPayProcessing
              : t.anggaran.obligationsPayConfirmButton}
          </Button>
        </DialogFooter>
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
    ? formatLocaleDate(obligation.dueDate, locale, "short")
    : null;
  return (
    <Rise index={index}>
      {/* EPIC-026 Wave 4 — prototype renders obligations as `.list-row`s
          inside the card (anggaran.html:113), not as bordered sub-cards:
          translation-table list-row pattern (`divide-y` on the body,
          `py-3` rows), amount + due date merged into ONE mono sub line
          ("Rp N · jatuh tempo D") exactly like `list-row__sub`. */}
      <div className="flex items-center gap-3 py-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent text-[15px]">
          {obligation.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-semibold">
            <span>{obligation.name}</span>
            {obligation.paidThisPeriod && (
              <StatusBadge variant="success">
                {t.anggaran.obligationsPaidBadge}
              </StatusBadge>
            )}
          </div>
          <div className="mono text-[11.5px] text-muted-foreground">
            {formatRupiah(obligation.amountDue)}
            {dueDateLabel && (
              <>
                {t.anggaran.obligationsDueDatePrefix}
                {dueDateLabel}
              </>
            )}
          </div>
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
      bodyClassName="-mt-1 divide-y"
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
  const amountField = useMoneyField();
  const [period, setPeriod] = useState<BudgetPeriod>("monthly");
  // EPIC-022 C2 — the API already exposed PATCH/DELETE for a budget;
  // `editing`/`deletingBudget` drive the two dialogs that finally reach them.
  const [editing, setEditing] = useState<BudgetDto | null>(null);
  const editField = useMoneyField({ isEdit: true });
  const [editPeriod, setEditPeriod] = useState<BudgetPeriod>("monthly");
  const [deletingBudget, setDeletingBudget] = useState<BudgetDto | null>(null);
  // A budget has no fields of its own beyond amount + period: the icon, the
  // kind and the COA mapping all live on the Category it belongs to, and this
  // dialog was already creating that Category silently — as `kind: "expense"`
  // with whatever COA account the server defaulted to. These make that
  // creation explicit, so "add a budget" and "add a COA category" are the same
  // act rather than one quietly implying the other.
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [coaAccountId, setCoaAccountId] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  // F3 — CASL only grants "manage Category" to owner/spouse; a `member` has
  // "manage Budget" but only "read Category". The dialog used to always
  // create a brand-new Category first regardless of role, so a member could
  // never finish adding a budget (403 on the category POST). When the
  // signed-in role can't create a category, this flow instead requires
  // picking one of the family's EXISTING categories of the chosen kind.
  const { canManage: canManageCategory } = useCanManage("Category");
  const [existingCategoryId, setExistingCategoryId] = useState("");
  // F3 — CASL grants "manage Budget" to owner/spouse/member; admin_staff
  // (and any role without a Budget grant at all) is read-only.
  const { canManage: canManageBudget } = useCanManage("Budget");

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

  // Same query key as /mastercoa and /masterdata so the cache is shared —
  // this dialog now offers the same COA account list those pages do.
  const { data: coaAccounts } = useQuery<
    Array<{ id: string; code: string; name: string; direction: string }>
  >({
    queryKey: ["coa-accounts", familyGroupId],
    queryFn: () =>
      apiFetch<
        Array<{ id: string; code: string; name: string; direction: string }>
      >(`/family-groups/${familyGroupId}/coa-accounts`, { token }),
    enabled: !!token && !!familyGroupId,
    staleTime: 60_000,
  });

  // Offering every account here would let the user pick the one pairing that
  // is never right — an expense category on an INCOME account (or the
  // reverse), which reports then group under the wrong direction. The API
  // rejects it too (categories.service.ts), but a dropdown that cannot make
  // the mistake beats an error after pressing Save.
  //
  // TRANSFER accounts stay available for BOTH types on purpose: the seeded
  // chart maps "Cicilan KPR" and "Tabungan & Investasi" — both `expense` — to
  // TRANSFER accounts, because paying down principal is spending in cashflow
  // terms but a balance-sheet transfer, not a P&L line.
  const selectableCoaAccounts = (coaAccounts ?? []).filter((a) =>
    kind === "income" ? a.direction !== "EXPENSE" : a.direction !== "INCOME",
  );

  // F3 fix — a member (manage Budget, read-only Category) picks from the
  // family's EXISTING categories instead of the create-a-category flow
  // below. Same query key as /masterdata and /mastercoa so the cache (and
  // any category just added there) is shared.
  const { data: allCategories } = useQuery<
    Array<{ id: string; name: string; kind: "income" | "expense" }>
  >({
    queryKey: ["categories", familyGroupId],
    queryFn: () =>
      apiFetch<Array<{ id: string; name: string; kind: "income" | "expense" }>>(
        `/family-groups/${familyGroupId}/categories`,
        { token },
      ),
    enabled: !!token && !!familyGroupId && canManageCategory === false,
    staleTime: 60_000,
  });
  const selectableCategories = (allCategories ?? []).filter(
    (c) => c.kind === kind,
  );

  const createMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      icon: string;
      limitAmount: number;
      period: BudgetPeriod;
      kind: "income" | "expense";
      coaAccountId: string;
      isPrivate: boolean;
      existingCategoryId: string;
      fxInputs?: FxInput[];
    }) => {
      if (!familyGroupId) throw new Error("familyGroupId missing");

      let categoryId: string;
      if (canManageCategory === false) {
        // Member flow — never POST /categories (403s on "manage Category");
        // the picker above already restricts this to an existing category.
        if (!payload.existingCategoryId) {
          throw new Error(t.anggaran.errorCategoryRequired);
        }
        categoryId = payload.existingCategoryId;
      } else {
        try {
          const cat = await apiFetch<{ id: string }>(
            `/family-groups/${familyGroupId}/categories`,
            {
              method: "POST",
              token,
              body: JSON.stringify({
                name: payload.name,
                kind: payload.kind,
                icon: payload.icon,
                isPrivate: payload.isPrivate,
                // "" means "let the server default by kind" — omitted rather
                // than sent as an empty string, which the uuid validator rejects.
                ...(payload.coaAccountId
                  ? { coaAccountId: payload.coaAccountId }
                  : {}),
              }),
            },
          );
          categoryId = cat.id;
        } catch (err) {
          const apiErr = err as { status?: number; message?: string };
          if (apiErr.status === 409) {
            const cats = await apiFetch<Array<{ id: string; name: string }>>(
              `/family-groups/${familyGroupId}/categories?kind=${payload.kind}`,
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
      }

      const dto: CreateBudgetDto = {
        categoryId,
        period: payload.period,
        limitAmount: payload.limitAmount,
        ...(payload.fxInputs ? { fxInputs: payload.fxInputs } : {}),
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

  // EPIC-022 C2 — edit an existing budget's limit/period. The category
  // itself is not editable here (the API's `UpdateBudgetDto` has no
  // `categoryId` field — a budget belongs to the category it was created
  // for), matching `/anggaran`'s own model of "one budget per category".
  const updateMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      limitAmount: number;
      period: BudgetPeriod;
      fxInputs?: FxInput[];
    }) => {
      if (!familyGroupId) throw new Error("familyGroupId missing");
      const dto: UpdateBudgetDto = {
        limitAmount: payload.limitAmount,
        period: payload.period,
        ...(payload.fxInputs ? { fxInputs: payload.fxInputs } : {}),
      };
      return apiFetch<BudgetDto>(
        `/family-groups/${familyGroupId}/budgets/${payload.id}`,
        { method: "PATCH", token, body: JSON.stringify(dto) },
      );
    },
    onSuccess: () => {
      if (familyGroupId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.budgets.all(familyGroupId),
        });
      }
      setEditing(null);
      toast.success(t.anggaran.toastUpdated);
    },
    onError: (err: unknown) => {
      const apiErr = err as { message?: string };
      toast.error(apiErr.message ?? t.anggaran.toastUpdateFailedDefault);
    },
  });

  function openEdit(budget: BudgetDto) {
    setEditing(budget);
    editField.reset(String(budget.limitAmount));
    setEditPeriod(budget.period);
  }

  function handleSaveEdit() {
    if (!editing) return;
    if (editField.resolved.isPending) return;
    const limitAmount = moneyIdr(editField, parseRupiah);
    if (limitAmount <= 0) {
      toast.warning(t.anggaran.toastAmountInvalid);
      return;
    }
    updateMutation.mutate(
      withFxInputs(
        {
          id: editing.id,
          limitAmount,
          period: editPeriod,
        },
        [["limitAmount", editField]],
      ),
    );
  }

  async function handleDeleteBudget() {
    if (!familyGroupId || !token || !deletingBudget) return;
    try {
      await apiFetch(
        `/family-groups/${familyGroupId}/budgets/${deletingBudget.id}`,
        { token, method: "DELETE" },
      );
      toast.success(t.anggaran.toastDeleted);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.budgets.all(familyGroupId),
      });
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      toast.error(apiErr.message ?? t.anggaran.toastDeleteFailedDefault);
    } finally {
      setDeletingBudget(null);
    }
  }

  function resetForm() {
    setName("");
    setIcon(ICON_OPTIONS[0] ?? "🎓");
    amountField.reset();
    setPeriod("monthly");
    setKind("expense");
    setCoaAccountId("");
    setIsPrivate(false);
    setExistingCategoryId("");
  }

  function handleSave() {
    // F3 fix — a member picks an existing category instead of naming a new
    // one; the create-a-category fields below don't apply to that flow.
    if (canManageCategory === false) {
      if (!existingCategoryId) {
        toast.warning(t.anggaran.errorCategoryRequired);
        return;
      }
    } else if (!name.trim()) {
      toast.warning(t.anggaran.toastNameRequired);
      return;
    }
    const limitAmount = moneyIdr(amountField, parseRupiah);
    if (limitAmount <= 0) {
      toast.warning(t.anggaran.toastAmountInvalid);
      return;
    }
    if (!familyGroupId) {
      toast.error(t.anggaran.toastNoFamilyGroup);
      return;
    }
    if (amountField.resolved.isPending) return;
    createMutation.mutate(
      withFxInputs(
        {
          name: name.trim(),
          icon,
          limitAmount,
          period,
          kind,
          coaAccountId,
          isPrivate,
          existingCategoryId,
        },
        [["limitAmount", amountField]],
      ),
    );
  }

  const totalLimit = budgets?.reduce((s, b) => s + b.limitAmount, 0) ?? 0;
  const totalSpent = budgets?.reduce((s, b) => s + b.spentAmount, 0) ?? 0;
  const typeBreakdown = budgets ? buildTypeBreakdown(budgets) : [];
  // EPIC-025 N3-E1 — J3 FOLD: "Terpakai per Kategori" bars, sorted by
  // spentAmount desc like the prototype's `hbar()` mount, over the same
  // already-fetched budgets list.
  const categoryBarBudgets = (budgets ?? [])
    .filter((budget) => budget.spentAmount > 0)
    .slice()
    .sort((a, b) => b.spentAmount - a.spentAmount);
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
      {/* EPIC-026 Wave 4 — prototype `page-lead` typography (translation
          table: h1 17px extrabold, 12.5px muted sub) + the "· N kategori
          aktif" tail (anggaran.html:22), derived from the budgets list
          already fetched. The prototype's period prev/next + Bulanan/
          Mingguan/Tahunan segmented control stay CUT: they are toast-stub
          dead controls with no period-browsing backend (J1 defect class). */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h1 className="text-[17px] font-extrabold tracking-tight">
            {t.anggaran.pageTitlePrefix}
            {now.toLocaleString(locale === "en" ? "en-US" : "id-ID", {
              month: "long",
              year: "numeric",
            })}
          </h1>
          <div className="mt-1 text-[12.5px] text-muted-foreground">
            {t.anggaran.totalBudgetPrefix}
            <span className="mono">{formatRupiah(totalLimit)}</span>
            {budgets && budgets.length > 0 && (
              <> · {budgets.length} kategori aktif</>
            )}
          </div>
        </div>
        {canManageBudget && (
          <Button
            onClick={() => setOpen(true)}
            disabled={!familyGroupId}
            className="h-auto px-[18px] py-2.5"
          >
            <Plus className="size-4" /> {t.anggaran.addCategoryButton}
          </Button>
        )}
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
          {/* EPIC-026 Wave 4 — prototype separates the two mini-stats with
              a border (`.budget-mini-stat + .budget-mini-stat`,
              app.css:1225). */}
          <div className="flex h-full flex-col justify-between divide-y rounded-[14px] border bg-card px-4 py-2">
            <div className="flex items-center gap-2.5 py-2">
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
            <div className="flex items-center gap-2.5 py-2">
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
      {/* EPIC-026 Wave 4 — prototype's alert is a `notice notice--warning`
          with a triangle-alert icon (anggaran.html:96), not a primary/
          accent box: warning styling per the translation-table notice
          mapping. The prototype's "Tips Hemat →" is a toast-stub dead
          control — removed per the J1 defect class (same as login's inert
          "Ingat saya"). */}
      {(overBudgetItems.length > 0 || nearLimitItems.length > 0) && (
        <div className="flex items-center gap-2.5 rounded-[11px] border border-warning/35 bg-warning-soft p-3 text-warning">
          <TriangleAlert className="size-[18px] shrink-0" />
          <div className="flex-1">
            {overBudgetItems.length > 0 ? (
              <>
                <div className="text-[12.5px] font-bold">
                  {overBudgetItems[0]!.categoryName}
                  {t.anggaran.overBudgetMidText}
                  {overBudgetItems[0]!.usagePercent - 100}
                  {t.anggaran.overBudgetSuffix}
                </div>
                <div className="text-[11.5px]">{t.anggaran.overBudgetDesc}</div>
              </>
            ) : (
              <>
                <div className="text-[12.5px] font-bold">
                  {nearLimitItems[0]!.categoryName}
                  {t.anggaran.nearLimitMidText}
                  {nearLimitItems[0]!.usagePercent}
                  {t.anggaran.nearLimitSuffix}
                </div>
                <div className="text-[11.5px]">{t.anggaran.nearLimitDesc}</div>
              </>
            )}
          </div>
        </div>
      )}

      {familyGroupId && (
        <ObligationsSection familyGroupId={familyGroupId} token={token} />
      )}

      <SectionCard
        title={t.anggaran.categoryBreakdownTitle}
        action={
          canManageBudget && (
            <CardLink onClick={() => setOpen(true)}>
              {t.anggaran.categoryAddAction}
            </CardLink>
          )
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
              <BudgetItem
                key={b.id}
                dto={b}
                index={i}
                canManage={!!canManageBudget}
                onEdit={() => openEdit(b)}
                onDelete={() => setDeletingBudget(b)}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {/* EPIC-026 Wave 4 — prototype uses `grid--sidebar` (2fr/1fr) for
          the chart + type-breakdown band (anggaran.html:331), not equal
          halves. */}
      {(categoryBarBudgets.length > 0 || typeBreakdown.length > 0) && (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <SectionCard title={t.anggaran.categoryBarChartTitle}>
            {categoryBarBudgets.length === 0 ? (
              <div className="py-4 text-center text-[13px] text-muted-foreground">
                {t.anggaran.emptyCategoryBarChart}
              </div>
            ) : (
              <BudgetUsageList budgets={categoryBarBudgets} />
            )}
          </SectionCard>

          {typeBreakdown.length > 0 && (
            <SectionCard title={t.anggaran.typeBreakdownTitle}>
              <BudgetTypeSummary
                rows={typeBreakdown}
                totalSpent={totalSpent}
                totalLimit={totalLimit}
                totalRemaining={totalRemaining}
                overBudgetCount={overBudgetItems.length}
                nearLimitCount={nearLimitItems.length}
                t={t}
              />
            </SectionCard>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        {/* EPIC-026 — composition ported 1:1 from the prototype's
            `dlg-budget` (docs/prototype/pages/anggaran.html:386): title +
            `.dialog__desc`, then `.field` Nama Kategori → `.field` Ikon
            (a row of `.btn--outline.btn--icon` toggles) → a `.field-row`
            pairing Budget per Bulan with Periode → `.dialog__footer`.
            The prototype's "Tipe Anggaran" select and "Peringatan 80%"
            switch stay CUT: CreateBudgetDto has no budgetType (it derives
            from the category's COA) and no notification-threshold field
            exists — rendering either would silently drop the user's input. */}
        <DialogContent>
          <DialogTitle>{t.anggaran.modalAddTitle}</DialogTitle>
          <DialogDescription>{t.anggaran.modalAddDesc}</DialogDescription>
          <DialogBody>
            {/* polish-j batch 7a item 2 — Budget (this dialog's actual
                point) now leads; Tipe/COA/Privat/Ikon collapse under "Opsi
                lanjutan" for the owner flow, since a default (expense, auto
                COA, not private) already covers most budgets. */}
            {/* F3 fix — a member can "manage Budget" but only "read
                Category": the create-a-category fields below would 403 on
                submit, so a member instead picks an existing category of
                the chosen kind (see `existingCategoryId` above). */}
            {canManageCategory !== false && (
              <div className="field">
                <label className="label" htmlFor="budget-name">
                  {t.anggaran.fieldCategoryNameLabel}
                </label>
                <input
                  id="budget-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.anggaran.fieldCategoryNamePlaceholder}
                  className="input"
                />
              </div>
            )}
            {canManageCategory === false && (
              <div className="field">
                <label className="label" htmlFor="budget-existing-category">
                  {t.anggaran.fieldExistingCategoryLabel}
                </label>
                <select
                  id="budget-existing-category"
                  value={existingCategoryId}
                  onChange={(e) => setExistingCategoryId(e.target.value)}
                  className="select"
                >
                  <option value="">
                    {t.anggaran.existingCategoryPlaceholder}
                  </option>
                  {selectableCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {selectableCategories.length === 0 && (
                  <span className="hint block">
                    {t.anggaran.existingCategoryEmptyOption}
                  </span>
                )}
              </div>
            )}
            {/* EPIC-026 Wave 4 — prototype puts amount + periode side by
                side in a `field-row` (anggaran.html:410). */}
            <div className="field field-row mt-3">
              <div className="field mt-0">
                <label className="label" htmlFor="budget-amount">
                  {t.anggaran.fieldAmountLabel}
                </label>
                <MoneyInput field={amountField} id="budget-amount" />
              </div>
              <div className="field mt-0">
                <label className="label" htmlFor="budget-period">
                  {t.anggaran.fieldPeriodLabel}
                </label>
                <select
                  id="budget-period"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as BudgetPeriod)}
                  className="select"
                >
                  <option value="monthly">
                    {t.anggaran.periodLabels.monthly}
                  </option>
                  <option value="weekly">
                    {t.anggaran.periodLabels.weekly}
                  </option>
                  <option value="yearly">
                    {t.anggaran.periodLabels.yearly}
                  </option>
                </select>
              </div>
            </div>
            {canManageCategory !== false && (
              <AdvancedDisclosure label={t.common.advancedOptions}>
                {/* The category half of the form. These were previously
                    decided for the user — always `expense`, always the
                    server's default COA account, never private — even
                    though the budget's whole identity comes from the
                    category it creates. */}
                <div className="field field-row mt-0">
                  <div className="field mt-0">
                    <label className="label" htmlFor="budget-kind">
                      {t.anggaran.fieldKindLabel}
                    </label>
                    <select
                      id="budget-kind"
                      value={kind}
                      onChange={(e) => {
                        setKind(e.target.value as "income" | "expense");
                        // The previously chosen account/category may not be
                        // offered for the new kind; fall back rather than
                        // silently submitting a value no longer in the list.
                        setCoaAccountId("");
                        setExistingCategoryId("");
                      }}
                      className="select"
                    >
                      <option value="expense">{t.common.expense}</option>
                      <option value="income">{t.common.income}</option>
                    </select>
                  </div>
                  <div className="field mt-0">
                    <label className="label" htmlFor="budget-coa">
                      {t.anggaran.fieldCoaLabel}
                    </label>
                    <select
                      id="budget-coa"
                      value={coaAccountId}
                      onChange={(e) => setCoaAccountId(e.target.value)}
                      className="select"
                    >
                      <option value="">{t.anggaran.coaAutoOptionLabel}</option>
                      {selectableCoaAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} · {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="field mt-0">
                  {/* polish-j batch 6 item 2 — switch first (left), label +
                      hint after (right), matching crud-modal.tsx's toggle
                      branch and every other visibility toggle in the app. */}
                  <div className="row mt-0 gap-[9px]">
                    <Switch
                      checked={isPrivate}
                      onCheckedChange={setIsPrivate}
                      aria-label={t.anggaran.fieldPrivateLabel}
                    />
                    <span>
                      <span className="label">
                        {t.anggaran.fieldPrivateLabel}
                      </span>
                      <span className="hint block">
                        {t.anggaran.fieldPrivateHint}
                      </span>
                    </span>
                  </div>
                </div>
                {/* The fixed 8-emoji grid that used to live here is gone: a
                    category whose icon is a boat or a violin was simply not
                    expressible. Same component the master-data category
                    dialog uses, so the two no longer disagree about what an
                    icon is; batch 7a item 1 collapses it behind a 40px
                    trigger button instead of an always-open grid. */}
                <IconPickerField
                  label={t.anggaran.iconLabel}
                  value={icon}
                  onChange={setIcon}
                  searchPlaceholder={t.common.emojiSearchPlaceholder}
                  noResultsLabel={t.common.emojiNoResults}
                  loadingLabel={t.common.emojiLoading}
                  ariaLabel={t.anggaran.iconGroupAriaLabel}
                />
              </AdvancedDisclosure>
            )}
          </DialogBody>
          {/* EPIC-026 Wave 4 — prototype's `dialog__footer`: Batal +
              Simpan side by side (anggaran.html:444), not a single
              full-width save. */}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                createMutation.isPending || amountField.resolved.isPending
              }
            >
              <Save className="size-[14px]" />
              {createMutation.isPending
                ? t.anggaran.savingLabel
                : t.anggaran.saveCategoryButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EPIC-022 C2 — edit an existing budget's limit/period. Only the
          fields `UpdateBudgetDto` actually accepts are offered — the
          category name/icon/kind belong to the Category this budget was
          created for and are read-only here, same restriction the API
          itself enforces. */}
      <Dialog
        open={editing !== null}
        onOpenChange={(nextOpen) => !nextOpen && setEditing(null)}
      >
        <DialogContent>
          <DialogTitle>{t.anggaran.modalEditTitle}</DialogTitle>
          <DialogDescription>{t.anggaran.modalEditDesc}</DialogDescription>
          {editing && (
            <DialogBody>
              <div className="field">
                <span className="label">
                  {t.anggaran.fieldCategoryNameLabel}
                </span>
                <div className="flex items-center gap-2 text-[13.5px] font-semibold">
                  <span>{editing.categoryIcon ?? "📦"}</span>
                  <span>{editing.categoryName}</span>
                </div>
              </div>
              <div className="field field-row">
                <div className="field mt-0">
                  <label className="label" htmlFor="budget-edit-amount">
                    {t.anggaran.fieldAmountLabel}
                  </label>
                  <MoneyInput field={editField} id="budget-edit-amount" />
                </div>
                <div className="field mt-0">
                  <label className="label" htmlFor="budget-edit-period">
                    {t.anggaran.fieldPeriodLabel}
                  </label>
                  <select
                    id="budget-edit-period"
                    value={editPeriod}
                    onChange={(e) =>
                      setEditPeriod(e.target.value as BudgetPeriod)
                    }
                    className="select"
                  >
                    <option value="monthly">
                      {t.anggaran.periodLabels.monthly}
                    </option>
                    <option value="weekly">
                      {t.anggaran.periodLabels.weekly}
                    </option>
                    <option value="yearly">
                      {t.anggaran.periodLabels.yearly}
                    </option>
                  </select>
                </div>
              </div>
            </DialogBody>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {t.common.cancel}
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={
                updateMutation.isPending || editField.resolved.isPending
              }
            >
              <Save className="size-[14px]" />
              {updateMutation.isPending
                ? t.anggaran.savingLabel
                : t.anggaran.saveChangesButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        label={deletingBudget ? `"${deletingBudget.categoryName}"` : null}
        title={t.anggaran.deleteDialogTitle}
        body={t.anggaran.deleteDialogBody}
        confirmLabel={t.anggaran.deleteDialogConfirm}
        onClose={() => setDeletingBudget(null)}
        onConfirm={handleDeleteBudget}
      />
    </div>
  );
}
