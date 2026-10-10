import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useMoney } from "@/hooks/use-money";
import { useLocale } from "@/hooks/use-locale";
import { coaTxHref, type CoaMonthSummary } from "./coa-matrix-model";

// "Ringkas" view of the Ringkasan COA tab: one row per month with a bar
// proportional to that month's total, expandable into the month's
// transactions. Sparse accounts read at a glance here, where the day x month
// matrix is mostly empty cells.

export function CoaSummaryView({
  months,
  year,
  yearTotal,
  txCount,
}: {
  months: CoaMonthSummary[];
  year: number;
  yearTotal: number;
  txCount: number;
}) {
  const { t } = useLocale();
  const money = useMoney();
  const copy = t.laporan.coa;
  const [openMonth, setOpenMonth] = useState<number | null>(null);

  const activeMonths = months.filter((m) => m.count > 0);
  const average = activeMonths.length > 0 ? yearTotal / activeMonths.length : 0;
  const maxTotal = Math.max(0, ...months.map((m) => Math.abs(m.total)));
  const monthShort = t.laporan.months.map((label) => label.slice(0, 3));

  return (
    <div className="coa-summary">
      <div className="lpb-kpi-strip">
        <div className="lpb-kpi">
          <div className="lpb-kpi-l">{copy.totalYearLabel}</div>
          <div className="lpb-kpi-v mono">{money.format(yearTotal)}</div>
        </div>
        <div className="lpb-kpi">
          <div className="lpb-kpi-l">{copy.kpiAvgActiveMonth}</div>
          <div className="lpb-kpi-v mono">{money.format(average)}</div>
        </div>
        <div className="lpb-kpi">
          <div className="lpb-kpi-l">{copy.kpiTxCount}</div>
          <div className="lpb-kpi-v mono">{txCount}</div>
        </div>
      </div>

      <ul className="coa-months" aria-label={copy.summaryListLabel}>
        {months.map((m) => {
          const label = t.laporan.months[m.month - 1];
          const isEmpty = m.count === 0;
          const isOpen = openMonth === m.month && !isEmpty;
          const width = maxTotal > 0 ? (Math.abs(m.total) / maxTotal) * 100 : 0;
          const listId = `coa-month-${m.month}-txs`;
          return (
            <li key={m.month} className="coa-month">
              <button
                type="button"
                className="coa-month__row"
                disabled={isEmpty}
                aria-expanded={isEmpty ? undefined : isOpen}
                aria-controls={isEmpty ? undefined : listId}
                onClick={() => setOpenMonth(isOpen ? null : m.month)}
              >
                <span className="coa-month__name">{label}</span>
                <span className="coa-month__track" aria-hidden="true">
                  <span
                    className="coa-month__bar"
                    style={{ width: `${width}%` }}
                  />
                </span>
                {isEmpty ? (
                  <span className="coa-month__empty t-xs t-muted">
                    {copy.summaryNoData}
                  </span>
                ) : (
                  <>
                    <span className="coa-month__total mono">
                      {money.format(m.total)}
                    </span>
                    <span className="coa-month__count t-xs t-muted">
                      {m.count} {copy.trxSuffix}
                    </span>
                  </>
                )}
                <ChevronDown
                  size={15}
                  aria-hidden="true"
                  className="coa-month__chev"
                />
              </button>
              {isOpen && (
                <ul id={listId} className="coa-month__txs">
                  {m.txs.map((tx) => (
                    <li key={tx.txId}>
                      <Link
                        className="coa-month__tx"
                        href={coaTxHref(tx.txId, year, m.month, tx.day)}
                        aria-label={`${copy.viewTxAriaPrefix} ${tx.day} ${label} ${year}: ${tx.description ?? copy.dialogNoDesc}, ${money.format(tx.amount)}`}
                      >
                        <span className="coa-month__tx-date mono t-xs t-muted">
                          {tx.day} {monthShort[m.month - 1]}
                        </span>
                        <span className="coa-month__tx-desc">
                          {tx.description ?? copy.dialogNoDesc}
                        </span>
                        <span className="coa-month__tx-amt mono">
                          {money.format(tx.amount)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
