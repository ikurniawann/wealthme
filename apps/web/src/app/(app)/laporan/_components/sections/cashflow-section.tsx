import { SectionCard } from "@/components/wm";
import { formatRupiah } from "@/lib/format";
import { formatSignedRupiah } from "@/lib/laporan-utils";
import { useLocale } from "@/hooks/use-locale";
import type { CashflowStatementDto } from "@wealthme/contracts";
import { StatementRow } from "../atoms";

/* ───────────────────────── Section: Cashflow ───────────────────────── */

export function CashflowSection({
  cashflow,
  isLoading,
  periodLabel,
}: {
  cashflow?: CashflowStatementDto;
  isLoading?: boolean;
  periodLabel: string;
}) {
  const { t } = useLocale();
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const bulan = periodLabel;
  // EPIC-022 B2 — a negative net figure must render with a real minus sign;
  // the previous inline `fmt()` silently turned every negative into a bare
  // positive number via `Math.abs()`, distinguished only by colour.
  const fmt = formatSignedRupiah;

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="text-[15px] font-bold">
        {t.laporan.cashflow.titlePrefix} {bulan}
      </div>
      <SectionCard>
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            <StatementRow
              label={t.laporan.cashflow.operatingLabel}
              className="border-b-2 border-border"
              labelClass="py-2.5 font-bold text-primary"
            />
            <StatementRow
              label={t.laporan.cashflow.totalInflowLabel}
              value={cashflow ? fmt(cashflow.operatingInflows) : "Rp ·"}
              indent
              valueColor="var(--success)"
            />
            <StatementRow
              label={t.laporan.cashflow.totalOutflowLabel}
              value={
                cashflow
                  ? `-${formatRupiah(cashflow.operatingOutflows)}`
                  : "Rp ·"
              }
              indent
              valueColor="var(--destructive)"
            />
            <StatementRow
              label={t.laporan.cashflow.netOperatingLabel}
              value={cashflow ? fmt(cashflow.netOperating) : "Rp ·"}
              className="border-b border-border"
              labelClass="py-2 font-bold"
              valueClass={
                "font-extrabold " +
                ((cashflow?.netOperating ?? 0) >= 0
                  ? "text-success"
                  : "text-destructive")
              }
            />
            <StatementRow
              label={t.laporan.cashflow.investingLabel}
              className="border-b-2 border-border"
              labelClass="py-2.5 font-bold text-brand-purple"
            />
            {/* EPIC-022 B3 — investing cashflow is not tracked yet (always
                hard-coded to zero server-side); disclose that plainly
                instead of printing "Rp 0" as if it were measured. */}
            <StatementRow
              label={t.laporan.cashflow.netInvestingLabel}
              value={
                cashflow ? t.laporan.cashflow.investingUntrackedLabel : "Rp ·"
              }
              className="border-b border-border"
              labelClass="py-2 font-bold"
              valueClass="font-extrabold text-muted-foreground"
            />
            <StatementRow
              label={t.laporan.cashflow.netCashflowLabel}
              value={cashflow ? fmt(cashflow.netChange) : "Rp ·"}
              className="border-t-2 border-primary"
              labelClass="py-3 text-[15px] font-extrabold"
              valueClass={
                "text-[16px] font-black " +
                ((cashflow?.netChange ?? 0) >= 0
                  ? "text-success"
                  : "text-destructive")
              }
            />
          </tbody>
        </table>
        {cashflow && (
          <div className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
            {t.laporan.cashflow.investingDisclosure}
          </div>
        )}
      </SectionCard>
      {/* EPIC-022 B3 — Saldo Awal/Akhir moved out of the INVESTING block
          into their own section; they are derived backward from current
          account balances, not point-in-time historical values, so they get
          their own disclosure rather than sitting silently inside a cashflow
          statement's investing lines. */}
      {cashflow && (
        <SectionCard title={t.laporan.cashflow.balanceSectionTitle}>
          <table className="w-full border-collapse text-[13px]">
            <tbody>
              <StatementRow
                label={t.laporan.cashflow.openingBalanceLabel}
                value={formatRupiah(cashflow.openingBalance)}
                valueColor="var(--muted-foreground)"
              />
              <StatementRow
                label={t.laporan.cashflow.closingBalanceLabel}
                value={formatRupiah(cashflow.closingBalance)}
                valueColor="var(--muted-foreground)"
              />
            </tbody>
          </table>
          <div className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
            {t.laporan.cashflow.balanceDisclosure}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
