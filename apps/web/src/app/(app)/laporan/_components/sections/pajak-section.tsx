import { SectionCard } from "@/components/wm";
import { formatRupiah } from "@/lib/format";
import { useLocale } from "@/hooks/use-locale";
import type { Pph21ResultDto } from "@wealthme/contracts";
import { StatementRow, StatTile } from "../atoms";

/* ───────────────────────── Section: Pajak ───────────────────────── */

export function PajakSection({
  pph21,
  grossIncome,
  isLoading,
}: {
  pph21?: Pph21ResultDto;
  grossIncome?: number;
  isLoading?: boolean;
}) {
  const { t } = useLocale();
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const hasIncome = grossIncome != null && grossIncome > 0;

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="text-[15px] font-bold">{t.laporan.pajak.title}</div>

      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <StatTile
          label={t.laporan.pajak.grossYearLabel}
          value={grossIncome != null ? formatRupiah(grossIncome) : "Rp ·"}
        />
        <StatTile
          label={t.laporan.pajak.pkpLabel}
          value={pph21 ? formatRupiah(pph21.pkp) : "Rp ·"}
        />
        <StatTile
          label={t.laporan.pajak.estimatedTaxLabel}
          value={pph21 ? formatRupiah(pph21.totalTax) : "Rp ·"}
          valueClass="text-destructive"
        />
        <StatTile
          label={t.laporan.pajak.effectiveRateLabel}
          value={pph21 ? `${(pph21.effectiveRate * 100).toFixed(2)}%` : "—"}
          valueClass="text-primary"
        />
      </div>

      <SectionCard title={t.laporan.pajak.calcTitle}>
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            <StatementRow
              label={t.laporan.pajak.grossIncomeLabel}
              value={grossIncome != null ? formatRupiah(grossIncome) : "Rp ·"}
            />
            <StatementRow
              label={t.laporan.pajak.laborCostLabel}
              value={pph21 ? `-${formatRupiah(pph21.biayaJabatan)}` : "Rp ·"}
              indent
            />
            <StatementRow
              label={t.laporan.pajak.ptkpLabel}
              value={pph21 ? `-${formatRupiah(pph21.ptkp)}` : "Rp ·"}
              indent
            />
            {pph21 && pph21.zakatDeduction > 0 && (
              <StatementRow
                label={t.laporan.pajak.zakatDeductionLabel}
                value={`-${formatRupiah(pph21.zakatDeduction)}`}
                indent
              />
            )}
            <StatementRow
              label={t.laporan.pajak.pkpFullLabel}
              value={pph21 ? formatRupiah(pph21.pkp) : "Rp ·"}
              className="border-t border-border"
              labelClass="py-2 font-bold"
              valueClass="font-extrabold"
            />
          </tbody>
        </table>
      </SectionCard>

      {pph21 && pph21.taxBreakdown.length > 0 && (
        <SectionCard title={t.laporan.pajak.bracketBreakdownTitle}>
          <div className="w-full overflow-x-auto [mask-image:linear-gradient(to_left,transparent,black_24px)]">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-semibold">
                    {t.laporan.pajak.colBracket}
                  </th>
                  <th className="py-2 font-semibold">
                    {t.laporan.pajak.colTaxBase}
                  </th>
                  <th className="py-2 font-semibold">
                    {t.laporan.pajak.colRate}
                  </th>
                  <th className="py-2 text-right font-semibold">
                    {t.laporan.pajak.colTax}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pph21.taxBreakdown.map((b) => (
                  <tr key={b.bracket} className="border-b last:border-0">
                    <td className="py-2.5">{b.bracket}</td>
                    <td className="mono py-2.5">
                      {formatRupiah(b.taxableAmount)}
                    </td>
                    <td className="py-2.5">{(b.rate * 100).toFixed(0)}%</td>
                    <td className="mono py-2.5 text-right text-destructive">
                      {formatRupiah(b.tax)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-primary">
                  <td className="py-2.5 font-extrabold" colSpan={3}>
                    {t.laporan.pajak.totalTaxYearLabel}
                  </td>
                  <td className="mono py-2.5 text-right text-[14px] font-black text-destructive">
                    {formatRupiah(pph21.totalTax)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {!isLoading && !hasIncome && (
        <div className="rounded-[12px] border p-6 text-center text-[12px] text-muted-foreground">
          {t.laporan.pajak.emptyIncomeNote}
        </div>
      )}

      <div className="flex items-start gap-3 rounded-[12px] border border-primary/20 bg-accent p-3.5">
        <div className="text-[20px]">🧾</div>
        <div className="flex-1 text-[12px] text-muted-foreground">
          {t.laporan.pajak.estimateNoteBefore}{" "}
          <strong>{t.laporan.pajak.estimateNoteBold}</strong>{" "}
          {t.laporan.pajak.estimateNoteAfter}{" "}
          <a
            href="/kalkulator"
            className="font-bold text-primary hover:underline"
          >
            {t.laporan.pajak.calculatorLinkLabel}
          </a>
          .
        </div>
      </div>
    </div>
  );
}
