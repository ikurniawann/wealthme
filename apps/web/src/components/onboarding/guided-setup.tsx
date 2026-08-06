"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, ClipboardList, Receipt, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import type { AccountDto, BudgetDto, BudgetPeriod } from "@wealthme/contracts";
import { useSession } from "@/lib/auth-compat";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { formatAmountInput, formatRupiah, parseRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { setOnboarded } from "./use-onboarded";
import {
  clearSetupProgress,
  getSetupProgress,
  setSetupProgress,
  type SetupStep,
} from "./setup-progress";

// EPIC-023 Task H3 (D22, US-DASH-7) — replaces the old button tour
// (components/onboarding/tour-steps.ts, removed) with a guided first setup
// that creates a REAL account, budget, and transaction through the exact
// endpoints /rekening, /anggaran, and the global transaction dialog use
// (POST accounts / POST categories+budgets / POST transactions), and shows
// the consequence (net worth appearing/moving, budget usage rising) after
// each real write. No bespoke write path is introduced.

const STEP_ORDER: SetupStep[] = ["account", "budget", "transaction"];

const fieldClass =
  "w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card";

type AccountLite = { id: string; name: string };
type BudgetLite = {
  id: string;
  categoryId: string;
  categoryName: string;
  limitAmount: number;
};

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[12px] font-semibold text-muted-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

async function fetchNetWorth(
  familyGroupId: string,
  token: string | undefined,
): Promise<number> {
  const summary = await apiFetch<{ netWorth: number }>(
    `/family-groups/${familyGroupId}/dashboard/summary`,
    { token },
  );
  return summary.netWorth;
}

export function GuidedSetup({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const { data: session } = useSession();
  const userId = session?.userId ?? "";
  const familyGroupId = session?.familyGroupId ?? "";
  const token = session?.accessToken;
  const tr = t.onboarding;
  const uid = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [step, setStep] = useState<SetupStep>("account");
  const [isSaving, setIsSaving] = useState(false);

  // Resolved real ids — either created by this wizard or picked up from a
  // step the user chose to skip because they already had one.
  const [accountId, setAccountId] = useState("");
  const [accountName, setAccountName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [budgetId, setBudgetId] = useState("");
  const [limitAmount, setLimitAmount] = useState(0);

  const [existingAccounts, setExistingAccounts] = useState<
    AccountLite[] | null
  >(null);
  const [existingBudgets, setExistingBudgets] = useState<BudgetLite[] | null>(
    null,
  );

  // Form fields (this step's in-progress input, distinct from the resolved
  // values above).
  const [accountNameField, setAccountNameField] = useState("");
  const [balanceField, setBalanceField] = useState("");
  const [categoryNameField, setCategoryNameField] = useState("");
  const [limitField, setLimitField] = useState("");
  const [period] = useState<BudgetPeriod>("monthly");
  const [amountField, setAmountField] = useState("");
  const [descriptionField, setDescriptionField] = useState("");

  const [accountConsequence, setAccountConsequence] = useState<{
    before: number;
    after: number;
  } | null>(null);
  const [budgetCreated, setBudgetCreated] = useState(false);
  const [txConsequence, setTxConsequence] = useState<{
    netWorthAfter: number;
    usagePercent: number;
  } | null>(null);
  const [txHeld, setTxHeld] = useState(false);

  // Load saved progress + the family's existing rows every time the dialog
  // opens — resumable (D22): a user who abandons mid-way picks back up
  // exactly where they left off, and never sees a duplicate-creation prompt
  // for something they (or another member) already set up meanwhile.
  useEffect(() => {
    if (!open || !userId || !familyGroupId || !token) return;
    const saved = getSetupProgress(userId);
    /* eslint-disable react-hooks/set-state-in-effect -- restoring saved
       progress when the dialog (re)opens, not synchronizing on every
       render; same basis as the precedent in walkthrough.tsx's
       isOnboarded() check. */
    if (saved && saved.step !== "done") {
      setStep(saved.step);
      setAccountId(saved.accountId ?? "");
      setAccountName(saved.accountName ?? "");
      setCategoryId(saved.categoryId ?? "");
      setCategoryName(saved.categoryName ?? "");
      setBudgetId(saved.budgetId ?? "");
      setLimitAmount(saved.limitAmount ?? 0);
    } else {
      setStep("account");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    let cancelled = false;
    void apiFetch<AccountDto[]>(`/family-groups/${familyGroupId}/accounts`, {
      token,
    })
      .then((rows) => {
        if (!cancelled)
          setExistingAccounts(rows.map((r) => ({ id: r.id, name: r.name })));
      })
      .catch(() => {
        if (!cancelled) setExistingAccounts([]);
      });
    void apiFetch<BudgetDto[]>(`/family-groups/${familyGroupId}/budgets`, {
      token,
    })
      .then((rows) => {
        if (!cancelled)
          setExistingBudgets(
            rows.map((r) => ({
              id: r.id,
              categoryId: r.categoryId,
              categoryName: r.categoryName,
              limitAmount: r.limitAmount,
            })),
          );
      })
      .catch(() => {
        if (!cancelled) setExistingBudgets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, userId, familyGroupId, token]);

  // Move focus onto the new step's heading so keyboard/screen-reader users
  // land on the fresh content instead of a stale target — label/focus
  // association has been a repeat HIGH across this epic (H1, E, F).
  useEffect(() => {
    if (open) headingRef.current?.focus();
  }, [open, step]);

  if (!open) return null;

  function skipAll() {
    setOnboarded(userId);
    clearSetupProgress(userId);
    onClose();
  }

  function finish() {
    setOnboarded(userId);
    clearSetupProgress(userId);
    onClose();
  }

  async function handleCreateAccount() {
    const trimmed = accountNameField.trim();
    if (!trimmed || !familyGroupId) return;
    const balanceNum = parseRupiah(balanceField);
    setIsSaving(true);
    try {
      const before = await fetchNetWorth(familyGroupId, token);
      const account = await apiFetch<AccountDto>(
        `/family-groups/${familyGroupId}/accounts`,
        {
          token,
          method: "POST",
          body: JSON.stringify({
            type: "bank",
            name: trimmed,
            balance: balanceNum,
            isPrivate: false,
          }),
        },
      );
      const after = await fetchNetWorth(familyGroupId, token);
      setAccountId(account.id);
      setAccountName(account.name);
      setAccountConsequence({ before, after });
      setSetupProgress(userId, {
        step: "budget",
        accountId: account.id,
        accountName: account.name,
      });
      toast.success(tr.account.toastCreated);
    } catch {
      toast.error(tr.account.toastFailed);
    } finally {
      setIsSaving(false);
    }
  }

  function skipAccountStep() {
    const existing = existingAccounts?.[0];
    if (!existing) return;
    setAccountId(existing.id);
    setAccountName(existing.name);
    setSetupProgress(userId, {
      step: "budget",
      accountId: existing.id,
      accountName: existing.name,
    });
    setStep("budget");
  }

  async function handleCreateBudget() {
    const trimmed = categoryNameField.trim();
    if (!trimmed || !familyGroupId) return;
    const limitNum = parseRupiah(limitField);
    setIsSaving(true);
    try {
      let newCategoryId: string;
      try {
        const cat = await apiFetch<{ id: string }>(
          `/family-groups/${familyGroupId}/categories`,
          {
            token,
            method: "POST",
            body: JSON.stringify({ name: trimmed, kind: "expense" }),
          },
        );
        newCategoryId = cat.id;
      } catch (err) {
        const apiErr = err as { status?: number };
        if (apiErr.status !== 409) throw err;
        const cats = await apiFetch<Array<{ id: string; name: string }>>(
          `/family-groups/${familyGroupId}/categories?kind=expense`,
          { token },
        );
        const match = cats.find(
          (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
        );
        if (!match) throw err;
        newCategoryId = match.id;
      }
      const budget = await apiFetch<BudgetDto>(
        `/family-groups/${familyGroupId}/budgets`,
        {
          token,
          method: "POST",
          body: JSON.stringify({
            categoryId: newCategoryId,
            period,
            limitAmount: limitNum,
          }),
        },
      );
      setCategoryId(newCategoryId);
      setCategoryName(budget.categoryName);
      setBudgetId(budget.id);
      setLimitAmount(limitNum);
      setBudgetCreated(true);
      setSetupProgress(userId, {
        step: "transaction",
        accountId,
        accountName,
        categoryId: newCategoryId,
        categoryName: budget.categoryName,
        budgetId: budget.id,
        limitAmount: limitNum,
      });
      toast.success(tr.budget.toastCreated);
    } catch {
      toast.error(tr.budget.toastFailed);
    } finally {
      setIsSaving(false);
    }
  }

  function skipBudgetStep() {
    const existing = existingBudgets?.[0];
    if (!existing) return;
    setCategoryId(existing.categoryId);
    setCategoryName(existing.categoryName);
    setBudgetId(existing.id);
    setLimitAmount(existing.limitAmount);
    setSetupProgress(userId, {
      step: "transaction",
      accountId,
      accountName,
      categoryId: existing.categoryId,
      categoryName: existing.categoryName,
      budgetId: existing.id,
      limitAmount: existing.limitAmount,
    });
    setStep("transaction");
  }

  async function handleCreateTransaction() {
    const amountNum = parseRupiah(amountField);
    if (!amountNum || amountNum <= 0) return;
    if (!accountId) {
      toast.error(tr.transaction.noAccountError);
      return;
    }
    setIsSaving(true);
    try {
      const result = await apiFetch<{ held?: true } & Record<string, unknown>>(
        `/family-groups/${familyGroupId}/transactions`,
        {
          token,
          method: "POST",
          body: JSON.stringify({
            accountId,
            ...(categoryId ? { categoryId } : {}),
            amount: amountNum,
            type: "expense",
            ...(descriptionField ? { description: descriptionField } : {}),
            occurredAt: new Date().toISOString(),
          }),
        },
      );
      const wasHeld =
        !!result && typeof result === "object" && "held" in result;
      if (wasHeld) {
        setTxHeld(true);
        toast.warning(tr.transaction.toastHeld);
        setSetupProgress(userId, {
          step: "done",
          accountId,
          accountName,
          categoryId,
          categoryName,
          budgetId,
          limitAmount,
        });
        setStep("done");
        return;
      }
      const after = await fetchNetWorth(familyGroupId, token);
      let usagePercent = 0;
      if (budgetId) {
        const budgets = await apiFetch<BudgetDto[]>(
          `/family-groups/${familyGroupId}/budgets`,
          { token },
        );
        usagePercent =
          budgets.find((b) => b.id === budgetId)?.usagePercent ?? 0;
      }
      setTxConsequence({ netWorthAfter: after, usagePercent });
      setSetupProgress(userId, {
        step: "done",
        accountId,
        accountName,
        categoryId,
        categoryName,
        budgetId,
        limitAmount,
      });
      toast.success(tr.transaction.toastCreated);
    } catch {
      toast.error(tr.transaction.toastFailed);
    } finally {
      setIsSaving(false);
    }
  }

  const stepIndex = STEP_ORDER.indexOf(step) + 1;

  function renderAccountStep() {
    const nameId = `${uid}-account-name`;
    const balanceId = `${uid}-account-balance`;
    if (accountConsequence) {
      return (
        <div>
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="text-[15px] font-extrabold outline-none"
          >
            {tr.account.consequenceTitle}
          </h3>
          <div className="mt-3 rounded-lg border bg-success-soft/60 p-3.5 text-[13px]">
            <div className="text-muted-foreground">
              {tr.account.consequenceBefore}
              {formatRupiah(accountConsequence.before)}
            </div>
            <div className="mt-1 text-[17px] font-extrabold text-success">
              {tr.account.consequenceAfter}
              {formatRupiah(accountConsequence.after)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStep("budget")}
            className="mt-4 w-full rounded-md bg-primary py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-primary-strong"
          >
            {tr.continueButton}
          </button>
        </div>
      );
    }
    const hasExisting = (existingAccounts?.length ?? 0) > 0;
    return (
      <div>
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="text-[15px] font-extrabold outline-none"
        >
          {tr.account.title}
        </h3>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
          {tr.account.body}
        </p>
        {hasExisting && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-md bg-secondary p-2.5 text-[12px]">
            <span>{tr.account.alreadyHaveNotice}</span>
            <button
              type="button"
              onClick={skipAccountStep}
              className="shrink-0 font-semibold text-primary hover:underline"
            >
              {tr.account.skipStepButton}
            </button>
          </div>
        )}
        <div className="mt-4 space-y-3">
          <Field label={tr.account.nameLabel} htmlFor={nameId}>
            <input
              id={nameId}
              value={accountNameField}
              onChange={(e) => setAccountNameField(e.target.value)}
              placeholder={tr.account.namePlaceholder}
              className={fieldClass}
            />
          </Field>
          <Field label={tr.account.balanceLabel} htmlFor={balanceId}>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                Rp
              </span>
              <input
                id={balanceId}
                inputMode="numeric"
                value={balanceField}
                onChange={(e) =>
                  setBalanceField(formatAmountInput(e.target.value))
                }
                placeholder="0"
                className={cn(fieldClass, "pl-9")}
              />
            </div>
          </Field>
        </div>
        <button
          type="button"
          onClick={handleCreateAccount}
          disabled={isSaving || !accountNameField.trim()}
          className="mt-4 w-full rounded-md bg-primary py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-primary-strong disabled:opacity-60"
        >
          {isSaving ? tr.account.submitting : tr.account.submitButton}
        </button>
      </div>
    );
  }

  function renderBudgetStep() {
    const nameId = `${uid}-budget-name`;
    const limitId = `${uid}-budget-limit`;
    if (budgetCreated) {
      return (
        <div>
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="text-[15px] font-extrabold outline-none"
          >
            {tr.budget.consequenceTitle}
          </h3>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
            {tr.budget.consequenceBody}
          </p>
          <button
            type="button"
            onClick={() => setStep("transaction")}
            className="mt-4 w-full rounded-md bg-primary py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-primary-strong"
          >
            {tr.continueButton}
          </button>
        </div>
      );
    }
    const hasExisting = (existingBudgets?.length ?? 0) > 0;
    return (
      <div>
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="text-[15px] font-extrabold outline-none"
        >
          {tr.budget.title}
        </h3>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
          {tr.budget.body}
        </p>
        {hasExisting && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-md bg-secondary p-2.5 text-[12px]">
            <span>{tr.budget.alreadyHaveNotice}</span>
            <button
              type="button"
              onClick={skipBudgetStep}
              className="shrink-0 font-semibold text-primary hover:underline"
            >
              {tr.budget.skipStepButton}
            </button>
          </div>
        )}
        <div className="mt-4 space-y-3">
          <Field label={tr.budget.nameLabel} htmlFor={nameId}>
            <input
              id={nameId}
              value={categoryNameField}
              onChange={(e) => setCategoryNameField(e.target.value)}
              placeholder={tr.budget.namePlaceholder}
              className={fieldClass}
            />
          </Field>
          <Field label={tr.budget.limitLabel} htmlFor={limitId}>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                Rp
              </span>
              <input
                id={limitId}
                inputMode="numeric"
                value={limitField}
                onChange={(e) =>
                  setLimitField(formatAmountInput(e.target.value))
                }
                placeholder="0"
                className={cn(fieldClass, "pl-9")}
              />
            </div>
          </Field>
        </div>
        <button
          type="button"
          onClick={handleCreateBudget}
          disabled={isSaving || !categoryNameField.trim() || !limitField}
          className="mt-4 w-full rounded-md bg-primary py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-primary-strong disabled:opacity-60"
        >
          {isSaving ? tr.budget.submitting : tr.budget.submitButton}
        </button>
      </div>
    );
  }

  function renderTransactionStep() {
    const amountId = `${uid}-tx-amount`;
    const descId = `${uid}-tx-description`;
    if (txConsequence) {
      return (
        <div>
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="text-[15px] font-extrabold outline-none"
          >
            {tr.transaction.consequenceTitle}
          </h3>
          <div className="mt-3 space-y-2 rounded-lg border bg-warning-soft/60 p-3.5 text-[13px]">
            <div className="font-bold">
              {tr.transaction.consequenceNetWorthPrefix}
              {formatRupiah(txConsequence.netWorthAfter)}
            </div>
            <div className="font-bold">
              {tr.transaction.consequenceBudgetPrefix}
              {txConsequence.usagePercent}%
              {tr.transaction.consequenceBudgetSuffix}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStep("done")}
            className="mt-4 w-full rounded-md bg-primary py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-primary-strong"
          >
            {tr.continueButton}
          </button>
        </div>
      );
    }
    return (
      <div>
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="text-[15px] font-extrabold outline-none"
        >
          {tr.transaction.title}
        </h3>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
          {tr.transaction.body}
        </p>
        <div className="mt-4 space-y-3">
          <Field label={tr.transaction.amountLabel} htmlFor={amountId}>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                Rp
              </span>
              <input
                id={amountId}
                inputMode="numeric"
                value={amountField}
                onChange={(e) =>
                  setAmountField(formatAmountInput(e.target.value))
                }
                placeholder="0"
                className={cn(fieldClass, "pl-9")}
              />
            </div>
          </Field>
          <Field label={tr.transaction.descriptionLabel} htmlFor={descId}>
            <input
              id={descId}
              value={descriptionField}
              onChange={(e) => setDescriptionField(e.target.value)}
              placeholder={tr.transaction.descriptionPlaceholder}
              className={fieldClass}
            />
          </Field>
        </div>
        <button
          type="button"
          onClick={handleCreateTransaction}
          disabled={isSaving || !amountField}
          className="mt-4 w-full rounded-md bg-primary py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-primary-strong disabled:opacity-60"
        >
          {isSaving ? tr.transaction.submitting : tr.transaction.submitButton}
        </button>
      </div>
    );
  }

  function renderDoneStep() {
    return (
      <div>
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="text-[15px] font-extrabold outline-none"
        >
          {tr.done.title}
        </h3>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
          {txHeld ? tr.done.bodyHeld : tr.done.body}
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => router.push("/rekening")}
            className="rounded-md border py-2.5 text-[12.5px] font-semibold transition-colors hover:bg-accent"
          >
            {tr.done.viewAccountsButton}
          </button>
          <button
            type="button"
            onClick={() => router.push("/anggaran")}
            className="rounded-md border py-2.5 text-[12.5px] font-semibold transition-colors hover:bg-accent"
          >
            {tr.done.viewBudgetsButton}
          </button>
          <button
            type="button"
            onClick={() => router.push("/transaksi")}
            className="rounded-md border py-2.5 text-[12.5px] font-semibold transition-colors hover:bg-accent"
          >
            {tr.done.viewTransactionsButton}
          </button>
        </div>
        <button
          type="button"
          onClick={finish}
          className="mt-4 w-full rounded-md bg-primary py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-primary-strong"
        >
          {tr.done.finishButton}
        </button>
      </div>
    );
  }

  const STEP_ICON = {
    account: Wallet,
    budget: ClipboardList,
    transaction: Receipt,
    done: PartyPopper,
  } as const;
  const StepIcon = STEP_ICON[step];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] w-full max-w-[440px] gap-0 overflow-y-auto p-0 sm:max-w-[440px]">
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-accent text-primary">
                <StepIcon className="size-4" />
              </div>
              <DialogTitle className="text-[15px] font-extrabold">
                {tr.dialogTitle}
              </DialogTitle>
            </div>
            <button
              type="button"
              onClick={skipAll}
              aria-label={tr.closeAriaLabel}
              className="text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              {tr.skipSetupButton}
            </button>
          </div>

          {step !== "done" && (
            <div className="mb-4 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <span>
                {tr.stepIndicatorPrefix}
                {stepIndex}
                {tr.stepIndicatorMiddle}
                {STEP_ORDER.length}
              </span>
              <span aria-hidden="true">·</span>
              <span>{tr.stepLabels[step]}</span>
            </div>
          )}

          {step === "account" && renderAccountStep()}
          {step === "budget" && renderBudgetStep()}
          {step === "transaction" && renderTransactionStep()}
          {step === "done" && renderDoneStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
