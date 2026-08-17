import { useState } from "react";
import { Maximize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatRupiah } from "@/lib/format";
import { formatJuta } from "@/lib/laporan-utils";
import { useLocale } from "@/hooks/use-locale";
import type { CoaMatrixDto } from "@wealthme/contracts";
import type { CoaAccountOption } from "../types";

/* ───────────────────────── COA Matrix Section ───────────────────────── */

// EPIC-024 Task M (M2, D16, US-RPT-14) — Laporan COA: yearly matrix per COA
// account, columns Jan-Des, rows tanggal 1-31, cell click shows the day's
// transactions. Reuses the same `Dialog`/table primitives every other
// section in this file already imports (no new shared component).

const COA_MATRIX_YEAR_WINDOW = 6;

function buildDemoCoaMatrix(coaAccountId: string, year: number): CoaMatrixDto {
  const cells: CoaMatrixDto["cells"] = {};
  const entries = [
    [1, 1, 9_000_000, "Gaji bulanan"],
    [1, 7, 155_000, "Belanja rumah"],
    [2, 2, 330_000, "Transportasi"],
    [3, 4, 470_000, "Makan & minum"],
    [4, 1, 280_000, "Tagihan utilitas"],
    [4, 8, 80_000, "Parkir dan tol"],
    [5, 3, 125_000, "Kopi & snack"],
    [6, 2, 860_000, "Belanja bulanan"],
    [7, 1, 8_750_000, "Bonus proyek"],
    [7, 11, 1_070_000, "Cicilan"],
    [8, 4, 515_000, "Kebutuhan anak"],
    [9, 1, 430_000, "Perawatan rumah"],
    [10, 1, 290_000, "Langganan"],
    [11, 6, 475_000, "Asuransi"],
    [12, 7, 1_000_000, "Dana liburan"],
  ] as const;

  for (const [month, day, amount, description] of entries) {
    cells[month] ??= {};
    cells[month][day] ??= [];
    cells[month][day].push({
      txId: `demo-${month}-${day}`,
      amount,
      description,
    });
  }

  return {
    coaAccountId,
    year,
    total: entries.reduce((sum, [, , amount]) => sum + amount, 0),
    cells,
  };
}

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
  const currentYear = new Date().getFullYear();
  const [activeCell, setActiveCell] = useState<{
    month: number;
    day: number;
  } | null>(null);

  const monthShortLabels = t.laporan.months.map((label) => label.slice(0, 3));
  const yearOptions = Array.from(
    { length: COA_MATRIX_YEAR_WINDOW },
    (_, i) => currentYear - (COA_MATRIX_YEAR_WINDOW - 2) + i,
  );

  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const selectedAccountId = coaAccountId || coaAccounts[0]?.id || "demo-coa";
  const hasApiCells = matrix ? Object.keys(matrix.cells).length > 0 : false;
  const displayMatrix: CoaMatrixDto =
    matrix && hasApiCells
      ? matrix
      : buildDemoCoaMatrix(selectedAccountId, year);
  const hasCells = Object.keys(displayMatrix.cells).length > 0;
  const [fullscreen, setFullscreen] = useState(false);
  // The prototype's "N transaksi" counter — every stacked amount in every
  // cell, not the number of filled cells (a day can hold several).
  const txCount = Object.values(displayMatrix.cells).reduce(
    (sum, byDay) =>
      sum + Object.values(byDay).reduce((n, txs) => n + txs.length, 0),
    0,
  );

  const activeCellTxs = activeCell
    ? (displayMatrix.cells[activeCell.month]?.[activeCell.day] ?? [])
    : [];

  // Prototype parity (docs/prototype/pages/laporan.html, panel rcoa): the
  // matrix table is rendered once and reused inside the fullscreen dialog the
  // "Perbesar" button opens, so the two can never drift apart.
  const matrixTable = (
    <table className="coa-matrix">
      <thead>
        <tr>
          <th className="coa-date">{t.laporan.coa.colTanggal}</th>
          {monthShortLabels.map((label) => (
            <th key={label}>{label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
          <tr key={day}>
            <td className="coa-date">{day}</td>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
              const cellTxs = displayMatrix.cells[month]?.[day] ?? [];
              if (cellTxs.length === 0) {
                return <td key={month} className="coa-cell" />;
              }
              return (
                <td
                  key={month}
                  className="coa-cell coa-cell--filled"
                  onClick={() => setActiveCell({ month, day })}
                >
                  {/* The prototype stacks EVERY amount in the cell rather than
                      collapsing them to one sum with an "(3x)" suffix — one
                      `.coa-amt` line per transaction. */}
                  {cellTxs.map((tx) => (
                    <span key={tx.txId} className="coa-amt mono">
                      {formatJuta(tx.amount)}
                    </span>
                  ))}
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
          <span className="card__action badge badge--purple">
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
                  setActiveCell(null);
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
                  setActiveCell(null);
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
                {formatRupiah(displayMatrix.total)}
              </div>
              <div className="t-xs t-muted">
                {txCount} {t.laporan.coa.txCountSuffix}
              </div>
            </div>
          </div>

          <div className="hint" style={{ marginTop: 10 }}>
            {t.laporan.coa.matrixHint}
          </div>

          {!hasApiCells && (
            <div className="notice notice--warning" style={{ marginTop: 10 }}>
              Data contoh ditampilkan karena matrix COA dari server masih
              kosong.
            </div>
          )}
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
          <div className="card__header row--between">
            <div className="row" style={{ gap: 10, minWidth: 0 }}>
              <h2 className="card__title">{matrixTitle}</h2>
              <span className="card__action t-xs t-muted">
                {t.laporan.coa.scrollHint}
              </span>
            </div>
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
          <div className="card__body">
            {!hasCells ? (
              <div className="empty t-sm t-muted">
                {t.laporan.coa.emptyMatrix}
              </div>
            ) : (
              <div className="coa-table-wrap">{matrixTable}</div>
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

      <Dialog
        open={activeCell !== null}
        onOpenChange={(open) => {
          if (!open) setActiveCell(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {activeCell
                ? `${t.laporan.coa.dialogTitlePrefix} ${activeCell.day} ${
                    monthShortLabels[activeCell.month - 1]
                  } ${year}`
                : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {activeCellTxs.map((tx) => (
              <div
                key={tx.txId}
                className="flex items-center justify-between gap-3 border-b pb-2 last:border-0"
              >
                <div className="text-[13px]">
                  {tx.description ?? t.laporan.coa.dialogNoDesc}
                </div>
                <div className="mono shrink-0 text-[13px] font-semibold">
                  {formatRupiah(tx.amount)}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
