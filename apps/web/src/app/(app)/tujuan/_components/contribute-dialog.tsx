"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateField } from "@/components/wm";
import { useApiError } from "@/hooks/use-api-error";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { formatAmountInput } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

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
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(goal.sourceAccountId ?? "");
  const [date, setDate] = useState(todayLocalIsoDate);

  const digits = amount.replace(/\D/g, "");
  // Mirrors CreateGoalContributionInputSchema.amount (@wealthme/contracts):
  // 1-12 digits, no leading zero — reject an over-long amount client-side
  // instead of round-tripping to a 400.
  const canSubmit = /^[1-9]\d{0,11}$/.test(digits) && date !== "";

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
    mutation.mutate({
      amount: digits,
      ...(accountId ? { accountId } : {}),
      // Local midnight, so picking "today" is never later than the server's now.
      occurredAt: new Date(`${date}T00:00:00`).toISOString(),
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>{`${t.tujuan.contributeDialogTitlePrefix}${goal.name}`}</DialogTitle>
        <DialogDescription>{t.tujuan.contributeDialogDesc}</DialogDescription>
        {/* Revisi F final-review Finding 4 — honest, minimal scope notice:
            a Setor has no destination account, so it is never counted in
            net worth. Plain copy, no invented feature. */}
        <p className="hint">{t.tujuan.contributeNetWorthNotice}</p>
        <DialogBody>
          <div className="field">
            <label className="label" htmlFor="goal-contribute-amount">
              {t.tujuan.contributeAmountLabel}
            </label>
            <input
              id="goal-contribute-amount"
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(formatAmountInput(e.target.value))}
              className="input mono"
            />
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
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            type="button"
            disabled={!canSubmit || mutation.isPending}
            onClick={handleSubmit}
          >
            {mutation.isPending
              ? t.tujuan.contributeSubmitting
              : t.tujuan.contributeSubmit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
