import { SectionCard } from "@/components/wm";
import { useMoney } from "@/hooks/use-money";
import { useLocale } from "@/hooks/use-locale";
import type { DetailReportDto } from "@wealthme/contracts";
import { formatLocaleDateShort } from "../date-helpers";
import "./sections-b.css";

/* ───────────────────────── Section: Detail ───────────────────────── */

// A small, stable palette for the ledger's category dot — deterministic by
// name hash so the same category always gets the same dot colour within a
// session, without needing a server-provided colour per category.
const DOT_PALETTE = [
  "var(--wm-lime)",
  "var(--wm-orange)",
  "var(--primary)",
  "var(--brand-purple, #8B5CF6)",
  "var(--brand-cyan, #06B6D4)",
  "var(--warning)",
];
function dotColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return DOT_PALETTE[Math.abs(hash) % DOT_PALETTE.length];
}

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

  const totalIn = txs.reduce(
    (sum, tx) => (tx.type === "income" ? sum + tx.amount : sum),
    0,
  );
  const totalOut = txs.reduce(
    (sum, tx) => (tx.type === "expense" ? sum + tx.amount : sum),
    0,
  );
  const net = totalIn - totalOut;

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      {txs.length > 0 && (
        <div className="lpb-kpi-strip">
          <div className="lpb-kpi">
            <div className="lpb-kpi-l">{t.common.income}</div>
            <div className="lpb-kpi-v text-success">
              +{money.formatCompact(totalIn)}
            </div>
          </div>
          <div className="lpb-kpi">
            <div className="lpb-kpi-l">{t.common.expense}</div>
            <div className="lpb-kpi-v text-destructive">
              -{money.formatCompact(totalOut)}
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
              {money.formatCompact(net)}
            </div>
          </div>
        </div>
      )}
      <SectionCard title={t.laporan.detail.title}>
        <div className="w-full overflow-x-auto [mask-image:linear-gradient(to_left,transparent,black_24px)]">
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
                txs.map((tx) => {
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
                              : "text-destructive")
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
      </SectionCard>
    </div>
  );
}
