"use client";

import { ArrowRight, Info, RefreshCw } from "lucide-react";

import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";

import {
  SCHEDULE_MAX_ROWS,
  SCHEDULE_WINDOW_DAYS,
  fillCopy,
  formatDay,
  formatNative,
  nextDue,
  sumByCurrency,
} from "./asuransi-model";
import { DueCell } from "./policy-row-parts";

import type { InsuranceDto, InsuranceSummaryDto } from "@wealthme/contracts";

/** Jadwal premi berikutnya — overdue dues + dues within the window. */
export function PremiumSchedule({
  rows,
  isLoading,
  onPay,
  onSeeAll,
}: {
  rows: InsuranceDto[];
  isLoading: boolean;
  onPay: (policy: InsuranceDto) => void;
  onSeeAll: () => void;
}) {
  const { t, locale } = useLocale();
  const c = t.asuransi.v3;
  const money = useMoney();
  const shown = rows.slice(0, SCHEDULE_MAX_ROWS);
  return (
    <section
      className="ins3-card ins3-schedule"
      aria-labelledby="ins3-sched-title"
    >
      <div className="ins3-card-head">
        <div>
          <h2 id="ins3-sched-title" className="ins3-h2">
            {c.scheduleTitle}
          </h2>
          <small>{fillCopy(c.scheduleSub, { n: SCHEDULE_WINDOW_DAYS })}</small>
        </div>
        <button type="button" className="ins3-link" onClick={onSeeAll}>
          {c.seeAllSchedule} <ArrowRight aria-hidden="true" />
        </button>
      </div>
      {isLoading ? (
        <span className="ins3-bone" />
      ) : shown.length === 0 ? (
        <p className="ins3-state">
          {fillCopy(c.scheduleEmpty, { n: SCHEDULE_WINDOW_DAYS })}
        </p>
      ) : (
        <ul className="ins3-sched-list">
          {shown.map((p) => {
            const due = nextDue(p)!;
            return (
              <li key={p.id} className="ins3-sched-row" data-policy-id={p.id}>
                <span className="ins3-date" aria-hidden="true">
                  <strong>{Number(due.slice(8, 10))}</strong>
                  <small>{formatDay(due, locale).replace(/^\d+\s/, "")}</small>
                </span>
                <span className="ins3-sched-main">
                  <strong>{p.name}</strong>
                  <small>{p.provider ?? c.noProvider}</small>
                  <DueCell policy={p} showDate={false} />
                </span>
                <span className="ins3-sched-amt">
                  <span className="ins3-amount">
                    {money.format(Number(p.premiumAmount))}
                  </span>
                  <small>
                    {t.asuransi.periodOptionLabels[p.premiumPeriod] ??
                      p.premiumPeriod}
                  </small>
                </span>
                <button
                  type="button"
                  className="btn btn--outline btn--sm ins3-pay"
                  onClick={() => onPay(p)}
                  aria-label={`${c.pay} — ${p.name}`}
                >
                  {c.pay}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Nilai polis unit link — confirmed values only, per currency. */
export function UnitLinkValueCard({
  policies,
  summary,
  isLoading,
  onUpdate,
  onDetail,
}: {
  policies: InsuranceDto[];
  summary: InsuranceSummaryDto | undefined;
  isLoading: boolean;
  onUpdate: () => void;
  onDetail: (policy: InsuranceDto) => void;
}) {
  const { t, locale } = useLocale();
  const c = t.asuransi.v3;
  const unitLink = policies.filter((p) => p.policyType === "unit_link");
  const ids = new Set(unitLink.map((p) => p.id));
  const values = (summary?.confirmedValues ?? []).filter((v) =>
    ids.has(v.insuranceId),
  );
  const totals = sumByCurrency(values, (v) => ({
    currency: v.currency,
    amount: v.value,
  }));
  const latest = values.reduce<(typeof values)[number] | null>(
    (acc, v) => (!acc || v.effectiveDate > acc.effectiveDate ? v : acc),
    null,
  );
  const sources = Array.from(new Set(values.map((v) => c.sources[v.source])));
  const detailTarget =
    unitLink.find((p) => p.id === latest?.insuranceId) ?? unitLink[0] ?? null;

  return (
    <section className="ins3-card ins3-ul" aria-labelledby="ins3-ul-title">
      <div className="ins3-card-head">
        <h2 id="ins3-ul-title" className="ins3-h2 ins3-ul-title">
          {c.ulTitle}
          <span className="ins3-info" title={c.ulInfo}>
            <Info aria-hidden="true" />
            <span className="sr-only">{c.ulInfo}</span>
          </span>
        </h2>
        {detailTarget && (
          <button
            type="button"
            className="ins3-link"
            onClick={() => onDetail(detailTarget)}
          >
            {c.ulDetail} <ArrowRight aria-hidden="true" />
          </button>
        )}
      </div>
      {isLoading ? (
        <span className="ins3-bone" />
      ) : totals.length ? (
        <div className="ins3-ul-values">
          {totals.map((v) => (
            <p key={v.currency} className="ins3-ul-amount ins3-amount">
              {formatNative(String(v.total), v.currency, locale)}
            </p>
          ))}
          <small>{fillCopy(c.ulPolicies, { n: ids.size })}</small>
        </div>
      ) : (
        <p className="ins3-state">
          {unitLink.length ? c.ulEmpty : c.ulNoPolicy}
        </p>
      )}
      <div className="ins3-ul-foot">
        {latest && (
          <span className="ins3-chip" data-tone="sky">
            {fillCopy(c.valueAsOf, {
              date: formatDay(latest.effectiveDate, locale),
            })}
            {sources.length ? ` · ${sources.join(", ")}` : ""}
          </span>
        )}
        <button
          type="button"
          className="btn btn--outline ins3-ul-update"
          onClick={onUpdate}
          disabled={unitLink.length === 0}
        >
          <RefreshCw aria-hidden="true" /> {c.ulUpdate}
        </button>
      </div>
      <aside className="ins3-callout" data-tone="info">
        <Info aria-hidden="true" />
        <div>
          <p className="ins3-callout-title">{c.ulNoteTitle}</p>
          <p>{c.ulNoteBody}</p>
        </div>
      </aside>
    </section>
  );
}
