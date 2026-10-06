import { useRouter } from "next/navigation";
import { SectionCard } from "@/components/wm";
import { formatRupiah } from "@/lib/format";
import { EXPENSE_COLOR, INCOME_COLOR } from "@/lib/viz-colors";
import { useLocale } from "@/hooks/use-locale";
import type { PnlDto } from "@wealthme/contracts";
import "./sections-b.css";

/* ───────────────────────── Section: PNL ───────────────────────── */

function LineItem({
  label,
  amount,
  share,
  color,
}: {
  label: string;
  amount: number;
  share: number;
  color: string;
}) {
  return (
    <div className="lpb-statement-row">
      <div className="lpb-statement-label">{label}</div>
      <div className="lpb-statement-value mono">{formatRupiah(amount)}</div>
      <div className="lpb-statement-track">
        <div
          className="lpb-statement-track-fill"
          style={{
            width: `${Math.max(2, Math.min(100, share))}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
}

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
  const isPositive = (pnl?.netProfit ?? 0) >= 0;

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <SectionCard
        title={`${t.laporan.pnl.titlePrefix} ${bulan}`}
        action={
          <div className="wm-legend">
            <span>
              <i style={{ background: INCOME_COLOR }} />
              {t.laporan.pnl.revenueLabel}
            </span>
            <span>
              <i style={{ background: EXPENSE_COLOR }} />
              {t.laporan.pnl.expensesLabel}
            </span>
          </div>
        }
      >
        {/* EPIC-023 A4 — honest disclosure of the accounting basis this
            report uses, so a family reading "revenue" never assumes accrual
            timing. Period caption lives in the card title above. */}
        <div className="mb-3 text-[11px] text-muted-foreground">
          {t.laporan.pnl.cashBasisNote}
        </div>
        <div className="lpb-statement-group text-success">
          {t.laporan.pnl.revenueLabel}
        </div>
        {pnl?.revenueBreakdown.map((item) => (
          <LineItem
            key={item.categoryName}
            label={item.categoryName}
            amount={item.amount}
            share={pnl.revenue > 0 ? (item.amount / pnl.revenue) * 100 : 0}
            color={INCOME_COLOR}
          />
        ))}
        <div className="lpb-statement-row lpb-statement-subtotal">
          <div className="lpb-statement-label">
            {t.laporan.pnl.totalRevenueLabel}
          </div>
          <div className="lpb-statement-value mono text-success">
            {pnl ? formatRupiah(pnl.revenue) : "Rp ·"}
          </div>
        </div>

        <div
          className="lpb-statement-group mt-4"
          style={{ color: EXPENSE_COLOR }}
        >
          {t.laporan.pnl.expensesLabel}
        </div>
        {pnl?.expenseBreakdown.map((item) => (
          <LineItem
            key={item.categoryName}
            label={item.categoryName}
            amount={item.amount}
            share={pnl.expenses > 0 ? (item.amount / pnl.expenses) * 100 : 0}
            color={EXPENSE_COLOR}
          />
        ))}
        <div className="lpb-statement-row lpb-statement-subtotal">
          <div className="lpb-statement-label">
            {t.laporan.pnl.totalExpensesLabel}
          </div>
          <div
            className="lpb-statement-value mono"
            style={{ color: EXPENSE_COLOR }}
          >
            {pnl ? formatRupiah(pnl.expenses) : "Rp ·"}
          </div>
        </div>

        <div className="lpb-statement-net">
          <div>
            <div className="lpb-statement-net-label">
              {t.laporan.pnl.netProfitLabel}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {t.laporan.pnl.netMarginLabel} {netMargin}
            </div>
          </div>
          <div
            className={
              "lpb-statement-net-value mono " +
              (isPositive ? "text-success" : "text-destructive")
            }
          >
            {pnl ? formatRupiah(pnl.netProfit) : "Rp ·"}
          </div>
        </div>

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
