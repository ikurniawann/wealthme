import { useState } from "react";
import Link from "next/link";
import { Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useMoney } from "@/hooks/use-money";
import { useLocale } from "@/hooks/use-locale";
import type { CoaMatrixDto } from "@wealthme/contracts";
import type { CoaAccountOption } from "../types";
import {
  COA_DAYS,
  COA_MONTHS,
  activeDays,
  cellTxs,
  coaDayHref,
  maxCellMagnitude,
  monthSummaries,
  sumTxs,
  tintLevel,
} from "./coa-matrix-model";
import { CoaSummaryView } from "./coa-summary-view";
import "./sections-b.css";

type CoaView = "matrix" | "summary";

/* ───────────────────────── COA Matrix Section ───────────────────────── */

// EPIC-024 Task M (M2, D16, US-RPT-14) — Laporan COA: yearly matrix per COA
// account, columns Jan-Des, rows tanggal 1-31. A filled cell links to
// /transaksi filtered to this COA account and that single day.

const COA_MATRIX_YEAR_WINDOW = 6;

// NOTE: a `buildDemoCoaMatrix` used to live here, fabricating 15 transactions
// with plausible Indonesian descriptions and amounts ("Gaji bulanan"
// Rp 9.000.000, "Cicilan" Rp 1.070.000, ~Rp 24 jt in total) whenever the API
// returned an empty matrix. It was rendered inside a FINANCIAL REPORT, next to
// real figures, in the same styling — a warning notice above it did not undo
// that. Invented money in a report is worse than an empty report, so the
// fallback is gone and an empty matrix now says it is empty.

