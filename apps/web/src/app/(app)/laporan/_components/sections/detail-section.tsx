import { useRef, useState } from "react";
import { PillButton, SectionCard } from "@/components/wm";
import { useMoney } from "@/hooks/use-money";
import { useLocale } from "@/hooks/use-locale";
import type { DetailReportDto } from "@wealthme/contracts";
import { formatLocaleDateShort } from "../date-helpers";
import { EXPENSE_COLOR, vizByIndex } from "@/lib/viz-colors";
import "./sections-b.css";

/* ───────────────────────── Section: Detail ───────────────────────── */

// Deterministic by name hash so the same category always gets the same dot
// colour within a session, without needing a server-provided colour per
// category.
function dotColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return vizByIndex(Math.abs(hash));
}

const PAGE_SIZE = 25;

export function DetailSection({
  detailReport,
  isLoading,
}: {
  detailReport?: DetailReportDto;
  isLoading?: boolean;
}) {
  const { t, locale } = useLocale();
  const money = useMoney();
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const txs = detailReport?.transactions ?? [];

  // The API's totals classify by COA direction, like every other report and
  // the hero above this strip. Re-summing by raw `tx.type` counted wealth
  // allocations and debt principal as spending (a €2.156 gap on one screen).
  const totalIn = detailReport?.totalIncome ?? 0;
  const totalOut = detailReport?.totalExpense ?? 0;
  const net = totalIn - totalOut;

  // A month of household activity runs to hundreds of rows; render a page
  // at a time. Totals above and the export still cover every row. The page
  // belongs to its period, so switching the range starts from page 1
  // without an effect.
  const periodKey = detailReport
    ? `${detailReport.startDate}|${detailReport.endDate}`
    : "";
  const [paging, setPaging] = useState({ key: periodKey, page: 1 });
  const pages = Math.max(1, Math.ceil(txs.length / PAGE_SIZE));
  const page = Math.min(paging.key === periodKey ? paging.page : 1, pages);
  const first = (page - 1) * PAGE_SIZE;
  const rows = txs.slice(first, first + PAGE_SIZE);
  const tableRef = useRef<HTMLDivElement>(null);
  const goTo = (next: number) => {
    setPaging({ key: periodKey, page: next });
    tableRef.current?.scrollIntoView?.({ block: "nearest" });
  };

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      {txs.length > 0 && (
        <div className="lpb-kpi-strip">
          <div className="lpb-kpi">
            <div className="lpb-kpi-l">{t.common.income}</div>
            <div className="lpb-kpi-v text-success">
              +{money.format(totalIn)}
            </div>
          </div>
          <div className="lpb-kpi">
            <div className="lpb-kpi-l">{t.common.expense}</div>
            <div className="lpb-kpi-v" style={{ color: EXPENSE_COLOR }}>
              -{money.format(totalOut)}
            </div>
          </div>
          <div className="lpb-kpi">
            <div className="lpb-kpi-l">{t.laporan.surplusLabel}</div>
            <div
              className={
                "lpb-kpi-v " + (net >= 0 ? "text-success" : "text-destructive")
              }
            >
              {net >= 0 ? "+" : ""}
              {money.format(net)}
            </div>
          </div>
        </div>
      )}
      <SectionCard title={t.laporan.detail.title}>
        <div
          ref={tableRef}
          className="w-full scroll-mt-24 overflow-x-auto [mask-image:linear-gradient(to_left,transparent,black_24px)]"
        >
          <table className="lpb-ledger min-w-[580px]">
            <thead>
              <tr>
                <th>{t.laporan.detail.colDate}</th>
                <th>{t.laporan.detail.colDesc}</th>
                <th>{t.laporan.detail.colAccount}</th>
                <th className="text-right">{t.laporan.detail.colAmount}</th>
              </tr>
            </thead>
            <tbody>
              {txs.length > 0 ? (
                rows.map((tx) => {
                  const isIncome = tx.type === "income";
                  // EPIC-022 B8 — a transfer is neither income nor expense;
                  // render it neutrally (no +/- sign, muted colour) instead
                  // of a red negative that contradicts its neutral badge.
                  const isTransfer = tx.type === "transfer";
                  const tgl = formatLocaleDateShort(tx.occurredAt, locale);
                  const label = tx.categoryName ?? tx.type;
                  return (
                    <tr key={tx.id}>
                      <td className="mono whitespace-nowrap">{tgl}</td>
                      <td>
                        <div className="lpb-ledger-desc">
                          <span
                            className="lpb-cat-dot"
                            style={{ background: dotColor(label) }}
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <div className="lpb-ledger-desc-text">
                              {tx.description ?? "—"}
                            </div>
                            <div className="lpb-ledger-cat">{label}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-[12px] text-muted-foreground">
                        {tx.accountName ?? "—"}
                      </td>
                      <td
                        className={
                          "lpb-amt mono " +
                          (isTransfer
                            ? "text-muted-foreground"
                            : isIncome
                              ? "text-success"
                              : "")
                        }
                        style={
                          !isTransfer && !isIncome
                            ? { color: EXPENSE_COLOR }
                            : undefined
                        }
                      >
                        {isTransfer ? "" : isIncome ? "+" : "-"}
                        {money.format(tx.amount)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="py-6 text-center text-[12px] text-muted-foreground"
                  >
                    {t.laporan.emptyMonthTransactions}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {txs.length > PAGE_SIZE && (
          <footer className="lpb-pager">
            <span className="wm-cap">
              {t.transaksi.paginationShowingLabel}
              {first + 1}–{first + rows.length}
              {t.transaksi.paginationOfMid}
              {txs.length}
              {t.transaksi.transactionsCountSuffix}
            </span>
            <div>
              <PillButton disabled={page <= 1} onClick={() => goTo(page - 1)}>
                {t.transaksi.paginationPrevButton}
              </PillButton>
              <PillButton
                disabled={page >= pages}
                onClick={() => goTo(page + 1)}
              >
                {t.transaksi.paginationNextButton}
              </PillButton>
            </div>
          </footer>
        )}
      </SectionCard>
    </div>
  );
}
