"use client";

import { createElement } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Clock,
  ExternalLink,
  Minus,
  PencilLine,
  Plus,
  RefreshCw,
} from "lucide-react";
import type { AssetDto, AssetLedgerDto } from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { fillCopy, rowIcon } from "../aset-model";
import {
  costTotal,
  currentPrice,
  fmtCurrency,
  fmtPctSigned,
  fmtWhenLong,
  idr,
  isPositive,
  latestValuation,
  signedIdr,
  sourceLabel,
  toneOf,
  unrealized,
  withUnit,
} from "./detail-model";

export type DetailAction = "buy" | "sell" | "value" | "edit";

/** Identity, actions and the KPI strip (reference: aset-detail.png). */
export function DetailHeader({
  asset,
  ledger,
  ownerName,
  canManage,
  onAction,
}: {
  asset: AssetDto;
  ledger: AssetLedgerDto | undefined;
  ownerName: string;
  canManage: boolean;
  onAction: (action: DetailAction) => void;
}) {
  const { t } = useLocale();
  const d = t.aset.v3.detail;
  const icon = createElement(
    rowIcon({
      sourceModule: "assets",
      subtype: asset.type,
      class: "aset_fisik",
    }),
  );
  const typeLabel =
    (t.aset.assetTypeLabels as Record<string, string>)[asset.type] ??
    asset.type;
  const status = ledger?.asset.status ?? asset.status ?? "active";
  const linked = Boolean(asset.investmentId);
  const writable = canManage && status !== "archived";
  const hasUnits = isPositive(ledger?.asset.quantity);
  const meta = [
    typeLabel,
    `${d.owner} ${ownerName}`,
    asset.internalCode ? `${d.code} ${asset.internalCode}` : null,
    asset.custodian ? `${d.custodian} ${asset.custodian}` : null,
    `${d.currency} ${asset.currency || "IDR"}`,
  ].filter(Boolean) as string[];

  return (
    <>
      <nav className="ad-crumb" aria-label={d.back}>
        <Link href="/aset">
          <ChevronLeft aria-hidden="true" />
          {d.back}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{asset.name}</span>
      </nav>
      <header className="ad-head">
        <div className="ad-identity">
          <span className="ad-icon" aria-hidden="true">
            {icon}
          </span>
          <div className="ad-identity-text">
            <div className="ad-title-row">
              <p className="ad-title">{asset.name}</p>
              {status === "sold" && <span className="ad-badge">{d.sold}</span>}
              {status === "archived" && (
                <span className="ad-badge" data-tone="muted">
                  {d.archived}
                </span>
              )}
            </div>
            <p className="ad-meta">
              {meta.map((m, i) => (
                <span key={i}>{m}</span>
              ))}
            </p>
          </div>
        </div>
        {writable && (
          <div className="ad-actions" role="group" aria-label={d.actionsAria}>
            {linked ? (
              <Link
                className="btn btn--primary"
                href={`/investasi/${asset.investmentId}`}
              >
                <ExternalLink aria-hidden="true" />
                {d.openInvestasi}
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => onAction("buy")}
                >
                  <Plus aria-hidden="true" />
                  {d.buy}
                </button>
                <button
                  type="button"
                  className="btn btn--outline"
                  disabled={!hasUnits}
                  onClick={() => onAction("sell")}
                >
                  <Minus aria-hidden="true" />
                  {d.sell}
                </button>
                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={() => onAction("value")}
                >
                  <RefreshCw aria-hidden="true" />
                  {d.updateValue}
                </button>
              </>
            )}
            <button
              type="button"
              className="btn btn--ghost ad-edit"
              onClick={() => onAction("edit")}
            >
              <PencilLine aria-hidden="true" />
              {d.editInfo}
            </button>
          </div>
        )}
      </header>
      {linked && <p className="ad-notice">{d.linkedNote}</p>}
      {status === "archived" && <p className="ad-notice">{d.archivedNote}</p>}
      {ledger && <KpiStrip asset={asset} ledger={ledger} />}
      {!ledger && <div className="ad-card ad-kpis ad-skeleton" aria-hidden />}
    </>
  );
}

function KpiStrip({
  asset,
  ledger,
}: {
  asset: AssetDto;
  ledger: AssetLedgerDto;
}) {
  const { t, locale } = useLocale();
  const d = t.aset.v3.detail;
  const money = useMoney();
  const state = ledger.asset;
  const price = currentPrice(ledger);
  const cost = costTotal(state);
  const pnl = unrealized(state);
  const last = latestValuation(ledger.events);
  const unit = state.unit ?? asset.unit ?? null;
  const tone = toneOf(pnl?.amount);
  const fmt = (v: string) => money.formatExact(idr(v));
  return (
    <section className="ad-card ad-kpis" aria-label={d.kpiAria}>
      <dl className="ad-kpi-grid">
        {state.valuationModel === "per_unit" && (
          <div>
            <dt>{d.kpiQty}</dt>
            <dd className="ad-num">{withUnit(state.quantity, unit, locale)}</dd>
          </div>
        )}
        <div>
          <dt>{d.kpiCost}</dt>
          <dd className="ad-num">{cost ? fmt(cost) : "—"}</dd>
          {!cost && <small>{d.costUnknown}</small>}
        </div>
        {state.valuationModel === "per_unit" ? (
          <div>
            <dt>{d.kpiPrice}</dt>
            <dd className="ad-num">
              {price
                ? fmtCurrency(
                    price.value,
                    price.currency,
                    locale,
                    money.formatExact,
                  )
                : "—"}
              {price && unit && <span className="ad-per"> / {unit}</span>}
            </dd>
          </div>
        ) : (
          <div>
            <dt>{d.kpiTotalValuation}</dt>
            <dd className="ad-num">
              {last
                ? fmtCurrency(last.value, "IDR", locale, money.formatExact)
                : "—"}
            </dd>
          </div>
        )}
        <div>
          <dt>{d.kpiValue}</dt>
          <dd className="ad-num">{fmt(state.currentValueIdr)}</dd>
        </div>
        <div className="ad-kpi-pnl">
          <dt>
            {d.kpiUnrealized} <span>{d.kpiSincePurchase}</span>
          </dt>
          <dd className="ad-num" data-tone={tone}>
            {pnl ? signedIdr(pnl.amount, money.formatExact) : "—"}
            {pnl && pnl.percent !== null && (
              <span className="ad-pill" data-tone={tone}>
                {fmtPctSigned(pnl.percent, locale)}
              </span>
            )}
            {pnl && tone !== "flat" && (
              <span className="sr-only">{tone === "up" ? d.up : d.down}</span>
            )}
          </dd>
        </div>
        {state.realizedPnlIdr !== null && (
          <div>
            <dt>{d.kpiRealized}</dt>
            <dd className="ad-num" data-tone={toneOf(state.realizedPnlIdr)}>
              {signedIdr(state.realizedPnlIdr, money.formatExact)}
            </dd>
          </div>
        )}
      </dl>
      <p className="ad-valuation-line">
        <span>
          <Clock aria-hidden="true" />
          {last
            ? fillCopy(d.lastValuation, {
                when: fmtWhenLong(last, locale, d),
              })
            : d.noValuation}
        </span>
        {last && (
          <span>
            <PencilLine aria-hidden="true" />
            {fillCopy(d.source, { source: sourceLabel(last.source, d) })}
          </span>
        )}
      </p>
    </section>
  );
}
