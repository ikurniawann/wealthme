"use client";

import { AlertTriangle } from "lucide-react";
import type { AssetValuationPreviewDto } from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { investmentErrorMessage } from "../../investasi/investment-conflict";
import { fillCopy } from "../aset-model";
import {
  fmtDay,
  fmtPctSigned,
  idr,
  signedIdr,
  toneOf,
  withUnit,
} from "./detail-model";

function toneTo(value: string | null): "good" | "bad" | undefined {
  const tone = toneOf(value);
  return tone === "up" ? "good" : tone === "down" ? "bad" : undefined;
}

/**
 * "Pratinjau perubahan nilai" of the Update nilai drawer. Every figure is
 * the server's own preview (POST …/valuations/preview); nothing is computed
 * here.
 */
export function ValuePreview({
  p,
  isError,
  error,
  isFetching,
  unit,
}: {
  p: AssetValuationPreviewDto | undefined;
  isError: boolean;
  error: unknown;
  isFetching: boolean;
  unit: string | null;
}) {
  const { t, locale } = useLocale();
  const d = t.aset.v3.detail;
  const money = useMoney();
  const fmt = (v: string) => money.formatExact(idr(v));
  const notCurrent = (date: string | null) =>
    fillCopy(d.vNotCurrent, { date: date ? fmtDay(date, locale) : "—" });
  const warn = p
    ? p.backdated
      ? p.becomesCurrent
        ? d.vBackdated
        : notCurrent(p.newerValuationDate)
      : !p.becomesCurrent
        ? notCurrent(p.newerValuationDate)
        : null
    : null;
  return (
    <section
      className="ivx-sum ad-preview"
      aria-live="polite"
      aria-labelledby="adv-prev"
    >
      <p className="ivx-sum-title" id="adv-prev">
        {d.vPreviewTitle}
      </p>
      {!p ? (
        <p className="ivx-sum-note">
          {isError
            ? investmentErrorMessage(error, d.vFailed, locale)
            : isFetching
              ? d.vPreviewLoading
              : d.vPreviewIdle}
        </p>
      ) : (
        <>
          <dl className="ivx-sum-list">
            {p.valuationModel === "per_unit" && (
              <>
                <div>
                  <dt>{d.vQty}</dt>
                  <dd>{withUnit(p.quantity, p.unit ?? unit, locale)}</dd>
                </div>
                <div>
                  <dt>
                    {fillCopy(d.vNewPrice, { unit: p.unit ?? unit ?? "unit" })}
                  </dt>
                  <dd>{p.pricePerUnitIdr ? fmt(p.pricePerUnitIdr) : "—"}</dd>
                </div>
              </>
            )}
            <div className="ivx-sum-key">
              <dt>
                {d.vNewValue}
                {p.valuationModel === "per_unit" && p.pricePerUnitIdr && (
                  <small>
                    {withUnit(p.quantity, p.unit ?? unit, locale)} ×{" "}
                    {fmt(p.pricePerUnitIdr)}
                  </small>
                )}
              </dt>
              <dd>{fmt(p.newValueIdr)}</dd>
            </div>
          </dl>
          <dl className="ivx-sum-list ad-preview-change">
            <div>
              <dt>
                {d.vPrevValue}
                {p.comparisonDate && (
                  <small>{fmtDay(p.comparisonDate, locale)}</small>
                )}
              </dt>
              <dd>
                {p.previousValueIdr ? fmt(p.previousValueIdr) : d.vPrevNone}
              </dd>
            </div>
            <div>
              <dt>{d.vChange}</dt>
              <dd data-tone={toneTo(p.changeIdr)}>
                {p.changeIdr ? signedIdr(p.changeIdr, money.formatExact) : "—"}
              </dd>
            </div>
            <div>
              <dt>{d.vChangePct}</dt>
              <dd data-tone={toneTo(p.changeIdr)}>
                {fmtPctSigned(p.changePercent, locale)}
              </dd>
            </div>
            <div>
              <dt>{d.vImpact}</dt>
              <dd data-tone={toneTo(p.totalImpactIdr)}>
                {signedIdr(p.totalImpactIdr, money.formatExact)}
              </dd>
            </div>
          </dl>
          {warn && (
            <p className="ivx-strip ad-warn" data-tone="warn" role="status">
              <AlertTriangle aria-hidden="true" />
              <span>{warn}</span>
            </p>
          )}
        </>
      )}
      <p className="ivx-sum-note">{d.vNoCash}</p>
    </section>
  );
}
