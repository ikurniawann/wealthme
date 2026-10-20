"use client";

import {
  Banknote,
  CalendarClock,
  ChartColumn,
  CircleAlert,
  Plus,
  ShieldCheck,
  Upload,
} from "lucide-react";

import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";

import {
  fillCopy,
  formatDay,
  formatNative,
  sumByCurrency,
} from "./asuransi-model";

import { INSURANCE_BENEFIT_KINDS } from "@wealthme/contracts";
import type { InsuranceSummaryDto } from "@wealthme/contracts";

export function AsuransiHeader({
  disabled,
  onUpload,
  onPay,
  onAdd,
}: {
  disabled: boolean;
  onUpload: () => void;
  onPay: () => void;
  onAdd: () => void;
}) {
  const { t } = useLocale();
  const c = t.asuransi.v3;
  return (
    <header className="ins3-header">
      <div className="ins3-heading">
        <p className="ins3-title">{c.title}</p>
        <p>{c.subtitle}</p>
      </div>
      <div className="ins3-header-actions">
        <button
          type="button"
          className="btn btn--outline"
          onClick={onUpload}
          disabled={disabled}
        >
          <Upload aria-hidden="true" /> {c.uploadReport}
        </button>
        <button
          type="button"
          className="btn btn--outline"
          onClick={onPay}
          disabled={disabled}
        >
          <Banknote aria-hidden="true" /> {c.recordPayment}
        </button>
        <button
          type="button"
          className="btn btn--primary ins3-add"
          onClick={onAdd}
          disabled={disabled}
        >
          <Plus aria-hidden="true" /> {c.addPolicy}
        </button>
      </div>
    </header>
  );
}

function Skeleton() {
  return <span className="ins3-bone" aria-hidden="true" />;
}

