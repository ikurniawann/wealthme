import { BentoCard, BentoTile, BentoTiles } from "@/components/wm";
import { useMoney } from "@/hooks/use-money";
import { useLocale } from "@/hooks/use-locale";
import type { DetailReportDto } from "@wealthme/contracts";
import { formatLocaleTime } from "../date-helpers";
import { ActItem } from "../atoms";
import "./sections-a.css";

/* ───────────────────────── Section: Harian ───────────────────────── */

const TX_ICON: Record<string, string> = {
  income: "📥",
  expense: "🛒",
  transfer: "↔",
};
const TX_ICON_BG: Record<string, string> = {
  income: "#DCFCE7",
  expense: "#FEF3C7",
  transfer: "#DBEAFE",
};

export function HarianSection({
  dailyReport,
  isLoading,
}: {
  dailyReport?: DetailReportDto;
  isLoading?: boolean;
  // The hero (laporan-inner.tsx) owns the single day picker for this tab —
  // kept here only so callers that still pass it (laporan-inner.tsx's
  // switch) type-check; this component renders no date control of its own.
  date?: string;
  onDateChange?: (d: string) => void;
}) {
  const { t, locale } = useLocale();
  const money = useMoney();
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const net =
    (dailyReport?.totalIncome ?? 0) - (dailyReport?.totalExpense ?? 0);

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <BentoTiles>
        <BentoTile
          title={t.laporan.harian.incomeTodayLabel}
          value={
            <span
              className="lap-a-kpi-value"
              style={{ color: "var(--wm-lime)" }}
            >
              {dailyReport ? money.format(dailyReport.totalIncome) : "Rp ·"}
            </span>
          }
        />
        <BentoTile
          title={t.laporan.harian.expenseTodayLabel}
          value={
            <span
              className="lap-a-kpi-value"
              style={{ color: "var(--wm-orange)" }}
            >
              {dailyReport ? money.format(dailyReport.totalExpense) : "Rp ·"}
            </span>
          }
        />
        <BentoTile
          title={t.laporan.harian.netDailyLabel}
          value={
            <span
              className="lap-a-kpi-value"
              style={{
                color: net >= 0 ? "var(--wm-lime)" : "var(--wm-orange)",
              }}
            >
              {dailyReport
                ? `${net >= 0 ? "+" : ""}${money.format(net)}`
                : "Rp ·"}
            </span>
          }
        />
        <BentoTile
          title={t.laporan.harian.txnCountLabel}
          value={dailyReport ? String(dailyReport.count) : "—"}
        />
      </BentoTiles>
      <BentoCard title={t.laporan.harian.txnTodayTitle}>
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
                      "lap-a-amt text-[13px] font-bold " +
                      (isTransfer
                        ? "text-muted-foreground"
                        : isIncome
                          ? "text-success"
                          : "text-destructive")
                    }
                  >
                    {isTransfer ? "" : isIncome ? "+" : "-"}
                    {money.format(tx.amount)}
                  </div>
                }
                last={i === dailyReport.transactions.length - 1}
              />
            );
          })
        ) : (
          <div className="lap-a-empty">
            <b>{t.laporan.harian.emptyToday}</b>
            <span>{t.laporan.harian.emptyTodayHint}</span>
          </div>
        )}
      </BentoCard>
    </div>
  );
}
