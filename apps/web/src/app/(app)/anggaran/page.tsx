"use client";

import { useState } from "react";
import "./anggaran.css";
import { Plus, Save, Pencil, Trash2 } from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AddTile,
  BentoCard,
  BentoGrid,
  BentoHero,
  BentoTiles,
  GhostButton,
  HeroKpi,
  Rise,
  Segmented,
  SeeAll,
  StatusBadge,
  TipsCard,
  Track,
} from "@/components/wm";
import { HatchedBarChart } from "@/components/charts/bento-charts";
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
import { useApiError } from "@/hooks/use-api-error";
import { useLocale } from "@/hooks/use-locale";
import { useCanManage } from "@/hooks/use-role-permissions";
import { parseRupiah } from "@/lib/format";
import { useMoney } from "@/hooks/use-money";
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
  CreateBudgetDto,
  UpdateBudgetDto,
  LiabilityDto,
  LiabilityType,
  InsuranceDto,
  InsuranceType,
  FxInput,
} from "@wealthme/contracts";
import type { Locale } from "@/i18n";

function budgetTone(dto: BudgetDto): "lime" | "orange" | "bad" {
  if (dto.isOverBudget) return "bad";
  if (dto.isNearLimit) return "orange";
  return "lime";
}

const ICON_OPTIONS = ["🎓", "🎨", "🎁", "🐶", "👶", "📚", "💪", "🙏"];

/** Axis ticks: "20 jt", "500 rb". */
function axisJt(value: number): string {
  const abs = Math.abs(value);
  const trim = (n: number) =>
    n.toFixed(1).replace(/\.0$/, "").replace(".", ",");
  if (abs >= 1e9) return `${trim(abs / 1e9)} M`;
  if (abs >= 1e6) return `${trim(abs / 1e6)} jt`;
  if (abs >= 1e3) return `${trim(abs / 1e3)} rb`;
  return `${Math.round(abs)}`;
}

function BudgetTile({
  dto,
  canManage,
  onEdit,
  onDelete,
}: {
  dto: BudgetDto;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useLocale();
  const money = useMoney();
  const tone = budgetTone(dto);
  return (
    <div className="wm-btile ag-tile" data-tone={tone}>
      <span className="wm-btile-tt">
        <span className="wm-ci">{dto.categoryIcon ?? "📦"}</span>
        <span className="ag-name">{dto.categoryName}</span>
        {canManage && (
          <span className="ag-acts">
            <button
              type="button"
              onClick={onEdit}
              aria-label={`${t.anggaran.editAriaLabelPrefix}${dto.categoryName}`}
            >
              <Pencil aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={`${t.anggaran.deleteAriaLabelPrefix}${dto.categoryName}`}
            >
              <Trash2 aria-hidden="true" />
            </button>
          </span>
        )}
      </span>
      <span className="wm-pv ag-pv">{dto.usagePercent}%</span>
      <Track value={dto.usagePercent} fill={tone} />
      <small>
        {money.format(dto.spentAmount)}
        {t.anggaran.amountsMidDari}
        {money.format(dto.limitAmount)}
      </small>
      <small className="ag-foot">
        {dto.isOverBudget
          ? `${t.anggaran.categoryFooterOverBudgetPrefix}${money.format(dto.spentAmount - dto.limitAmount)}`
          : `${t.anggaran.categoryFooterRemainingPrefix}${money.format(dto.remainingAmount)}`}
      </small>
    </div>
  );
}

function BudgetSkeleton() {
  return (
    <div className="ag-skeleton" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <div key={i} className="wm-btile animate-pulse" />
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
      // amount the row DISPLAYS (`money.format(obligation.amountDue)`) is
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
  const money = useMoney();
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
                  {money.format(obligation.amountDue)}
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
  const money = useMoney();
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
            {money.format(obligation.amountDue)}
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
  const { handleError } = useApiError();
  const money = useMoney();
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
    onError: handleError,
  });

  const obligations = toObligations(liabilities, insurances);
  if (obligations.length === 0) return null;

  // EPIC-025 N3 rework — prototype's right-aligned section summary
  // ("3 dari 5 belum dibayar · Rp 5.945.000"), derived from the same
  // obligations list already rendered below — no new data.
  const unpaid = obligations.filter((o) => !o.paidThisPeriod);
  const unpaidTotal = unpaid.reduce((sum, o) => sum + o.amountDue, 0);

  return (
    <BentoCard
      className="ag-ob"
      title={t.anggaran.obligationsSectionTitle}
      caption={
        // One text node: a row amount can equal this total exactly, and a
        // split node would make getByText ambiguous in the obligations test.
        <>
          {unpaid.length}
          {t.anggaran.obligationsSummaryMidPrefix}
          {obligations.length}
          {t.anggaran.obligationsSummaryMidSuffix}
          {money.format(unpaidTotal)}
        </>
      }
    >
      <div className="ag-ob-list divide-y">
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
      </div>
      <SeeAll href="/liabilitas">{t.anggaran.v2.seeAllObligations}</SeeAll>
    </BentoCard>
  );
}

