import { useState } from "react";
import { MoneyStat, SectionCard } from "@/components/wm";
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
  const activeCellTxs =
    activeCell
      ? (displayMatrix.cells[activeCell.month]?.[activeCell.day] ?? [])
      : [];

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="text-[15px] font-bold">{t.laporan.coa.title}</div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1">
          <label
            htmlFor="coa-matrix-account"
            className="text-[11.5px] font-semibold text-muted-foreground"
          >
            {t.laporan.coa.accountLabel}
          </label>
          <select
            id="coa-matrix-account"
            className="w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card"
            value={coaAccountId}
            onChange={(e) => {
              onCoaAccountIdChange(e.target.value);
              setActiveCell(null);
            }}
          >
            <option value="">{t.laporan.coa.accountPlaceholder}</option>
            {coaAccounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.code} — {acc.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="coa-matrix-year"
            className="text-[11.5px] font-semibold text-muted-foreground"
          >
            {t.laporan.coa.yearLabel}
          </label>
          <select
            id="coa-matrix-year"
            className="rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card"
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
        </div>
      </div>

      {!selectedAccountId ? (
        <SectionCard>
          <div className="py-8 text-center text-[13px] text-muted-foreground">
            {t.laporan.coa.emptyAccount}
          </div>
        </SectionCard>
      ) : (
        <>
          <SectionCard>
            <MoneyStat
              label={t.laporan.coa.totalLabel}
              value={formatRupiah(displayMatrix.total)}
            />
            {!hasApiCells && (
              <div className="mt-1 text-[11px] text-muted-foreground">
                Data contoh ditampilkan karena matrix COA dari server masih kosong.
              </div>
            )}
          </SectionCard>

          <SectionCard>
            {!hasCells ? (
              <div className="py-8 text-center text-[13px] text-muted-foreground">
                {t.laporan.coa.emptyMatrix}
              </div>
            ) : (
              <div className="w-full overflow-x-auto [mask-image:linear-gradient(to_left,transparent,black_24px)]">
                <table className="w-full min-w-[900px] text-[11px]">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="sticky left-0 bg-card py-2 pr-2 font-semibold">
                        {t.laporan.coa.colTanggal}
                      </th>
                      {monthShortLabels.map((label) => (
                        <th
                          key={label}
                          className="px-1.5 py-2 text-right font-semibold"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <tr key={day} className="border-b last:border-0">
                        <td className="mono sticky left-0 bg-card py-1.5 pr-2 font-semibold">
                          {day}
                        </td>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(
                          (month) => {
                            const cellTxs =
                              displayMatrix.cells[month]?.[day] ?? [];
                            if (cellTxs.length === 0) {
                              return (
                                <td
                                  key={month}
                                  className="px-1.5 py-1.5 text-right text-muted-foreground"
                                >
                                  —
                                </td>
                              );
                            }
                            const cellTotal = cellTxs.reduce(
                              (s, c) => s + c.amount,
                              0,
                            );
                            return (
                              <td
                                key={month}
                                className="px-1.5 py-1.5 text-right"
                              >
                                <button
                                  type="button"
                                  onClick={() => setActiveCell({ month, day })}
                                  className="mono w-full rounded px-1 py-0.5 text-right font-semibold text-primary hover:bg-accent"
                                >
                                  {formatJuta(cellTotal)}
                                  {cellTxs.length > 1
                                    ? ` (${cellTxs.length}x)`
                                    : ""}
                                </button>
                              </td>
                            );
                          },
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}

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
