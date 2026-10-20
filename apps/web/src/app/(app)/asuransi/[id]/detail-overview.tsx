"use client";

import { useLocale } from "@/hooks/use-locale";

import {
  fillCopy,
  formatDay,
  formatNative,
  maskPolicyNumber,
} from "../asuransi-model";
import { fundViews, statementValue, sumDecimals } from "./detail-model";

import type {
  InsuranceBenefitDto,
  InsuranceDto,
  InsuranceValuationDto,
} from "@wealthme/contracts";

type Names = {
  member: (userId: string | null | undefined) => string | null;
  account: (id: string | null | undefined) => string | null;
};

function Fact({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="ins3d-fact">
      <dt>{label}</dt>
      <dd>
        {value}
        {hint && <small>{hint}</small>}
      </dd>
    </div>
  );
}

/** Ringkasan — identity, roles, the separated dates, premium and value at a glance. */
export function SummaryTab({
  policy: p,
  valuations,
  names,
  showNumber,
  onToggleNumber,
}: {
  policy: InsuranceDto;
  valuations: InsuranceValuationDto[];
  names: Names;
  showNumber: boolean;
  onToggleNumber: () => void;
}) {
  const { t, locale } = useLocale();
  const c = t.asuransi.v3.detail;
  const v3 = t.asuransi.v3;
  const holder = names.member(p.holderUserId) ?? p.holderName ?? "—";
  const payer =
    names.member(p.payerUserId) ?? p.payerName ?? c.payerSameAsHolder;
  const insured =
    (p.insured ?? [])
      .map((i) => (i.relationship ? `${i.name} (${i.relationship})` : i.name))
      .join(", ") || "—";
  const day = (d: string | null | undefined) => formatDay(d, locale, "long");
  const confirmed = fundViews(p, valuations)
    .map((v) => v.latestConfirmed)
    .filter((v): v is InsuranceValuationDto => Boolean(v && statementValue(v)));
  const byCurrency = new Map<string, string[]>();
  for (const v of confirmed)
    byCurrency.set(v.currency, [
      ...(byCurrency.get(v.currency) ?? []),
      statementValue(v)!,
    ]);
  const period =
    t.asuransi.periodOptionLabels[p.premiumPeriod as "monthly"] ??
    p.premiumPeriod;

  return (
    <div className="ins3d-grid">
      <section className="ins3-card" aria-labelledby="ins3d-sum-policy">
        <h2 id="ins3d-sum-policy" className="ins3-h2">
          {c.policyCard}
        </h2>
        <dl className="ins3d-facts">
          <Fact label={c.provider} value={p.provider ?? "—"} />
          <div className="ins3d-fact">
            <dt>{c.policyNumber}</dt>
            <dd>
              <span className="mono">
                {showNumber
                  ? (p.policyNumber ?? "—")
                  : (maskPolicyNumber(p.policyNumber) ?? "—")}
              </span>
              {p.policyNumber && (
                <button
                  type="button"
                  className="ins3-link"
                  onClick={onToggleNumber}
                  aria-pressed={showNumber}
                >
                  {showNumber ? c.hideNumber : c.showNumber}
                </button>
              )}
            </dd>
          </div>
          <Fact label={c.holder} value={holder} />
          <Fact label={c.insured} value={insured} />
          <Fact label={c.payer} value={payer} />
          <Fact label={c.currency} value={p.currency} />
          <Fact label={c.coverageStart} value={day(p.coverageStartDate)} />
          <Fact
            label={c.coverageEnd}
            value={day(p.coverageEndDate)}
            hint={c.coverageEndHint}
          />
          <Fact label={c.policyRenewal} value={day(p.policyRenewalDate)} />
        </dl>
      </section>

      <section className="ins3-card" aria-labelledby="ins3d-sum-premium">
        <h2 id="ins3d-sum-premium" className="ins3-h2">
          {c.premiumCard}
        </h2>
        <p className="ins3d-big ins3-amount">
          {formatNative(p.premiumAmount, "IDR", locale)}
        </p>
        <p className="ins3-muted">{fillCopy(c.perPeriod, { period })}</p>
        {p.monthlyEquivalentPremium && p.premiumPeriod !== "monthly" && (
          <p className="ins3-chip" data-tone="sky">
            {fillCopy(v3.normalized, {
              amount: formatNative(p.monthlyEquivalentPremium, "IDR", locale),
            })}
          </p>
        )}
        <dl className="ins3d-facts">
          <Fact
            label={c.nextDue}
            value={day(p.nextPremiumDueDate)}
            hint={
              p.daysUntilNextPremium == null
                ? undefined
                : p.daysUntilNextPremium < 0
                  ? fillCopy(v3.dueOverdue, {
                      n: Math.abs(p.daysUntilNextPremium),
                    })
                  : p.daysUntilNextPremium === 0
                    ? v3.dueToday
                    : fillCopy(v3.dueIn, { n: p.daysUntilNextPremium })
            }
          />
          <Fact label={c.premiumEnd} value={day(p.premiumPaymentEndDate)} />
          <Fact
            label={c.payAccount}
            value={names.account(p.paymentAccountId) ?? "—"}
          />
        </dl>
      </section>

      <section className="ins3-card" aria-labelledby="ins3d-sum-value">
        <h2 id="ins3d-sum-value" className="ins3-h2">
          {c.valueCard}
        </h2>
        {byCurrency.size === 0 ? (
          <p className="ins3-muted">{v3.valueNoneHint}</p>
        ) : (
          Array.from(byCurrency, ([cur, vals]) => (
            <p key={cur} className="ins3d-big ins3-amount">
              {formatNative(sumDecimals(vals), cur, locale)}
            </p>
          ))
        )}
        {confirmed.length > 0 && (
          <details className="ins3d-breakdown">
            <summary>{c.showCalc}</summary>
            <ul>
              {confirmed.map((v) => (
                <li key={v.id}>
                  <span>
                    {(p.funds ?? []).find((f) => f.id === v.fundId)?.name ??
                      c.policyLevel}
                  </span>
                  <span className="ins3-amount">
                    {formatNative(statementValue(v), v.currency, locale)}
                  </span>
                  <small>
                    {v.units && v.navPerUnit
                      ? `${v.units} × ${formatNative(v.navPerUnit, v.currency, locale)} · `
                      : ""}
                    {fillCopy(v3.valueAsOf, {
                      date: formatDay(v.effectiveDate, locale),
                    })}{" "}
                    · {v3.sources[v.source]}
                  </small>
                </li>
              ))}
            </ul>
          </details>
        )}
        <p className="ins3-muted">
          {p.includeInNetWorth ? c.inNetWorth : c.notInNetWorth}
        </p>
        <div className="ins3-callout" role="note">
          <div>
            <p className="ins3-callout-title">{v3.calloutTitle}</p>
            <p>{v3.calloutBody}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Manfaat & rider — benefits by kind (never one combined total) + changes. */
export function BenefitsTab({ policy: p }: { policy: InsuranceDto }) {
  const { t, locale } = useLocale();
  const c = t.asuransi.v3.detail;
  const v3 = t.asuransi.v3;
  const benefits = p.benefits ?? [];
  const groups = new Map<string, InsuranceBenefitDto[]>();
  for (const b of benefits)
    groups.set(b.kind, [...(groups.get(b.kind) ?? []), b]);
  const changes = [...benefits].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  return (
    <div className="ins3d-stack">
      <section className="ins3-card" aria-labelledby="ins3d-ben">
        <h2 id="ins3d-ben" className="ins3-h2">
          {c.benefitsTitle}
        </h2>
        {benefits.length === 0 ? (
          <p className="ins3-muted">{v3.benefitNone}</p>
        ) : (
          <div className="ins3d-benefits">
            {Array.from(groups, ([kind, rows]) => (
              <div key={kind} className="ins3d-benefit-group">
                <p className="ins3-callout-title">
                  {v3.benefitKinds[kind as keyof typeof v3.benefitKinds]}
                </p>
                <ul>
                  {rows.map((b) => (
                    <li key={b.id}>
                      <span className="ins3-amount">
                        {b.amount
                          ? formatNative(b.amount, b.currency, locale)
                          : "—"}
                      </span>
                      <small>
                        {[
                          b.label,
                          b.period
                            ? t.asuransi.v3.form.benefitPeriods[b.period]
                            : null,
                          b.note,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </small>
                      {!b.confirmed && (
                        <span className="ins3-chip" data-tone="warn">
                          {v3.benefitUnconfirmed}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <div className="ins3-callout" role="note">
          <div>
            <p className="ins3-callout-title">{v3.calloutTitle}</p>
            <p>{c.benefitsNote}</p>
          </div>
        </div>
      </section>
      <section className="ins3-card" aria-labelledby="ins3d-ben-changes">
        <h2 id="ins3d-ben-changes" className="ins3-h2">
          {c.benefitChanges}
        </h2>
        <p className="ins3-muted">{c.benefitChangesNote}</p>
        {changes.length > 0 && (
          <ul className="ins3d-timeline">
            {changes.map((b) => (
              <li key={b.id}>
                <span>{v3.benefitKinds[b.kind]}</span>
                <small>
                  {fillCopy(c.recordedOn, {
                    date: formatDay(b.createdAt, locale),
                  })}
                  {b.updatedAt.slice(0, 16) !== b.createdAt.slice(0, 16)
                    ? ` · ${fillCopy(c.changedOn, { date: formatDay(b.updatedAt, locale) })}`
                    : ""}
                </small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
