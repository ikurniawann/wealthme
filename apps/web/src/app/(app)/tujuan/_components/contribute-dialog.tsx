"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogTitle,
  PanelContent,
} from "@/components/ui/dialog";
import { DateField, PillButton } from "@/components/wm";
import { useApiError } from "@/hooks/use-api-error";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";

import { queryKeys } from "@/lib/query-keys";
import {
  MoneyInput,
  useMoneyField,
  moneyDigits,
  withFxInputs,
} from "@/components/money";

import type {
  CreateGoalContributionInput,
  GoalContributionResult,
  GoalDto,
} from "@wealthme/contracts";

export type SourceAccountOption = {
  id: string;
  name: string;
  institution: string | null;
};

function todayLocalIsoDate(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

interface ContributeDialogProps {
  goal: GoalDto;
  accounts: SourceAccountOption[];
  familyGroupId: string;
  token: string;
  onClose: () => void;
}

export function ContributeDialog({
  goal,
  accounts,
  familyGroupId,
  token,
  onClose,
}: ContributeDialogProps) {
  const { t, locale } = useLocale();
  const { handleError } = useApiError();
  const queryClient = useQueryClient();
  const amountField = useMoneyField();
  const [accountId, setAccountId] = useState(goal.sourceAccountId ?? "");
  const [date, setDate] = useState(todayLocalIsoDate);

  const digits = moneyDigits(amountField);
  // Mirrors CreateGoalContributionInputSchema.amount (@wealthme/contracts):
  // 1-12 digits, no leading zero — reject an over-long amount client-side
  // instead of round-tripping to a 400.
  const canSubmit =
    /^[1-9]\d{0,11}$/.test(digits) &&
    date !== "" &&
    !amountField.resolved.isPending;

  const mutation = useMutation({
    mutationFn: (input: CreateGoalContributionInput) =>
      apiFetch<GoalContributionResult>(
        `/family-groups/${familyGroupId}/goals/${goal.id}/contributions`,
        { token, method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: () => {
      toast.success(t.tujuan.contributeToastSuccess);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.goals.all(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.accounts.all(familyGroupId),
      });
      onClose();
    },
    onError: handleError,
  });

  function handleSubmit() {
    if (!canSubmit || mutation.isPending) return;
    mutation.mutate(
      withFxInputs(
        {
          amount: digits,
          ...(accountId ? { accountId } : {}),
          // Local midnight, so picking "today" is never later than the server's now.
          occurredAt: new Date(`${date}T00:00:00`).toISOString(),
        },
        [["amount", amountField]],
      ),
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <PanelContent variant="side" className="wm-form-panel">
        <header className="wm-panel-head">
          <div className="min-w-0">
            <DialogTitle className="wm-panel-title">{`${t.tujuan.contributeDialogTitlePrefix}${goal.name}`}</DialogTitle>
            <DialogDescription className="wm-panel-desc">
              {t.tujuan.contributeDialogDesc}
            </DialogDescription>
          </div>
          <DialogClose className="wm-panel-x" aria-label={t.common.close}>
            <X aria-hidden="true" />
          </DialogClose>
        </header>
        {/* Revisi F final-review Finding 4 — honest, minimal scope notice:
            a Setor has no destination account, so it is never counted in
            net worth. Plain copy, no invented feature. */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="wm-panel-body wm-form">
            <p className="hint">{t.tujuan.contributeNetWorthNotice}</p>
            <div className="wm-form__grid">
              <div className="field">
                <label className="label" htmlFor="goal-contribute-amount">
                  {t.tujuan.contributeAmountLabel}
                </label>
                <MoneyInput field={amountField} id="goal-contribute-amount" />
              </div>
              <div className="field">
                <label className="label" htmlFor="goal-contribute-account">
                  {t.tujuan.contributeAccountLabel}
                </label>
                <select
                  id="goal-contribute-account"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="select"
                >
                  <option value="">{t.tujuan.contributeNoAccountOption}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.institution ? ` (${a.institution})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="label" htmlFor="goal-contribute-date">
                  {t.tujuan.contributeDateLabel}
                </label>
                <DateField
                  id="goal-contribute-date"
                  value={date}
                  locale={locale}
                  label={t.tujuan.contributeDateLabel}
                  max={todayLocalIsoDate()}
                  required
                  onChange={setDate}
                />
              </div>
            </div>
          </div>
          <div className="wm-panel-foot">
            <PillButton type="button" onClick={onClose}>
              {t.common.cancel}
            </PillButton>
            <PillButton
              type="button"
              variant="primary"
              disabled={!canSubmit || mutation.isPending}
              onClick={handleSubmit}
            >
              {mutation.isPending
                ? t.tujuan.contributeSubmitting
                : t.tujuan.contributeSubmit}
            </PillButton>
          </div>
        </div>
      </PanelContent>
    </Dialog>
  );
}
