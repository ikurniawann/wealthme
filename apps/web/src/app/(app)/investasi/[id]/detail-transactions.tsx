"use client";
import { useState } from "react";
import type {
  InvestmentTransactionDto,
  InvestmentValuationDto,
} from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { money } from "../portfolio-model";
import { add } from "../decimal";
import { LedgerCorrection } from "../ledger-correction";
export function DetailTransactions({
  rows,
  valuation: v,
  fg,
  token,
  canManage,
  onSaved,
  section = "all",
}: {
  rows: InvestmentTransactionDto[];
  valuation: InvestmentValuationDto;
  fg: string;
  token: string;
  canManage: boolean;
  onSaved: () => void;
  section?: "all" | "income" | "sales";
}) {
  const { t, locale } = useLocale();
  const c = t.investasi.v3;
  const f = t.investasi.forms;
  const d = t.investasi.detail;
  const { hideBalance } = useMoney();
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<{
    row: InvestmentTransactionDto;
    voiding: boolean;
  } | null>(null);
  const selected =
    section === "all"
      ? rows
      : rows.filter(
          (r) =>
            r.status !== "void" &&
            (section === "sales"
              ? r.kind === "sell"
              : ["dividend", "coupon", "interest"].includes(r.kind ?? "")),
        );
  const pages = Math.max(1, Math.ceil(selected.length / 20));
  const current = Math.min(page, pages);
  const fmt = (n: string | null | undefined, currency = "IDR") =>
    money(n, currency, locale, hideBalance);
  return (
    <section className="iv-card">
      <h2>
        {section === "income"
          ? d.income
          : section === "sales"
            ? d.realized
            : d.transactions}
      </h2>
      {section === "sales" && (
        <strong>
          {fmt(
            selected.length === 0 && v.costBasisKnown !== false
              ? "0"
              : v.realizedIdr,
          )}
        </strong>
      )}
      {section === "income" && <strong>{fmt(v.incomeIdr)}</strong>}
      {!selected.length ? (
        <p className="iv-empty">
          {section === "income"
            ? d.noIncome
            : section === "sales"
              ? d.noSales
              : d.noTransactions}
        </p>
      ) : (
        <div className="iv-table-scroll">
          <table className="iv-detail-table">
            <thead>
              <tr>
                <th>{f.date}</th>
                <th>{f.kind}</th>
                <th>{f.quantity}</th>
                <th>{d.unitPrice}</th>
                <th>{d.gross}</th>
                <th>{d.fees}</th>
                <th>{section === "sales" ? d.realized : d.net}</th>
                <th>{f.status}</th>
                {canManage && <th>{c.actions}</th>}
              </tr>
            </thead>
            <tbody>
              {selected.slice((current - 1) * 20, current * 20).map((r) => {
                const kind = r.kind ?? r.type ?? "opening";
                const unknown =
                  r.costBasisKnown === false && kind === "opening";
                return (
                  <tr key={r.id}>
                    <td>
                      {r.effectiveDate ?? r.occurredAt.slice(0, 10)}
                      <small>
                        {r.effectiveTime ?? "—"} ·{" "}
                        {r.timeZone ?? "Asia/Jakarta"}
                      </small>
                      {r.settlementDate && (
                        <small>
                          {d.settlement}: {r.settlementDate}
                        </small>
                      )}
                    </td>
                    <td>
                      {c[kind]}
                      {r.note && <small>{r.note}</small>}
                    </td>
                    <td>{hideBalance ? "••••" : r.quantity}</td>
                    <td>
                      {unknown ||
                      [
                        "dividend",
                        "interest",
                        "coupon",
                        "corporate_action",
                      ].includes(kind)
                        ? "—"
                        : v.bond?.convention === "percent_of_par"
                          ? hideBalance
                            ? "••••"
                            : `${r.pricePerUnit}%`
                          : fmt(r.pricePerUnit, r.currency)}
                    </td>
                    <td>{unknown ? "—" : fmt(r.grossAmount, r.currency)}</td>
                    <td>{fmt(add(r.fee ?? "0", r.tax ?? "0"), r.currency)}</td>
                    <td>
                      {unknown
                        ? "—"
                        : fmt(
                            section === "sales" ? r.realizedPnl : r.netAmount,
                            section === "sales" ? "IDR" : r.currency,
                          )}
                    </td>
                    <td>
                      {r.status === "void"
                        ? c.void
                        : r.settlementDate &&
                            r.settlementDate >
                              new Date().toLocaleDateString("sv-SE", {
                                timeZone: "Asia/Jakarta",
                              })
                          ? c.pending
                          : c.settled}
                    </td>
                    {canManage && (
                      <td>
                        {r.status !== "void" && (
                          <div className="iv-row-actions">
                            <button
                              className="btn btn--outline btn--sm"
                              onClick={() =>
                                setEdit({ row: r, voiding: false })
                              }
                            >
                              {unknown ? d.completeBasis : f.edit}
                            </button>
                            <button
                              className="btn btn--outline btn--sm"
                              onClick={() => setEdit({ row: r, voiding: true })}
                            >
                              {f.voidAction}
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav className="iv-pagination" aria-label={c.page}>
          <button
            className="btn btn--outline"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
          >
            {c.previous}
          </button>
          <span>
            {current} / {pages}
          </span>
          <button
            className="btn btn--outline"
            disabled={current >= pages}
            onClick={() => setPage(current + 1)}
          >
            {c.next}
          </button>
        </nav>
      )}
      {edit && (
        <LedgerCorrection
          row={edit.row}
          voiding={edit.voiding}
          fg={fg}
          token={token}
          onClose={() => setEdit(null)}
          onSaved={onSaved}
          percentPrice={v.bond?.convention === "percent_of_par"}
          holdingCurrency={v.holdingCurrency}
        />
      )}
    </section>
  );
}