export function AsuransiSummary({
  summary,
  isLoading,
}: {
  summary: InsuranceSummaryDto | undefined;
  isLoading: boolean;
}) {
  const { t, locale } = useLocale();
  const c = t.asuransi.v3;
  const money = useMoney();
  const idrOrNative = (amount: string | number, currency: string) =>
    currency === "IDR"
      ? money.format(Number(amount))
      : formatNative(String(amount), currency, locale);

  const due = summary?.premiumDue ?? [];
  const overdue = summary?.overdue ?? [];
  const normalized = summary?.monthlyPremiumNormalized ?? [];
  // Life sum assured first, "other" last — kinds are never summed together.
  const benefits = [...(summary?.benefitGroups ?? [])].sort(
    (a, b) =>
      INSURANCE_BENEFIT_KINDS.indexOf(a.kind) -
        INSURANCE_BENEFIT_KINDS.indexOf(b.kind) ||
      Number(b.total) - Number(a.total),
  );
  const [topBenefit, ...otherBenefits] = benefits;
  const values = summary?.confirmedValues ?? [];
  const valueTotals = sumByCurrency(values, (v) => ({
    currency: v.currency,
    amount: v.value,
  }));
  const latestValue = values.reduce<(typeof values)[number] | null>(
    (latest, v) =>
      !latest || v.effectiveDate > latest.effectiveDate ? v : latest,
    null,
  );
  const valueSources = Array.from(
    new Set(values.map((v) => c.sources[v.source])),
  );
  const netWorthIdr = Number(summary?.netWorthValueIdr ?? "0");

  return (
    <section className="ins3-card ins3-summary" aria-label={c.summaryAria}>
      <div className="ins3-sum">
        <span className="ins3-sum-icon" data-tone="lime">
          <CalendarClock aria-hidden="true" />
        </span>
        <div className="ins3-sum-body">
          <p className="ins3-sum-label">{c.dueTitle}</p>
          {isLoading ? (
            <Skeleton />
          ) : due.length ? (
            due.map((d) => (
              <p key={d.currency} className="ins3-sum-value ins3-amount">
                {idrOrNative(d.total, d.currency)}
              </p>
            ))
          ) : (
            <p className="ins3-sum-empty">{c.dueNone}</p>
          )}
          <div className="ins3-chips">
            {summary && (
              <span className="ins3-chip" data-tone="good">
                {fillCopy(c.activeChip, { n: summary.activePolicies })}
              </span>
            )}
            {overdue.map((o) => (
              <span key={o.currency} className="ins3-chip" data-tone="bad">
                {fillCopy(c.overdueChip, {
                  n: o.count,
                  amount: idrOrNative(o.total, o.currency),
                })}
              </span>
            ))}
          </div>
          {normalized.map((n) => (
            <small key={n.currency} className="ins3-sum-note">
              {fillCopy(c.normalized, {
                amount: idrOrNative(n.total, n.currency),
              })}
            </small>
          ))}
        </div>
      </div>

      <div className="ins3-sum">
        <span className="ins3-sum-icon" data-tone="sky">
          <ShieldCheck aria-hidden="true" />
        </span>
        <div className="ins3-sum-body">
          <p className="ins3-sum-label">
            {topBenefit ? c.benefitKinds[topBenefit.kind] : c.benefitTitle}
          </p>
          {isLoading ? (
            <Skeleton />
          ) : topBenefit ? (
            <>
              <p className="ins3-sum-value ins3-amount">
                {formatNative(topBenefit.total, topBenefit.currency, locale)}
              </p>
              <div className="ins3-chips">
                <span className="ins3-chip" data-tone="lilac">
                  {fillCopy(c.benefitPolicies, { n: topBenefit.policyCount })}
                </span>
                {topBenefit.hasUnconfirmed && (
                  <span className="ins3-chip" data-tone="muted">
                    {c.benefitUnconfirmed}
                  </span>
                )}
              </div>
              {otherBenefits.length > 0 && (
                <ul className="ins3-benefit-list">
                  {otherBenefits.slice(0, 3).map((b) => (
                    <li key={`${b.kind}-${b.currency}`}>
                      <span>{c.benefitKinds[b.kind]}</span>
                      <span className="ins3-amount">
                        {formatNative(b.total, b.currency, locale)}
                      </span>
                    </li>
                  ))}
                  {otherBenefits.length > 3 && (
                    <li>
                      <small>
                        {fillCopy(c.benefitMore, {
                          n: otherBenefits.length - 3,
                        })}
                      </small>
                    </li>
                  )}
                </ul>
              )}
            </>
          ) : (
            <p className="ins3-sum-empty">{c.benefitNone}</p>
          )}
        </div>
      </div>

      <div className="ins3-sum">
        <span className="ins3-sum-icon" data-tone="green">
          <ChartColumn aria-hidden="true" />
        </span>
        <div className="ins3-sum-body">
          <p className="ins3-sum-label">{c.valueTitle}</p>
          {isLoading ? (
            <Skeleton />
          ) : valueTotals.length ? (
            <>
              {valueTotals.map((v) => (
                <p key={v.currency} className="ins3-sum-value ins3-amount">
                  {formatNative(String(v.total), v.currency, locale)}
                </p>
              ))}
              {latestValue && (
                <div className="ins3-chips">
                  <span className="ins3-chip" data-tone="sky">
                    {fillCopy(c.valueAsOf, {
                      date: formatDay(latestValue.effectiveDate, locale),
                    })}
                    {valueSources.length ? ` · ${valueSources.join(", ")}` : ""}
                  </span>
                </div>
              )}
              {netWorthIdr > 0 && (
                <small className="ins3-sum-note">
                  {fillCopy(c.valueNetWorth, {
                    amount: money.format(netWorthIdr),
                  })}
                </small>
              )}
            </>
          ) : (
            <>
              <p className="ins3-sum-value">{c.valueNone}</p>
              <small className="ins3-sum-note">{c.valueNoneHint}</small>
            </>
          )}
        </div>
      </div>

      <aside className="ins3-callout" data-tone="warn">
        <CircleAlert aria-hidden="true" />
        <div>
          <p className="ins3-callout-title">{c.calloutTitle}</p>
          <p>{c.calloutBody}</p>
        </div>
      </aside>
    </section>
  );
}
