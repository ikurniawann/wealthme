import { SectionCard } from "@/components/wm";
import { formatRupiah } from "@/lib/format";
import { useLocale } from "@/hooks/use-locale";
import type { DetailReportDto } from "@wealthme/contracts";
import { formatLocaleDateLong, formatLocaleTime } from "../date-helpers";
import { ActItem, StatTile } from "../atoms";

/* ───────────────────────── Section: Harian ───────────────────────── */

const TX_ICON: Record<string, string> = {
  income: "📥",
  expense: "🛒",
  transfer: "↔️",
};
const TX_ICON_BG: Record<string, string> = {
  income: "#DCFCE7",
  expense: "#FEF3C7",
  transfer: "#DBEAFE",
};

export function HarianSection({
  dailyReport,
  isLoading,
  date,
  onDateChange,
}: {
  dailyReport?: DetailReportDto;
  isLoading?: boolean;
  date: string;
  onDateChange: (d: string) => void;
}) {
  const { t, locale } = useLocale();
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const net =
    (dailyReport?.totalIncome ?? 0) - (dailyReport?.totalExpense ?? 0);

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[15px] font-bold">
          {t.laporan.harian.titlePrefix}{" "}
          {formatLocaleDateLong(`${date}T00:00:00`, locale)}
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="rounded-md border bg-background px-3 py-[7px] text-[13.5px] outline-none focus:border-primary"
        />
      </div>
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <StatTile
          label={t.laporan.harian.incomeTodayLabel}
          value={dailyReport ? formatRupiah(dailyReport.totalIncome) : "Rp —"}
          valueClass="text-success"
        />
        <StatTile
          label={t.laporan.harian.expenseTodayLabel}
          value={dailyReport ? formatRupiah(dailyReport.totalExpense) : "Rp —"}
          valueClass="text-destructive"
        />
        <StatTile
          label={t.laporan.harian.netDailyLabel}
          value={
            dailyReport ? `${net >= 0 ? "+" : ""}${formatRupiah(net)}` : "Rp —"
          }
          valueClass={net >= 0 ? "text-success" : "text-destructive"}
        />
        <StatTile
          label={t.laporan.harian.txnCountLabel}
          value={dailyReport ? String(dailyReport.count) : "—"}
          valueClass="text-primary"
        />
      </div>
      <SectionCard title={t.laporan.harian.txnTodayTitle}>
        {dailyReport && dailyReport.transactions.length > 0 ? (
          dailyReport.transactions.map((tx, i) => {
            const isIncome = tx.type === "income";
            // EPIC-022 B8 — a transfer is neither income nor expense;
            // render it neutrally (no +/- sign, muted colour) instead of a
            // red negative that contradicts its neutral category badge
            // elsewhere on this page. Same fix as DetailSection below.
            const isTransfer = tx.type === "transfer";
            const time = formatLocaleTime(tx.occurredAt, locale);
            return (
              <ActItem
                key={tx.id}
                icon={TX_ICON[tx.type] ?? "💳"}
                iconBg={TX_ICON_BG[tx.type] ?? "#F3F4F6"}
                name={tx.description ?? tx.accountName ?? "—"}
                cat={`${time} · ${tx.categoryName ?? tx.accountName ?? "—"}`}
                right={
                  <div
                    className={
                      "text-[13px] font-bold " +
                      (isTransfer
                        ? "text-muted-foreground"
                        : isIncome
                          ? "text-success"
                          : "text-destructive")
                    }
                  >
                    {isTransfer ? "" : isIncome ? "+" : "-"}
                    {formatRupiah(tx.amount)}
                  </div>
                }
                last={i === dailyReport.transactions.length - 1}
              />
            );
          })
        ) : (
          <div className="py-4 text-center text-[12px] text-muted-foreground">
            {t.laporan.harian.emptyToday}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
