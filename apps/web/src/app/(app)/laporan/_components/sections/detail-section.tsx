import { SectionCard, StatusBadge } from "@/components/wm";
import { useMoney } from "@/hooks/use-money";
import { txTypeToBadgeVariant } from "@/lib/laporan-utils";
import { useLocale } from "@/hooks/use-locale";
import type { DetailReportDto } from "@wealthme/contracts";
import { formatLocaleDateShort } from "../date-helpers";

/* ───────────────────────── Section: Detail ───────────────────────── */

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

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[15px] font-bold">{t.laporan.detail.title}</div>
      </div>
      <SectionCard>
        <div className="w-full overflow-x-auto [mask-image:linear-gradient(to_left,transparent,black_24px)]">
          <table className="min-w-[580px] w-full text-[12.5px]">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 font-semibold">
                  {t.laporan.detail.colDate}
                </th>
                <th className="py-2 font-semibold">
                  {t.laporan.detail.colDesc}
                </th>
                <th className="py-2 font-semibold">
                  {t.laporan.detail.colCategory}
                </th>
                <th className="py-2 font-semibold">
                  {t.laporan.detail.colAccount}
                </th>
                <th className="py-2 text-right font-semibold">
                  {t.laporan.detail.colAmount}
                </th>
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
                  return (
                    <tr key={tx.id} className="border-b last:border-0">
                      <td className="mono py-2.5">{tgl}</td>
                      <td className="py-2.5">{tx.description ?? "—"}</td>
                      <td className="py-2.5">
                        <StatusBadge variant={txTypeToBadgeVariant(tx.type)}>
                          {tx.categoryName ?? tx.type}
                        </StatusBadge>
                      </td>
                      <td className="py-2.5">{tx.accountName ?? "—"}</td>
                      <td
                        className={
                          "mono py-2.5 text-right " +
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
                    colSpan={5}
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
