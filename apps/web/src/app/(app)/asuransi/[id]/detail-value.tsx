"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/api-error";

import { fillCopy, formatDay, formatNative } from "../asuransi-model";
import { fundViews, sortStatements, statementValue } from "./detail-model";

import type { InsuranceDto, InsuranceValuationDto } from "@wealthme/contracts";

type Props = {
  familyGroupId: string;
  token: string | undefined;
  policy: InsuranceDto;
  valuations: InsuranceValuationDto[];
  isLoading: boolean;
  isError: boolean;
  onUpdate: () => void;
};

function Breakdown({
  v,
  locale,
}: {
  v: InsuranceValuationDto;
  locale: string;
}) {
  const { t } = useLocale();
  const c = t.asuransi.v3.detail;
  if (v.units && v.navPerUnit) {
    return (
      <p className="ins3d-calc">
        <span className="mono">{v.units}</span> {c.unitsWord} ×{" "}
        <span className="mono">
          {formatNative(v.navPerUnit, v.currency, locale)}
        </span>{" "}
        ={" "}
        <strong className="ins3-amount">
          {v.computedValue
            ? formatNative(v.computedValue, v.currency, locale)
            : "—"}
        </strong>
        <small>
          {fillCopy(c.navOn, { date: formatDay(v.navDate, locale) })}
          {v.unitsDate
            ? ` · ${fillCopy(c.unitsOn, { date: formatDay(v.unitsDate, locale) })}`
            : ""}
          {v.warning === "dates_incompatible"
            ? ` · ${c.datesWarning}`
            : v.warning === "incomplete"
              ? ` · ${c.incomplete}`
              : ""}
        </small>
      </p>
    );
  }
  return (
    <dl className="ins3d-facts ins3d-facts--row">
      {v.reportedValue && (
        <div className="ins3d-fact">
          <dt>{c.reportedValue}</dt>
          <dd className="ins3-amount">
            {formatNative(v.reportedValue, v.currency, locale)}
          </dd>
        </div>
      )}
      {v.cashValue && (
        <div className="ins3d-fact">
          <dt>{c.cashValue}</dt>
          <dd className="ins3-amount">
            {formatNative(v.cashValue, v.currency, locale)}
          </dd>
        </div>
      )}
      {v.surrenderEstimate && (
        <div className="ins3d-fact">
          <dt>{c.surrender}</dt>
          <dd className="ins3-amount">
            {formatNative(v.surrenderEstimate, v.currency, locale)}
          </dd>
        </div>
      )}
      {v.maturityBenefit && (
        <div className="ins3d-fact">
          <dt>{c.maturity}</dt>
          <dd className="ins3-amount">
            {formatNative(v.maturityBenefit, v.currency, locale)}
            <small>{v.guaranteed ? c.guaranteed : c.notGuaranteed}</small>
          </dd>
        </div>
      )}
    </dl>
  );
}

/**
 * Investasi & nilai tunai — latest statement per sub-fund with its
 * calculation (units × NAV, computed by the API with Decimal), source,
 * date and confirmation; the full value history below, separate from
 * premiums and benefits. Premiums paid are never shown as value.
 */