export function CoaSection({
  coaAccounts,
  coaAccountId,
  onCoaAccountIdChange,
  year,
  onYearChange,
  matrix,
  isLoading,
}: {
  coaAccounts: CoaAccountOption[];
  coaAccountId: string;
  onCoaAccountIdChange: (id: string) => void;
  year: number;
  onYearChange: (year: number) => void;
  matrix?: CoaMatrixDto;
  isLoading?: boolean;
}) {
  const { t } = useLocale();
  const money = useMoney();
  const currentYear = new Date().getFullYear();
  const monthShortLabels = t.laporan.months.map((label) => label.slice(0, 3));
  const yearOptions = Array.from(
    { length: COA_MATRIX_YEAR_WINDOW },
    (_, i) => currentYear - (COA_MATRIX_YEAR_WINDOW - 2) + i,
  );

  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const selectedAccountId = coaAccountId || coaAccounts[0]?.id || "";
  // The server's matrix, or an empty one. Never a stand-in.
  const displayMatrix: CoaMatrixDto = matrix ?? {
    coaAccountId: selectedAccountId,
    year,
    total: 0,
    cells: {},
  };
  const hasCells = Object.keys(displayMatrix.cells).length > 0;
  const [fullscreen, setFullscreen] = useState(false);
  const [view, setView] = useState<CoaView>("matrix");
  const [showAllDays, setShowAllDays] = useState(false);
  // The prototype's "N transaksi" counter — every stacked amount in every
  // cell, not the number of filled cells (a day can hold several).
  const txCount = Object.values(displayMatrix.cells).reduce(
    (sum, byDay) =>
      sum + Object.values(byDay).reduce((n, txs) => n + txs.length, 0),
    0,
  );

  const months = monthSummaries(displayMatrix);
  const maxMagnitude = maxCellMagnitude(displayMatrix);
  const visibleDays = showAllDays ? COA_DAYS : activeDays(displayMatrix);

  // Prototype parity (docs/prototype/pages/laporan.html, panel rcoa): the
  // matrix table is rendered once and reused inside the fullscreen dialog the
  // "Perbesar" button opens, so the two can never drift apart. It keeps the
  // day x month shape of the Excel export, but leads with a per-month TOTAL
  // row and, by default, drops days with no transaction in any month.
  const matrixTable = (
    <table className="coa-matrix coa-matrix--compact">
      <thead>
        <tr>
          <th scope="col" className="coa-date">
            {t.laporan.coa.colTanggal}
          </th>
          {monthShortLabels.map((label) => (
            <th key={label} scope="col">
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr className="coa-total-row">
          <th scope="row" className="coa-date">
            {t.laporan.coa.totalRowLabel}
          </th>
          {months.map((m) => (
            <td key={m.month} className="coa-cell mono">
              {m.count > 0 ? money.formatCompact(m.total) : "–"}
            </td>
          ))}
        </tr>
        {visibleDays.map((day) => (
          <tr key={day}>
            <th scope="row" className="coa-date">
              {day}
            </th>
            {COA_MONTHS.map((month) => {
              const txs = cellTxs(displayMatrix, month, day);
              if (txs.length === 0) {
                return <td key={month} className="coa-cell" />;
              }
              const level = tintLevel(sumTxs(txs), maxMagnitude);
              return (
                <td
                  key={month}
                  className={`coa-cell coa-cell--filled coa-cell--t${level}`}
                >
                  {/* The prototype stacks EVERY amount in the cell rather than
                      collapsing them to one sum with an "(3x)" suffix — one
                      `.coa-amt` line per transaction. */}
                  <Link
                    className="coa-cell__btn"
                    href={coaDayHref(selectedAccountId, year, month, day)}
                    aria-label={`${t.laporan.coa.viewTxAriaPrefix} ${day} ${t.laporan.months[month - 1]} ${year}`}
                  >
                    {txs.map((tx) => (
                      <span key={tx.txId} className="coa-amt mono">
                        {money.formatCompact(tx.amount)}
                      </span>
                    ))}
                  </Link>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );

  const selectedAccount =
    coaAccounts.find((a) => a.id === selectedAccountId) ?? coaAccounts[0];
  const matrixTitle = selectedAccount
    ? `${selectedAccount.code} · ${selectedAccount.name} — ${year}`
    : `${t.laporan.coa.title} — ${year}`;

  return (
    <div className={"stack " + loadingClass}>
      {/* ── Card 1: filters + yearly total + hint ───────────────────────── */}
      <article className="card">
        <div className="card__header">
          <h2 className="card__title">{t.laporan.coa.cardTitle}</h2>
          <span className="card__action badge badge--purple coa-new">
            {t.laporan.coa.newBadge}
          </span>
        </div>
        <div className="card__body">
          <div
            className="row row--wrap"
            style={{ gap: 12, alignItems: "flex-end" }}
          >
            <label className="field" style={{ minWidth: 260 }}>
              <span className="label">{t.laporan.coa.accountLabel}</span>
              <select
                className="select"
                value={coaAccountId}
                onChange={(e) => {
                  onCoaAccountIdChange(e.target.value);
                }}
              >
                <option value="">{t.laporan.coa.accountPlaceholder}</option>
                {coaAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.code} · {acc.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" style={{ minWidth: 130 }}>
              <span className="label">{t.laporan.coa.yearLabel}</span>
              <select
                className="select"
                value={year}
                onChange={(e) => {
                  onYearChange(Number(e.target.value));
                }}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <div className="spacer" />
            <div style={{ textAlign: "right" }}>
              <div className="t-xs t-muted">{t.laporan.coa.totalYearLabel}</div>
              <div className="stat__value mono t-primary">
                {money.format(displayMatrix.total)}
              </div>
              <div className="t-xs t-muted">
                {txCount} {t.laporan.coa.txCountSuffix}
              </div>
            </div>
          </div>

          <div className="hint" style={{ marginTop: 10 }}>
            {t.laporan.coa.matrixHint}
          </div>
        </div>
      </article>

      {/* ── Card 2: the matrix itself ───────────────────────────────────── */}
      {!selectedAccountId ? (
        <article className="card">
          <div className="card__body">
            <div className="empty t-sm t-muted">
              {t.laporan.coa.emptyAccount}
            </div>
          </div>
        </article>
      ) : (
        <article className="card">
          <div className="card__header row--between coa-card-head">
            <h2 className="card__title">{matrixTitle}</h2>
            <div
              className="segmented"
              role="radiogroup"
              aria-label={t.laporan.coa.viewLabel}
            >
              {(["matrix", "summary"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={view === v}
                  className="segmented__item"
                  onClick={() => setView(v)}
                >
                  {v === "matrix"
                    ? t.laporan.coa.viewMatrix
                    : t.laporan.coa.viewSummary}
                </button>
              ))}
            </div>
          </div>
          <div className="card__body">
            {!hasCells ? (
              <div className="empty t-sm t-muted">
                {t.laporan.coa.emptyMatrix}
              </div>
            ) : view === "summary" ? (
              <CoaSummaryView
                months={months}
                year={year}
                yearTotal={displayMatrix.total}
                txCount={txCount}
              />
            ) : (
              <>
                <div className="coa-matrix-tools">
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    aria-pressed={showAllDays}
                    onClick={() => setShowAllDays((v) => !v)}
                  >
                    {showAllDays
                      ? t.laporan.coa.hideEmptyDays
                      : t.laporan.coa.showAllDays}
                  </button>
                  <span className="t-xs t-muted">
                    {t.laporan.coa.scrollHint}
                  </span>
                  <div className="spacer" />
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    onClick={() => setFullscreen(true)}
                    aria-label={t.laporan.coa.expandAriaLabel}
                  >
                    <Maximize2 size={15} />
                    {t.laporan.coa.expandButton}
                  </button>
                </div>
                <div className="coa-table-wrap">{matrixTable}</div>
              </>
            )}
          </div>
        </article>
      )}

      {/* ── "Perbesar" fullscreen view ──────────────────────────────────── */}
      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="dialog--fullscreen min-[769px]:w-[min(1200px,calc(100%-2rem))]">
          <DialogTitle>{matrixTitle}</DialogTitle>
          <div className="coa-table-wrap" style={{ maxHeight: "70dvh" }}>
            {matrixTable}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
