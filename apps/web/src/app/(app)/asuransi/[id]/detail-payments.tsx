"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/crud";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/api-error";
import { queryKeys } from "@/lib/query-keys";

import {
  fillCopy,
  formatDay,
  formatNative,
  isPayable,
  localizeDates,
} from "../asuransi-model";
import { projectedDues } from "./detail-model";

import type {
  InsuranceDto,
  InsurancePaymentDto,
  InsurancePayResultDto,
} from "@wealthme/contracts";

type Props = {
  familyGroupId: string;
  token: string | undefined;
  policy: InsuranceDto;
  payments: InsurancePaymentDto[];
  isLoading: boolean;
  isError: boolean;
  accountName: (id: string | null) => string | null;
  onPay: () => void;
};

/**
 * Premi & pembayaran — the schedule (scheduled ≠ paid ≠ projected) and the
 * payment history. "Batalkan pembayaran" voids one payment through the API:
 * the account is refunded, the expense transaction removed and the next
 * premium due reverted, atomically and audited.
 */
export function PaymentsTab({
  familyGroupId,
  token,
  policy: p,
  payments,
  isLoading,
  isError,
  accountName,
  onPay,
}: Props) {
  const { t, locale } = useLocale();
  const c = t.asuransi.v3.detail;
  const v3 = t.asuransi.v3;
  const queryClient = useQueryClient();
  const [voiding, setVoiding] = useState<InsurancePaymentDto | null>(null);
  const projected = projectedDues(p, 3);

  const voidPayment = useMutation({
    mutationFn: (paymentId: string) =>
      apiFetch<InsurancePayResultDto>(
        `/family-groups/${familyGroupId}/insurances/${p.id}/payments/${paymentId}/void`,
        {
          method: "POST",
          token,
          body: JSON.stringify({}),
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
      toast.success(
        res.nextPremiumDueDate
          ? fillCopy(c.voidDone, {
              date: formatDay(res.nextPremiumDueDate, locale, "long"),
            })
          : c.voidDoneNoDue,
      );
    },
    onError: (err) =>
      toast.error(localizeDates(apiErrorMessage(err, c.voidFailed), locale)),
    onSettled: () => setVoiding(null),
  });

  const dueTone = p.premiumDueStatus === "overdue" ? "bad" : "sky";
  return (
    <div className="ins3d-stack">
      <section className="ins3-card" aria-labelledby="ins3d-sched">
        <div className="ins3-card-head">
          <h2 id="ins3d-sched" className="ins3-h2">
            {c.scheduleTitle}
          </h2>
          {isPayable(p) && p.nextPremiumDueDate && (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={onPay}
            >
              {v3.recordPayment}
            </button>
          )}
        </div>
        <dl className="ins3d-facts ins3d-facts--row">
          <div className="ins3d-fact">
            <dt>{c.nextDue}</dt>
            <dd>
              {formatDay(p.nextPremiumDueDate, locale, "long")}
              {p.premiumDueStatus && (
                <span className="ins3-chip" data-tone={dueTone}>
                  {c.dueStatus[p.premiumDueStatus]}
                </span>
              )}
            </dd>
          </div>
          <div className="ins3d-fact">
            <dt>{c.scheduledAmount}</dt>
            <dd className="ins3-amount">
              {formatNative(p.premiumAmount, "IDR", locale)}
            </dd>
          </div>
          <div className="ins3d-fact">
            <dt>{c.premiumEnd}</dt>
            <dd>{formatDay(p.premiumPaymentEndDate, locale, "long")}</dd>
          </div>
          <div className="ins3d-fact">
            <dt>{c.autoRenew}</dt>
            <dd>{p.autoRenewDate ? c.yes : c.no}</dd>
          </div>
        </dl>
        {projected.length > 0 && (
          <>
            <p className="ins3-callout-title mt-3">{c.projectedTitle}</p>
            <ul className="ins3d-timeline">
              {projected.map((d) => (
                <li key={d}>
                  <span>{formatDay(d, locale, "long")}</span>
                  <small>
                    {formatNative(p.premiumAmount, "IDR", locale)} ·{" "}
                    {c.projectedTag}
                  </small>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="ins3-card" aria-labelledby="ins3d-paid">
        <h2 id="ins3d-paid" className="ins3-h2">
          {c.historyTitle}
        </h2>
        <p className="ins3-muted">{c.historySub}</p>
        {isLoading ? (
          <p className="ins3-state" role="status">
            {v3.loading}
          </p>
        ) : isError ? (
          <p className="error-text" role="alert">
            {c.historyError}
          </p>
        ) : payments.length === 0 ? (
          <p className="ins3-state">{c.historyEmpty}</p>
        ) : (
          <ul className="ins3d-payments">
            {payments.map((pay) => (
              <li key={pay.id}>
                <div>
                  <strong className="ins3-amount">
                    {formatNative(pay.amount, pay.currency, locale)}
                  </strong>
                  <small>
                    {fillCopy(c.paidOn, {
                      date: formatDay(pay.paidAt.slice(0, 10), locale, "long"),
                    })}{" "}
                    · {accountName(pay.accountId) ?? "—"}
                  </small>
                </div>
                <div>
                  <span className="ins3-chip" data-tone="good">
                    {pay.dueDate
                      ? fillCopy(c.forDue, {
                          date: formatDay(pay.dueDate, locale),
                        })
                      : c.noDue}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn--outline btn--sm ins3d-void"
                  disabled={voidPayment.isPending}
                  onClick={() => setVoiding(pay)}
                >
                  {c.voidButton}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDeleteDialog
        label={
          voiding
            ? formatNative(voiding.amount, voiding.currency, locale)
            : null
        }
        title={c.voidTitle}
        body={
          voiding
            ? fillCopy(voiding.dueDate ? c.voidBody : c.voidBodyNoDue, {
                amount: formatNative(voiding.amount, voiding.currency, locale),
                account: accountName(voiding.accountId) ?? "—",
                date: formatDay(voiding.dueDate, locale, "long"),
              })
            : ""
        }
        confirmLabel={voidPayment.isPending ? c.voiding : c.voidConfirm}
        onClose={() => setVoiding(null)}
        onConfirm={() => {
          if (voiding && !voidPayment.isPending) voidPayment.mutate(voiding.id);
        }}
      />
    </div>
  );
}
