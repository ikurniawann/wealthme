"use client";

import { useState } from "react";
import {
  ArrowRight,
  FileText,
  Minus,
  PencilLine,
  Plus,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import type {
  AssetHistoryEventDto,
  AssetHistoryKind,
  AssetTransactionDto,
} from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { fillCopy } from "../aset-model";
import { changeText } from "./detail-summary";
import {
  fmtClock,
  fmtCurrency,
  fmtDay,
  idr,
  signedIdr,
  sourceLabel,
  toneOf,
  withUnit,
} from "./detail-model";

type Filter = "all" | "buy" | "sell" | "valuation";
const FILTER_KINDS: Record<Filter, AssetHistoryKind[] | null> = {
  all: null,
  buy: ["buy"],
  sell: ["sell"],
  valuation: ["valuation", "correction"],
};
const KIND_ICON: Record<AssetHistoryKind, LucideIcon> = {
  opening: FileText,
  valuation: PencilLine,
  correction: Undo2,
  buy: Plus,
  sell: Minus,
  quantity_change: FileText,
};

function When({ ev }: { ev: AssetHistoryEventDto }) {
  const { t, locale } = useLocale();
  const d = t.aset.v3.detail;
  return (
    <div className="ad-when">
      <strong>{fmtDay(ev.effectiveDate, locale)}</strong>
      <small>{ev.hasTime ? fmtClock(ev, locale) : d.dateOnly}</small>
    </div>
  );
}

function QtyCell({ ev }: { ev: AssetHistoryEventDto }) {
  const { locale } = useLocale();
  const before = ev.quantityBefore;
  const after = ev.quantityAfter;
  if (after == null) return <>—</>;
  if (
    before != null &&
    before !== after &&
    (ev.kind === "buy" || ev.kind === "sell")
  )
    return (
      <span className="ad-num">
        {withUnit(before, null, locale)}
        <ArrowRight aria-hidden="true" className="ad-arrow" />
        {withUnit(after, ev.unit, locale)}
      </span>
    );
  return <span className="ad-num">{withUnit(after, ev.unit, locale)}</span>;
}

function ValueCell({ ev }: { ev: AssetHistoryEventDto }) {
  const { locale } = useLocale();
  const money = useMoney();
  const change = changeText(
    ev.changeIdr,
    ev.changePercent,
    locale,
    money.formatExact,
  );
  return (
    <div className="ad-valcell">
      <span className="ad-num">
        {ev.valueBefore != null ? money.formatExact(idr(ev.valueBefore)) : "—"}
        <ArrowRight aria-hidden="true" className="ad-arrow" />
        <strong>{money.formatExact(idr(ev.value))}</strong>
      </span>
      {change && (
        <small className="ad-num" data-tone={toneOf(ev.changeIdr)}>
          {change}
        </small>
      )}
    </div>
  );
}

/**
 * "Riwayat aset" — every stored event, newest first by effective order
 * (A4), with Semua / Beli / Jual / Valuasi filters. A table on wide
 * screens, cards below 640px. Voided rows stay visible, struck through.
 */
export function HistoryCard({
  events,
  unit,
  valueOnly = false,
}: {
  events: AssetHistoryEventDto[];
  unit: string | null;
  valueOnly?: boolean;
}) {
  const { t, locale } = useLocale();
  const d = t.aset.v3.detail;
  const money = useMoney();
  const [filter, setFilter] = useState<Filter>("all");
  const kinds = valueOnly
    ? (["opening", "valuation", "correction"] as AssetHistoryKind[])
    : FILTER_KINDS[filter];
  const rows = kinds ? events.filter((e) => kinds.includes(e.kind)) : events;
  const unitLabel = unit ?? "unit";
  const filters: [Filter, string][] = [
    ["all", d.filterAll],
    ["buy", d.filterBuy],
    ["sell", d.filterSell],
    ["valuation", d.filterValuation],
  ];
  const priceOf = (ev: AssetHistoryEventDto) =>
    ev.pricePerUnit
      ? fmtCurrency(ev.pricePerUnit, ev.currency, locale, money.formatExact)
      : "—";
  const recorder = (ev: AssetHistoryEventDto) => ev.recordedByName ?? d.system;
  return (
    <section className="ad-card ad-history" aria-labelledby="ad-hist-title">
      <div className="ad-card-head">
        <h2 id="ad-hist-title">
          {valueOnly ? d.historyValueTitle : d.historyTitle}
        </h2>
      </div>
      {!valueOnly && (
        <div className="ad-filters" role="group" aria-label={d.filtersAria}>
          {filters.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {events.length === 0 ? (
        <p className="ad-empty">{d.historyEmpty}</p>
      ) : rows.length === 0 ? (
        <p className="ad-empty">{d.filterEmpty}</p>
      ) : (
        <>
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th scope="col">{d.colWhen}</th>
                  <th scope="col">{d.colActivity}</th>
                  <th scope="col">{d.colQty}</th>
                  <th scope="col">
                    {fillCopy(d.colPrice, { unit: unitLabel })}
                  </th>
                  <th scope="col">{d.colValue}</th>
                  <th scope="col">{d.colSource}</th>
                  <th scope="col">{d.colRecorder}</th>
                  <th scope="col">{d.colNote}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((ev) => {
                  const Icon = KIND_ICON[ev.kind] ?? FileText;
                  return (
                    <tr
                      key={ev.id}
                      data-void={ev.status === "void" || undefined}
                    >
                      <td>
                        <When ev={ev} />
                      </td>
                      <td>
                        <span className="ad-kind" data-kind={ev.kind}>
                          <i aria-hidden="true">
                            <Icon />
                          </i>
                          {d.kinds[ev.kind]}
                          {ev.status === "void" && (
                            <em className="ad-void">{d.voided}</em>
                          )}
                        </span>
                      </td>
                      <td>
                        <QtyCell ev={ev} />
                      </td>
                      <td className="ad-num">{priceOf(ev)}</td>
                      <td>
                        <ValueCell ev={ev} />
                      </td>
                      <td>
                        {sourceLabel(ev.source, d)}
                        {ev.reference && <small>{ev.reference}</small>}
                      </td>
                      <td>{recorder(ev)}</td>
                      <td className="ad-note-cell">{ev.note ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul className="ad-cards">
            {rows.map((ev) => {
              const Icon = KIND_ICON[ev.kind] ?? FileText;
              return (
                <li key={ev.id} data-void={ev.status === "void" || undefined}>
                  <div className="ad-cards-top">
                    <span className="ad-kind" data-kind={ev.kind}>
                      <i aria-hidden="true">
                        <Icon />
                      </i>
                      {d.kinds[ev.kind]}
                      {ev.status === "void" && (
                        <em className="ad-void">{d.voided}</em>
                      )}
                    </span>
                    <When ev={ev} />
                  </div>
                  <ValueCell ev={ev} />
                  <dl>
                    <div>
                      <dt>{d.colQty}</dt>
                      <dd>
                        <QtyCell ev={ev} />
                      </dd>
                    </div>
                    <div>
                      <dt>{fillCopy(d.colPrice, { unit: unitLabel })}</dt>
                      <dd className="ad-num">{priceOf(ev)}</dd>
                    </div>
                    <div>
                      <dt>{d.colSource}</dt>
                      <dd>
                        {sourceLabel(ev.source, d)}
                        {ev.reference ? ` · ${ev.reference}` : ""}
                      </dd>
                    </div>
                    <div>
                      <dt>{d.colRecorder}</dt>
                      <dd>{recorder(ev)}</dd>
                    </div>
                    {ev.note && (
                      <div>
                        <dt>{d.colNote}</dt>
                        <dd>{ev.note}</dd>
                      </div>
                    )}
                  </dl>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

/** Transaksi tab: buys/sells/opening with fee and the cash leg (§9). */
export function TransactionsCard({
  transactions,
  unit,
  accountName,
}: {
  transactions: AssetTransactionDto[];
  unit: string | null;
  accountName: (id: string | null) => string;
}) {
  const { t, locale } = useLocale();
  const d = t.aset.v3.detail;
  const money = useMoney();
  const rows = [...transactions].sort((a, b) =>
    `${b.effectiveDate} ${b.effectiveTime ?? ""} ${b.createdAt}`.localeCompare(
      `${a.effectiveDate} ${a.effectiveTime ?? ""} ${a.createdAt}`,
    ),
  );
  const cash = (tx: AssetTransactionDto) => {
    if (!tx.cashAccountId || !tx.netAmount) return d.txNoCash;
    const amount = fmtCurrency(
      tx.netAmount,
      tx.currency,
      locale,
      money.formatExact,
    );
    return `${tx.kind === "buy" ? "−" : "+"}${amount} ${tx.kind === "buy" ? d.txCashOut : d.txCashIn}`;
  };
  return (
    <section className="ad-card ad-history" aria-labelledby="ad-tx-title">
      <div className="ad-card-head">
        <h2 id="ad-tx-title">{d.txTitle}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="ad-empty">{d.txEmpty}</p>
      ) : (
        <ul className="ad-tx-list">
          {rows.map((tx) => (
            <li key={tx.id} data-void={tx.status === "void" || undefined}>
              <div className="ad-cards-top">
                <span className="ad-kind" data-kind={tx.kind}>
                  <i aria-hidden="true">
                    {tx.kind === "sell" ? (
                      <Minus />
                    ) : tx.kind === "buy" ? (
                      <Plus />
                    ) : (
                      <FileText />
                    )}
                  </i>
                  {d.kinds[tx.kind]}
                  {tx.status === "void" && (
                    <em className="ad-void">{d.voided}</em>
                  )}
                </span>
                <div className="ad-when">
                  <strong>{fmtDay(tx.effectiveDate, locale)}</strong>
                  <small>
                    {tx.effectiveTime
                      ? `${tx.effectiveTime} ${tx.timeZone ?? "Asia/Jakarta"}`
                      : d.dateOnly}
                  </small>
                </div>
              </div>
              <dl>
                <div>
                  <dt>{d.colQty}</dt>
                  <dd className="ad-num">
                    {withUnit(tx.quantity, unit, locale)}
                  </dd>
                </div>
                <div>
                  <dt>{fillCopy(d.colPrice, { unit: unit ?? "unit" })}</dt>
                  <dd className="ad-num">
                    {tx.pricePerUnit
                      ? fmtCurrency(
                          tx.pricePerUnit,
                          tx.currency,
                          locale,
                          money.formatExact,
                        )
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>{d.txGross}</dt>
                  <dd className="ad-num">
                    {tx.grossAmount
                      ? fmtCurrency(
                          tx.grossAmount,
                          tx.currency,
                          locale,
                          money.formatExact,
                        )
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>{d.txFee}</dt>
                  <dd className="ad-num">
                    {fmtCurrency(
                      tx.fee,
                      tx.currency,
                      locale,
                      money.formatExact,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{d.txNet}</dt>
                  <dd
                    className="ad-num"
                    data-tone={
                      tx.kind === "sell"
                        ? "up"
                        : tx.kind === "buy"
                          ? "down"
                          : undefined
                    }
                  >
                    {cash(tx)}
                  </dd>
                </div>
                <div>
                  <dt>{d.txAccount}</dt>
                  <dd>{accountName(tx.cashAccountId)}</dd>
                </div>
                {tx.realizedPnlIdr !== null && (
                  <div>
                    <dt>{d.txRealized}</dt>
                    <dd
                      className="ad-num"
                      data-tone={toneOf(tx.realizedPnlIdr)}
                    >
                      {signedIdr(tx.realizedPnlIdr, money.formatExact)}
                    </dd>
                  </div>
                )}
                {tx.note && (
                  <div>
                    <dt>{d.colNote}</dt>
                    <dd>{tx.note}</dd>
                  </div>
                )}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
