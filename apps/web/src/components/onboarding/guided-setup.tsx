"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { Wallet, ClipboardList, Receipt, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import type { AccountDto, BudgetDto, BudgetPeriod } from "@wealthme/contracts";
import { useSession } from "@/lib/auth-compat";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { parseRupiah } from "@/lib/format";
import { useMoney } from "@/hooks/use-money";
import { queryKeys } from "@/lib/query-keys";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  MoneyInput,
  moneyIdr,
  useMoneyField,
  withFxInputs,
} from "@/components/money";
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

// EPIC-023 Task H fix round (CRITICAL 1) — this wizard writes real rows
// through the real endpoints, but the pages underneath (Beranda, Rekening,
// Anggaran, Transaksi) are TanStack Query consumers with a 60s staleTime
// (AppQueryClientProvider). Without invalidating their caches, a user who
// closes the wizard inside that window sees the SAME stale zero they
// started with — the wizard's entire premise ("watch it appear") would be
// false on the real screens. Mirrors the broad invalidation set already
// used by components/shell/transaction-dialog.tsx and
// app/(app)/anggaran/page.tsx's obligation-pay mutation.
function invalidateOnboardingQueries(
  queryClient: QueryClient,
  familyGroupId: string,
): void {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.accounts.all(familyGroupId),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.categories.all(familyGroupId),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.budgets.all(familyGroupId),
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
}

