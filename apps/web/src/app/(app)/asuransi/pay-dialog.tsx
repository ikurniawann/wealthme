"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { apiFetch } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/api-error";
import { queryKeys } from "@/lib/query-keys";

import {
  fillCopy,
  formatDay,
  isPayable,
  jakartaToday,
  localizeDates,
  needsDueConfirmation,
  nextDue,
} from "./asuransi-model";

import type {
  AccountDto,
  InsuranceDto,
  InsurancePayResultDto,
} from "@wealthme/contracts";

const MAX_AMOUNT_DIGITS = 15;

/** Jakarta wall-clock time as HH:MM. */
function jakartaNowTime(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
}

/** One key per opened dialog + policy: a retry or double click replays it. */
function newIdempotencyKey(): string {
  return `pay-${crypto.randomUUID()}`;
}

function groupDigits(digits: string): string {
  return digits ? BigInt(digits).toLocaleString("id-ID") : "";
}

type Props = {
  familyGroupId: string;
  token: string | undefined;
  policies: InsuranceDto[];
  accounts: AccountDto[];
  initialPolicyId: string | null;
  onClose: () => void;
};

/**
 * Catat pembayaran premi — POST …/insurances/:id/pay with an idempotency key
 * generated once for this dialog (S7): a double click, a retry after a lost
 * response or a second submit replays the original payment instead of
 * debiting twice. The API refuses a second payment for the same due (409)
 * and a due more than one period ahead; its Indonesian message is shown with
 * dates localized.
 */