export default function AnggaranPage() {
  const { t, locale } = useLocale();
  const { handleError } = useApiError();
  const money = useMoney();
  const { data: session } = useSession();
  const token = session?.accessToken;
  const familyGroupId = session?.familyGroupId;
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState<"pct" | "left">("pct");
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
    onError: handleError,
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
    onError: handleError,
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
      handleError(err);
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

  const sortedBudgets = (budgets ?? [])
    .slice()
    .sort((x, y) =>
      sort === "pct"
        ? y.usagePercent - x.usagePercent
        : y.remainingAmount - x.remainingAmount,
    );
  const monthLabel = now.toLocaleString(locale === "en" ? "en-US" : "id-ID", {
    month: "long",
  });
  const worst = overBudgetItems[0] ?? nearLimitItems[0];
  const hottest = (budgets ?? []).reduce(
    (m, b, k, arr) => (b.usagePercent > arr[m]!.usagePercent ? k : m),
    0,
  );
  const mosaicFilled = Math.round((Math.min(usagePct, 100) / 100) * 18);
  const mosaic = Array.from({ length: 18 }, (_, i) =>
    i < mosaicFilled
      ? usagePct >= 100
        ? "o"
        : i > mosaicFilled - 4
          ? "c"
          : "a"
      : i % 5 === 0
        ? "b"
        : "",
  ) as ("a" | "b" | "c" | "o" | "")[];

  return (
    <BentoGrid className="ag-grid">
      <h1 className="sr-only">{t.shell.pageTitles.anggaran}</h1>
      <BentoHero
        className="ag-hero"
        currency={null}
        value={money
          .format(Math.abs(totalLimit - totalSpent))
          .replace(/,00$/, "")}
        caption={`${totalLimit >= totalSpent ? t.anggaran.v2.leftCap : t.anggaran.v2.overCap} ${monthLabel}`}
        controls={
          <>
            <span className="wm-ghost-btn ag-month">{monthLabel}</span>
            {canManageBudget && (
              <GhostButton
                lit
                onClick={() => setOpen(true)}
                disabled={!familyGroupId}
              >
                <Plus aria-hidden="true" /> {t.anggaran.addCategoryButton}
              </GhostButton>
            )}
          </>
        }
        chart={
          budgets && budgets.length > 0 ? (
            <HatchedBarChart
              labels={budgets.map((b) => b.categoryName.split(" ")[0] ?? "")}
              series={[
                {
                  name: t.anggaran.v2.legendLimit,
                  data: budgets.map((b) => b.limitAmount),
                  color: "var(--wm-ghost)",
                },
                {
                  name: t.anggaran.v2.legendSpent,
                  data: budgets.map((b) => b.spentAmount),
                  color: "var(--wm-lime)",
                },
              ]}
              highlight={hottest}
              format={money.formatCompact}
              axis={axisJt}
              wide
              ariaLabel={t.anggaran.categoryBarChartTitle}
            />
          ) : (
            <p className="wm-cap">{t.anggaran.v2.chartEmpty}</p>
          )
        }
        kpis={
          <>
            <HeroKpi
              label={t.anggaran.v2.kpiLimit}
              value={money.formatCompact(totalLimit)}
              delta={
                <small className="wm-cap">
                  {budgets?.length ?? 0}
                  {t.anggaran.categoriesSuffix}
                </small>
              }
            />
            <HeroKpi
              label={t.anggaran.v2.kpiSpent}
              value={money.formatCompact(totalSpent)}
              delta={
                <small className="wm-cap">
                  {usagePct}% {t.anggaran.v2.ofLimit}
                </small>
              }
            />
            <HeroKpi
              label={t.anggaran.v2.kpiSafe}
              value={money.formatCompact(
                daysLeft > 0
                  ? Math.round(totalRemaining / daysLeft)
                  : totalRemaining,
              )}
              delta={
                <small className="wm-cap">
                  {daysLeft}
                  {t.anggaran.daysSuffix.toLowerCase()}
                </small>
              }
            />
          </>
        }
      />

      {familyGroupId && (
        <ObligationsSection familyGroupId={familyGroupId} token={token} />
      )}

      <BentoCard
        className="ag-cats"
        title={t.anggaran.categoryBreakdownTitle}
        caption={t.anggaran.v2.tilesCaption}
        action={
          <Segmented
            label={t.anggaran.v2.sortLabel}
            value={sort}
            onChange={setSort}
            options={[
              { value: "pct", label: t.anggaran.v2.sortUsed },
              { value: "left", label: t.anggaran.v2.sortLeft },
            ]}
          />
        }
      >
        {isLoading && <BudgetSkeleton />}
        {isError && (
          <p role="alert" className="ag-state ag-state-bad">
            {t.anggaran.errorLoad}
          </p>
        )}
        {!isLoading && !isError && (!budgets || budgets.length === 0) && (
          <p className="ag-state">{t.anggaran.emptyState}</p>
        )}
        {!isLoading && !isError && budgets && budgets.length > 0 && (
          <BentoTiles>
            {sortedBudgets.map((b) => (
              <BudgetTile
                key={b.id}
                dto={b}
                canManage={!!canManageBudget}
                onEdit={() => openEdit(b)}
                onDelete={() => setDeletingBudget(b)}
              />
            ))}
            {canManageBudget && (
              <AddTile onClick={() => setOpen(true)}>
                <Plus aria-hidden="true" /> {t.anggaran.v2.addTile}
              </AddTile>
            )}
          </BentoTiles>
        )}
      </BentoCard>

      <TipsCard
        className="ag-alert"
        title={
          worst
            ? worst.isOverBudget
              ? `${worst.categoryName}${t.anggaran.overBudgetMidText}${worst.usagePercent - 100}${t.anggaran.overBudgetSuffix}`
              : `${worst.categoryName}${t.anggaran.nearLimitMidText}${worst.usagePercent}${t.anggaran.nearLimitSuffix}`
            : t.anggaran.v2.alertOkTitle
        }
        mosaic={mosaic}
        action={<SeeAll href="/transaksi">{t.anggaran.v2.alertSeeTx}</SeeAll>}
      >
        {worst
          ? worst.isOverBudget
            ? t.anggaran.overBudgetDesc
            : t.anggaran.nearLimitDesc
          : t.anggaran.v2.alertOkBody}
      </TipsCard>

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
    </BentoGrid>
  );
}