export function ValueTab({
  familyGroupId,
  token,
  policy: p,
  valuations,
  isLoading,
  isError,
  onUpdate,
}: Props) {
  const { t, locale } = useLocale();
  const c = t.asuransi.v3.detail;
  const v3 = t.asuransi.v3;
  const queryClient = useQueryClient();
  const confirm = useMutation({
    mutationFn: (vid: string) =>
      apiFetch<InsuranceValuationDto>(
        `/family-groups/${familyGroupId}/insurances/${p.id}/valuations/${vid}/confirm`,
        { method: "POST", token },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["insurances", familyGroupId],
      });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(c.confirmDone);
    },
    onError: (err) => toast.error(apiErrorMessage(err, c.confirmFailed)),
  });
  const views = fundViews(p, valuations);
  const history = sortStatements(valuations);
  const fundName = (id: string | null) =>
    (p.funds ?? []).find((f) => f.id === id)?.name ?? c.policyLevel;

  return (
    <div className="ins3d-stack">
      <section className="ins3-card" aria-labelledby="ins3d-val">
        <div className="ins3-card-head">
          <h2 id="ins3d-val" className="ins3-h2">
            {p.policyType === "traditional" ? c.cashTitle : c.valueTitle}
          </h2>
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={onUpdate}
          >
            {c.updateValue}
          </button>
        </div>
        {!p.policyType && <p className="ins3-muted">{c.noPolicyType}</p>}
        {isLoading ? (
          <p className="ins3-state" role="status">
            {v3.loading}
          </p>
        ) : isError ? (
          <p className="error-text" role="alert">
            {c.valueError}
          </p>
        ) : views.length === 0 ? (
          <p className="ins3-state">
            {p.policyType === "unit_link" ? c.noFunds : v3.valueNoneHint}
          </p>
        ) : (
          <div className="ins3d-funds">
            {views.map((view) => {
              const v = view.latest;
              return (
                <article key={view.fund?.id ?? "policy"} className="ins3d-fund">
                  <header>
                    <strong>
                      {view.fund ? view.fund.name : c.policyLevel}
                    </strong>
                    {view.fund?.code && (
                      <small className="mono">{view.fund.code}</small>
                    )}
                    <small>{view.fund?.currency ?? p.currency}</small>
                  </header>
                  {!v ? (
                    <p className="ins3-muted">{c.noStatement}</p>
                  ) : (
                    <>
                      <Breakdown v={v} locale={locale} />
                      <p className="ins3d-meta">
                        <span
                          className="ins3-chip"
                          data-tone={v.status === "confirmed" ? "good" : "warn"}
                        >
                          {v3.aiStatus[v.status]}
                        </span>
                        <small>
                          {fillCopy(v3.valueAsOf, {
                            date: formatDay(v.effectiveDate, locale),
                          })}{" "}
                          · {v3.sources[v.source]}
                          {v.page
                            ? ` · ${fillCopy(v3.aiPage, { n: v.page })}`
                            : ""}
                        </small>
                      </p>
                      {v.snippet && <p className="hint">“{v.snippet}”</p>}
                      {v.status !== "confirmed" && (
                        <button
                          type="button"
                          className="btn btn--primary btn--sm"
                          disabled={confirm.isPending}
                          onClick={() => confirm.mutate(v.id)}
                        >
                          {c.confirmValue}
                        </button>
                      )}
                      {v.status !== "confirmed" && view.latestConfirmed && (
                        <p className="hint">
                          {fillCopy(c.officialStill, {
                            value: formatNative(
                              statementValue(view.latestConfirmed),
                              view.latestConfirmed.currency,
                              locale,
                            ),
                            date: formatDay(
                              view.latestConfirmed.effectiveDate,
                              locale,
                            ),
                          })}
                        </p>
                      )}
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
        <div className="ins3-callout" data-tone="info" role="note">
          <div>
            <p className="ins3-callout-title">{v3.ulNoteTitle}</p>
            <p>{v3.ulNoteBody}</p>
          </div>
        </div>
      </section>

      <section className="ins3-card" aria-labelledby="ins3d-val-hist">
        <h2 id="ins3d-val-hist" className="ins3-h2">
          {c.valueHistory}
        </h2>
        <p className="ins3-muted">{c.valueHistorySub}</p>
        {history.length === 0 ? (
          <p className="ins3-state">{c.valueHistoryEmpty}</p>
        ) : (
          <ul className="ins3d-payments">
            {history.map((v) => (
              <li key={v.id}>
                <div>
                  <strong className="ins3-amount">
                    {formatNative(statementValue(v), v.currency, locale)}
                  </strong>
                  <small>
                    {fundName(v.fundId)} ·{" "}
                    {fillCopy(c.effectiveOn, {
                      date: formatDay(v.effectiveDate, locale),
                    })}{" "}
                    ·{" "}
                    {fillCopy(c.recordedOn, {
                      date: formatDay(v.createdAt, locale),
                    })}
                  </small>
                </div>
                <div>
                  <span
                    className="ins3-chip"
                    data-tone={v.status === "confirmed" ? "good" : "warn"}
                  >
                    {v3.aiStatus[v.status]}
                  </span>
                </div>
                <small>{v3.sources[v.source]}</small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