export function PayDialog({
  familyGroupId,
  token,
  policies,
  accounts,
  initialPolicyId,
  onClose,
}: Props) {
  const { t, locale } = useLocale();
  const c = t.asuransi.v3;
  const money = useMoney();
  const queryClient = useQueryClient();
  const payable = policies.filter(isPayable);
  const usableAccounts = accounts.filter((a) => a.status !== "closed");
  const today = jakartaToday();

  const initial = payable.find((p) => p.id === initialPolicyId) ?? null;
  const [policyId, setPolicyId] = useState(initial?.id ?? "");
  const [accountId, setAccountId] = useState(initial?.paymentAccountId ?? "");
  const [amount, setAmount] = useState(
    initial ? initial.premiumAmount.split(".")[0]! : "",
  );
  const [date, setDate] = useState(today);
  const [time, setTime] = useState(jakartaNowTime);
  const [key, setKey] = useState(newIdempotencyKey);
  const [error, setError] = useState<string | null>(null);
  const policy = payable.find((p) => p.id === policyId) ?? null;
  const due = policy ? nextDue(policy) : null;
  // A legacy due that looks like a coverage end is not shown as a premium
  // due (the API still refuses paying a due that far ahead).
  const dueUnconfirmed = policy ? needsDueConfirmation(policy) : false;

  function pickPolicy(id: string) {
    const p = payable.find((x) => x.id === id) ?? null;
    setPolicyId(id);
    setAmount(p ? p.premiumAmount.split(".")[0]! : "");
    if (p?.paymentAccountId) setAccountId(p.paymentAccountId);
    setKey(newIdempotencyKey());
    setError(null);
  }

  const pay = useMutation({
    mutationFn: () =>
      apiFetch<InsurancePayResultDto>(
        `/family-groups/${familyGroupId}/insurances/${policyId}/pay`,
        {
          method: "POST",
          token,
          body: JSON.stringify({
            sourceAccountId: accountId,
            amount,
            idempotencyKey: key,
            ...(due && { dueDate: due }),
            paidDate: date,
            ...(time && { paidTime: time }),
          }),
        },
      ),
    onSuccess: (res) => {
      for (const k of [
        queryKeys.insurances.all(familyGroupId),
        queryKeys.budgets.all(familyGroupId),
        queryKeys.accounts.all(familyGroupId),
        queryKeys.dashboard.summary(familyGroupId),
        queryKeys.netWorth.summary(familyGroupId),
        queryKeys.transactions.all(familyGroupId),
        ["reports", familyGroupId],
      ]) {
        void queryClient.invalidateQueries({ queryKey: k });
      }
      const next = res.nextPremiumDueDate;
      toast.success(
        res.replayed
          ? c.payReplayed
          : next
            ? fillCopy(c.payDone, { date: formatDay(next, locale, "long") })
            : c.payDoneNoNext,
      );
      onClose();
    },
    onError: (err) =>
      setError(localizeDates(apiErrorMessage(err, c.payFailed), locale)),
  });

  function submit() {
    if (pay.isPending) return;
    setError(null);
    if (!accountId) return setError(c.payErrAccount);
    if (!amount || BigInt(amount) <= BigInt(0)) return setError(c.payErrAmount);
    if (date > today) return setError(c.payErrDate);
    if (date === today && time && time > jakartaNowTime()) {
      return setError(c.payErrTime);
    }
    pay.mutate();
  }

  const noAccounts = usableAccounts.length === 0;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="ins3-pay-dialog">
        <DialogTitle>{c.payTitle}</DialogTitle>
        <DialogDescription>{c.payDesc}</DialogDescription>
        <form
          id="ins3-pay-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogBody className="ins3-form">
            {error && (
              <p
                className="error-text ins3-pay-error mt-0 mb-3"
                role="alert"
                ref={(el) => el?.scrollIntoView({ block: "nearest" })}
              >
                {error}
              </p>
            )}
            {payable.length === 0 ? (
              <p className="ins3-state">{c.payNoPolicies}</p>
            ) : (
              <>
                <div className="field mt-0">
                  <label className="label" htmlFor="ins3-pay-policy">
                    {c.payPolicy}
                  </label>
                  <select
                    id="ins3-pay-policy"
                    className="select"
                    value={policyId}
                    onChange={(e) => pickPolicy(e.target.value)}
                  >
                    <option value="">{c.payPolicyPh}</option>
                    {payable.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                {policy && (
                  <p className="ins3-pay-due">
                    <span>{c.payDue}</span>
                    <strong>
                      {dueUnconfirmed
                        ? c.dueConfirm
                        : due
                          ? formatDay(due, locale, "long")
                          : c.payDueNone}
                    </strong>
                  </p>
                )}
                {noAccounts ? (
                  <p className="ins3-state">
                    {c.payNoAccounts}{" "}
                    <Link href="/rekening" className="ins3-link">
                      {c.payNoAccountsLink}
                    </Link>
                  </p>
                ) : (
                  <div className="field">
                    <label className="label" htmlFor="ins3-pay-account">
                      {c.payAccount}
                    </label>
                    <select
                      id="ins3-pay-account"
                      className="select"
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                    >
                      <option value="">{c.payAccountPh}</option>
                      {usableAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                          {a.institution ? ` · ${a.institution}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="field">
                  <label className="label" htmlFor="ins3-pay-amount">
                    {c.payAmount}
                  </label>
                  <input
                    id="ins3-pay-amount"
                    className="input mono ins3-amount-input"
                    inputMode="numeric"
                    autoComplete="off"
                    enterKeyHint="done"
                    value={groupDigits(amount)}
                    onChange={(e) =>
                      setAmount(
                        e.target.value
                          .replace(/\D/g, "")
                          .replace(/^0+(?=\d)/, "")
                          .slice(0, MAX_AMOUNT_DIGITS),
                      )
                    }
                  />
                  {policy && (
                    <p className="hint">
                      {fillCopy(c.payAmountHint, {
                        amount: money.format(Number(policy.premiumAmount)),
                        period:
                          t.asuransi.periodSuffixLabels[policy.premiumPeriod] ??
                          "",
                      })}
                      {policy.currency !== "IDR" &&
                        ` ${fillCopy(c.payCurrencyNote, { cur: policy.currency })}`}
                    </p>
                  )}
                </div>
                <div className="ins3-pay-when">
                  <div className="field">
                    <label className="label" htmlFor="ins3-pay-date">
                      {c.payDate}
                    </label>
                    <input
                      id="ins3-pay-date"
                      className="input"
                      type="date"
                      max={today}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label className="label" htmlFor="ins3-pay-time">
                      {c.payTime}
                    </label>
                    <input
                      id="ins3-pay-time"
                      className="input"
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}
          </DialogBody>
        </form>
        <DialogFooter>
          <button type="button" className="btn btn--outline" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button
            type="submit"
            form="ins3-pay-form"
            className="btn btn--primary"
            disabled={pay.isPending || !policy || noAccounts}
          >
            {pay.isPending ? c.paySaving : c.paySubmit}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
