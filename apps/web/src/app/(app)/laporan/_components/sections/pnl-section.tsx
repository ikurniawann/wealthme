import { useRouter } from "next/navigation";
import { SectionCard } from "@/components/wm";
import { formatRupiah } from "@/lib/format";
import { useLocale } from "@/hooks/use-locale";
import type { PnlDto } from "@wealthme/contracts";
import { StatementRow } from "../atoms";

/* ───────────────────────── Section: PNL ───────────────────────── */

export function PnlSection({
  pnl,
  isLoading,
  periodLabel,
}: {
  pnl?: PnlDto;
  isLoading?: boolean;
  periodLabel: string;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const bulan = periodLabel;
  const netMargin =
    pnl && pnl.revenue > 0
      ? `${Math.round((pnl.netProfit / pnl.revenue) * 100 * 10) / 10}%`
      : "—";

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="text-[15px] font-bold">
        {t.laporan.pnl.titlePrefix} {bulan}
      </div>
      {/* EPIC-023 A4 — honest disclosure of the accounting basis this report
          uses, so a family reading "revenue" never assumes accrual timing. */}
      <div className="text-[11px] text-muted-foreground">
        {t.laporan.pnl.cashBasisNote}
      </div>
      <SectionCard>
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            <StatementRow
              label={t.laporan.pnl.revenueLabel}
              className="border-b-2 border-border"
              labelClass="py-2.5 font-bold text-success"
            />
            {pnl?.revenueBreakdown.map((item) => (
              <StatementRow
                key={item.categoryName}
                label={item.categoryName}
                value={formatRupiah(item.amount)}
                indent
              />
            ))}
            <StatementRow
              label={t.laporan.pnl.totalRevenueLabel}
              value={pnl ? formatRupiah(pnl.revenue) : "Rp ·"}
              className="border-b border-border"
              labelClass="py-2 font-bold"
              valueClass="font-extrabold text-success"
            />
            <StatementRow
              label={t.laporan.pnl.expensesLabel}
              className="border-b-2 border-border"
              labelClass="py-2.5 font-bold text-destructive"
            />
            {pnl?.expenseBreakdown.map((item) => (
              <StatementRow
                key={item.categoryName}
                label={item.categoryName}
                value={formatRupiah(item.amount)}
                indent
              />
            ))}
            <StatementRow
              label={t.laporan.pnl.totalExpensesLabel}
              value={pnl ? formatRupiah(pnl.expenses) : "Rp ·"}
              className="border-b border-border"
              labelClass="py-2 font-bold"
              valueClass="font-extrabold text-destructive"
            />
            <StatementRow
              label={t.laporan.pnl.netProfitLabel}
              value={pnl ? formatRupiah(pnl.netProfit) : "Rp ·"}
              className="border-t-2 border-primary"
              labelClass="py-3 text-[15px] font-extrabold"
              valueClass={
                "text-[16px] font-black " +
                ((pnl?.netProfit ?? 0) >= 0
                  ? "text-success"
                  : "text-destructive")
              }
            />
            <StatementRow
              label={t.laporan.pnl.netMarginLabel}
              value={netMargin}
              labelClass="py-1 text-[11px] text-muted-foreground"
              valueClass="text-[11px] text-muted-foreground"
            />
          </tbody>
        </table>
        <div className="mt-2 text-right text-[11px] text-muted-foreground">
          {t.laporan.pnl.directionNotePrefix}{" "}
          <button
            type="button"
            onClick={() => router.push("/mastercoa")}
            className="cursor-pointer font-semibold text-primary hover:underline"
          >
            {t.laporan.pnl.masterCoaLink}
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