export function GuidedSetup({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const money = useMoney();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.userId ?? "";
  const familyGroupId = session?.familyGroupId ?? "";
  const token = session?.accessToken;
  const tr = t.onboarding;
  const uid = useId();
  const stepIndicatorId = `${uid}-step-indicator`;
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
  const balanceMoney = useMoneyField();
  const [categoryNameField, setCategoryNameField] = useState("");
  const limitMoney = useMoneyField();
  const [period] = useState<BudgetPeriod>("monthly");
  const txMoney = useMoneyField();
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
  //
  // EPIC-023 Task H fix round (MEDIUM 7) — the saved accountId/budgetId are
  // cross-checked against what the family group actually has BEFORE being
  // restored into state: another member may have deleted the row between
  // sessions. A dangling id would resume the wizard on a step whose final
  // POST fails server-side forever. If the account itself is gone, restart
  // from "account" (nothing downstream is trustworthy). If only the budget
  // is gone, keep the still-valid account and drop back to "budget".
  useEffect(() => {
    if (!open || !userId || !familyGroupId || !token) return;
    let cancelled = false;
    const saved = getSetupProgress(userId);

    void Promise.all([
      apiFetch<AccountDto[]>(`/family-groups/${familyGroupId}/accounts`, {
        token,
      }).catch(() => [] as AccountDto[]),
      apiFetch<BudgetDto[]>(`/family-groups/${familyGroupId}/budgets`, {
        token,
      }).catch(() => [] as BudgetDto[]),
    ]).then(([accounts, budgets]) => {
      if (cancelled) return;
      // Restoring saved progress once the accounts/budgets fetch resolves —
      // an async `.then()` callback, not a synchronous effect body, so
      // react-hooks/set-state-in-effect does not apply here.
      setExistingAccounts(accounts.map((r) => ({ id: r.id, name: r.name })));
      setExistingBudgets(
        budgets.map((r) => ({
          id: r.id,
          categoryId: r.categoryId,
          categoryName: r.categoryName,
          limitAmount: r.limitAmount,
        })),
      );

      if (!saved || saved.step === "done") {
        setStep("account");
        return;
      }

      const accountStillExists =
        !saved.accountId || accounts.some((a) => a.id === saved.accountId);
      if (!accountStillExists) {
        clearSetupProgress(userId);
        setStep("account");
        setAccountId("");
        setAccountName("");
        setCategoryId("");
        setCategoryName("");
        setBudgetId("");
        setLimitAmount(0);
        return;
      }

      const budgetStillExists =
        !saved.budgetId || budgets.some((b) => b.id === saved.budgetId);
      if (saved.step !== "account" && !budgetStillExists) {
        setSetupProgress(userId, {
          step: "budget",
          accountId: saved.accountId,
          accountName: saved.accountName,
        });
        setStep("budget");
        setAccountId(saved.accountId ?? "");
        setAccountName(saved.accountName ?? "");
        setCategoryId("");
        setCategoryName("");
        setBudgetId("");
        setLimitAmount(0);
        return;
      }

      setStep(saved.step);
      setAccountId(saved.accountId ?? "");
      setAccountName(saved.accountName ?? "");
      setCategoryId(saved.categoryId ?? "");
      setCategoryName(saved.categoryName ?? "");
      setBudgetId(saved.budgetId ?? "");
      setLimitAmount(saved.limitAmount ?? 0);
    });
    return () => {
      cancelled = true;
    };
  }, [open, userId, familyGroupId, token]);

  // Move focus onto the new step's heading so keyboard/screen-reader users
  // land on the fresh content instead of a stale target — label/focus
  // association has been a repeat HIGH across this epic (H1, E, F).
  //
  // EPIC-023 Task H fix round (CRITICAL 2) — the account/budget/transaction
  // "consequence" panels swap in WITHOUT a `step` change (accountConsequence
  // / budgetCreated / txConsequence / txHeld flip while `step` stays put),
  // so this effect must also re-run on those flags or focus never moves off
  // the (now-disabled, blurred-to-body) submit button at the exact moment
  // the payoff appears.
  useEffect(() => {
    if (open) headingRef.current?.focus();
  }, [open, step, accountConsequence, budgetCreated, txConsequence, txHeld]);

  // EPIC-023 Task H fix round (HIGH 6) — restore focus to whatever was
  // focused before this dialog opened, same precedent as the activeElement
  // capture/restore in app/(app)/asuransi/page.tsx's modal. Effect keyed on
  // `open` (not mount) because Walkthrough renders <GuidedSetup> once for
  // its whole lifetime and only toggles the `open` prop — a mount-only
  // effect would capture the wrong moment. When the opener button lived in
  // an already-unmounted dialog (the welcome/resume prompt), the browser
  // has nothing meaningful to hand back and focus falls through to
  // <body> — no worse than today, but every case where the opener is still
  // in the DOM (e.g. Akun's "Mulai Tur" button) is now handled correctly.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    return () => {
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  // EPIC-023 Task H fix round (MEDIUM 8) — if the user already created a
  // real account or budget before skipping, say so before closing: this is
  // the only moment that tells them their rows were kept, since
  // clearSetupProgress() means the "resume?" prompt will never fire again.
  function skipAll() {
    const kept: string[] = [];
    if (accountId) kept.push(tr.stepLabels.account);
    if (budgetId) kept.push(tr.stepLabels.budget);
    if (kept.length > 0) {
      toast.success(tr.skipAllKeptPrefix + kept.join(", "));
    }
    setOnboarded(userId);
    clearSetupProgress(userId);
    onClose();
  }

  function finish() {
    setOnboarded(userId);
    clearSetupProgress(userId);
    onClose();
  }

  // EPIC-023 Task H fix round (MEDIUM 9) — the done step's "View X" buttons
  // navigate but never called onClose(); since GuidedSetup lives inside the
  // persistent AppShell, the route changed underneath a dialog that stayed
  // open, blocking the very page meant to prove the write was real.
  function finishAndGoTo(path: string) {
    finish();
    router.push(path);
  }

  async function handleCreateAccount() {
    const trimmed = accountNameField.trim();
    if (!trimmed || !familyGroupId) return;
    if (balanceMoney.resolved.isPending) return;
    const balanceNum = moneyIdr(balanceMoney, parseRupiah);
    setIsSaving(true);
    try {
      const before = await fetchNetWorth(familyGroupId, token);
      const account = await apiFetch<AccountDto>(
        `/family-groups/${familyGroupId}/accounts`,
        {
          token,
          method: "POST",
          body: JSON.stringify(
            withFxInputs(
              {
                type: "bank",
                name: trimmed,
                balance: balanceNum,
                isPrivate: false,
              },
              [["balance", balanceMoney]],
            ),
          ),
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
      invalidateOnboardingQueries(queryClient, familyGroupId);
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
    if (limitMoney.resolved.isPending) return;
    const limitNum = moneyIdr(limitMoney, parseRupiah);
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
          body: JSON.stringify(
            withFxInputs(
              { categoryId: newCategoryId, period, limitAmount: limitNum },
              [["limitAmount", limitMoney]],
            ),
          ),
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
      invalidateOnboardingQueries(queryClient, familyGroupId);
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
    const amountNum = moneyIdr(txMoney, parseRupiah);
    if (!amountNum || amountNum <= 0) return;
    if (!accountId) {
      toast.error(tr.transaction.noAccountError);
      return;
    }
    if (txMoney.resolved.isPending) return;
    setIsSaving(true);
    try {
      const result = await apiFetch<{ held?: true } & Record<string, unknown>>(
        `/family-groups/${familyGroupId}/transactions`,
        {
          token,
          method: "POST",
          body: JSON.stringify(
            withFxInputs(
              {
                accountId,
                ...(categoryId ? { categoryId } : {}),
                amount: amountNum,
                type: "expense",
                ...(descriptionField ? { description: descriptionField } : {}),
                occurredAt: new Date().toISOString(),
              },
              [["amount", txMoney]],
            ),
          ),
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
        // A held expense creates a real AllowanceRequest, not a Transaction
        // (transactions.service.ts) — invalidate that list too so it shows
        // up on /rekening the moment this wizard closes (see HIGH 3).
        void queryClient.invalidateQueries({
          queryKey: queryKeys.allowanceRequests.all(familyGroupId),
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
      invalidateOnboardingQueries(queryClient, familyGroupId);
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
    const nameHintId = `${uid}-account-name-hint`;
    const balanceId = `${uid}-account-balance`;
    if (accountConsequence) {
      return (
        <div>
          <h3
            ref={headingRef}
            tabIndex={-1}
            aria-describedby={stepIndicatorId}
            className="text-[15px] font-extrabold outline-none"
          >
            {tr.account.consequenceTitle}
          </h3>
          <div
            role="status"
            aria-live="polite"
            className="mt-3 rounded-lg border bg-success-soft/60 p-3.5 text-[13px]"
          >
            <div className="text-muted-foreground">
              {tr.account.consequenceBefore}
              {money.format(accountConsequence.before)}
            </div>
            {/* EPIC-023 Task H fix round (HIGH 5) — `text-success` on
                `bg-success-soft/60` computed to ~2.3:1, under the 4.5:1 AA
                minimum for this text. `text-emerald-700 dark:text-emerald-300`
                is the pairing this codebase already uses for readable text
                on the same soft background (transaction-dialog.tsx,
                rekonsiliasi/page.tsx) — reused here rather than inventing a
                new colour. */}
            <div className="mt-1 text-[17px] font-extrabold text-emerald-700 dark:text-emerald-300">
              {tr.account.consequenceAfter}
              {money.format(accountConsequence.after)}
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
          aria-describedby={stepIndicatorId}
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
              className="input"
              aria-describedby={nameHintId}
            />
            {/* EPIC-023 Task H fix round (MEDIUM 12) — the submit button
                below is disabled while this field is empty, and disabled
                controls drop out of the tab order; the reason has to be
                discoverable from the field a keyboard/AT user CAN still
                reach, not from the unreachable button. */}
            <p
              id={nameHintId}
              className="mt-1 text-[11px] text-muted-foreground"
            >
              {tr.account.nameRequiredHint}
            </p>
          </Field>
          <Field label={tr.account.balanceLabel} htmlFor={balanceId}>
            <MoneyInput field={balanceMoney} id={balanceId} />
          </Field>
        </div>
        <button
          type="button"
          onClick={handleCreateAccount}
          disabled={
            isSaving ||
            !accountNameField.trim() ||
            balanceMoney.resolved.isPending
          }
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
    const budgetHintId = `${uid}-budget-required-hint`;
    if (budgetCreated) {
      return (
        <div>
          <h3
            ref={headingRef}
            tabIndex={-1}
            aria-describedby={stepIndicatorId}
            className="text-[15px] font-extrabold outline-none"
          >
            {tr.budget.consequenceTitle}
          </h3>
          <p
            role="status"
            aria-live="polite"
            className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground"
          >
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
          aria-describedby={stepIndicatorId}
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
              className="input"
              aria-describedby={budgetHintId}
            />
          </Field>
          <Field label={tr.budget.limitLabel} htmlFor={limitId}>
            <MoneyInput field={limitMoney} id={limitId} />
          </Field>
          {/* EPIC-023 Task H fix round (MEDIUM 12) — see the account step's
              equivalent hint comment: the submit button becomes unreachable
              once disabled, so the reason lives on the fields instead. */}
          <p id={budgetHintId} className="text-[11px] text-muted-foreground">
            {tr.budget.requiredHint}
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreateBudget}
          disabled={
            isSaving ||
            !categoryNameField.trim() ||
            !limitMoney.raw ||
            limitMoney.resolved.isPending
          }
          className="mt-4 w-full rounded-md bg-primary py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-primary-strong disabled:opacity-60"
        >
          {isSaving ? tr.budget.submitting : tr.budget.submitButton}
        </button>
      </div>
    );
  }

  function renderTransactionStep() {
    const amountId = `${uid}-tx-amount`;
    const amountHintId = `${uid}-tx-amount-hint`;
    const descId = `${uid}-tx-description`;
    if (txConsequence) {
      return (
        <div>
          <h3
            ref={headingRef}
            tabIndex={-1}
            aria-describedby={stepIndicatorId}
            className="text-[15px] font-extrabold outline-none"
          >
            {tr.transaction.consequenceTitle}
          </h3>
          <div
            role="status"
            aria-live="polite"
            className="mt-3 space-y-2 rounded-lg border bg-warning-soft/60 p-3.5 text-[13px]"
          >
            <div className="font-bold">
              {tr.transaction.consequenceNetWorthPrefix}
              {money.format(txConsequence.netWorthAfter)}
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
          aria-describedby={stepIndicatorId}
          className="text-[15px] font-extrabold outline-none"
        >
          {tr.transaction.title}
        </h3>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
          {tr.transaction.body}
        </p>
        <div className="mt-4 space-y-3">
          <Field label={tr.transaction.amountLabel} htmlFor={amountId}>
            <MoneyInput field={txMoney} id={amountId} />
            {/* EPIC-023 Task H fix round (MEDIUM 12) — same reasoning as the
                account/budget hints above. */}
            <p
              id={amountHintId}
              className="mt-1 text-[11px] text-muted-foreground"
            >
              {tr.transaction.amountRequiredHint}
            </p>
          </Field>
          <Field label={tr.transaction.descriptionLabel} htmlFor={descId}>
            <input
              id={descId}
              value={descriptionField}
              onChange={(e) => setDescriptionField(e.target.value)}
              placeholder={tr.transaction.descriptionPlaceholder}
              className="input"
            />
          </Field>
        </div>
        <button
          type="button"
          onClick={handleCreateTransaction}
          // EPIC-023 Task H fix round (LOW 16) — typing "0" left this
          // enabled while handleCreateTransaction silently no-ops on
          // amountNum <= 0; the account/budget steps already disable on the
          // equivalent falsy case, this now matches them.
          disabled={
            isSaving ||
            !txMoney.raw ||
            moneyIdr(txMoney, parseRupiah) <= 0 ||
            txMoney.resolved.isPending
          }
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
        <p
          role="status"
          aria-live="polite"
          className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground"
        >
          {txHeld ? tr.done.bodyHeld : tr.done.body}
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => finishAndGoTo("/rekening")}
            className="rounded-md border py-2.5 text-[12.5px] font-semibold transition-colors hover:bg-accent"
          >
            {tr.done.viewAccountsButton}
          </button>
          <button
            type="button"
            onClick={() => finishAndGoTo("/anggaran")}
            className="rounded-md border py-2.5 text-[12.5px] font-semibold transition-colors hover:bg-accent"
          >
            {tr.done.viewBudgetsButton}
          </button>
          {/* EPIC-023 Task H fix round (HIGH 3) — a held over-threshold
              expense is captured as an AllowanceRequest, never a
              Transaction (transactions.service.ts), and /transaksi has no
              allowance-request query at all — the item can never appear
              there. Only offer this button for the honest (non-held)
              outcome; the held outcome already points at /rekening above,
              where the pending request actually shows. */}
          {!txHeld && (
            <button
              type="button"
              onClick={() => finishAndGoTo("/transaksi")}
              className="rounded-md border py-2.5 text-[12.5px] font-semibold transition-colors hover:bg-accent"
            >
              {tr.done.viewTransactionsButton}
            </button>
          )}
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
      {/* EPIC-023 Task H fix round (MEDIUM 14) — a bare `max-w-[440px]`
          lets tailwind-merge fully replace the dialog base's
          `max-w-[calc(100%-2rem)]` side gutter (this epic already fixed
          exactly this once, I2); `min(440px,calc(100%-2rem))` keeps the
          gutter on narrow screens while preserving the intended width
          above ~504px. */}
      <DialogContent className="p-0 min-[769px]:w-[min(440px,calc(100%-2rem))]">
        <div className="p-6">
          {/* pr-10 clears the Dialog's own absolute top-3 right-3 close
              button (30px wide) so "Lewati Setup" never sits under it on
              narrow screens. */}
          <div className="mb-4 flex items-center justify-between gap-2 pr-10">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-accent text-primary">
                <StepIcon aria-hidden="true" className="size-4" />
              </div>
              <DialogTitle className="text-[15px] font-extrabold">
                {tr.dialogTitle}
              </DialogTitle>
            </div>
            {/* EPIC-023 Task H fix round (HIGH 4) — `aria-label` previously
                overrode the visible "Lewati Setup" text with "Tutup setup",
                an accessible name sharing no words with what's on screen
                (WCAG 2.5.3) and describing a different action (close vs.
                skip). The visible text is already an accurate, sufficient
                accessible name — no override needed. */}
            <button
              type="button"
              onClick={skipAll}
              className="text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              {tr.skipSetupButton}
            </button>
          </div>

          {step !== "done" && (
            // EPIC-023 Task H fix round (LOW 16) — `tabIndex={-1}` focus on
            // the step heading doesn't carry this sibling's text with it;
            // `aria-describedby` on each heading (above) folds "Langkah X
            // dari Y · <label>" into what's announced when focus lands.
            <div
              id={stepIndicatorId}
              className="mb-4 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"
            >
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
