"use client";

import { SectionCard } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";
import { formatRupiah } from "@/lib/format";
import { useInvestmentTaxEstimate } from "@/components/tax/use-tax-api";

import { StatementRow, StatTile } from "../atoms";

import type { TaxFinalInstrument } from "@wealthme/contracts";

const wibDate = (iso: string): string =>
  new Date(new Date(iso).getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

/**
 * Task 11 (sub-plan L) — /laporan's final-tax card: the same
 * `FinalTaxEstimateDto` the investment tax card shows, in the report's
 * StatTile/StatementRow style, one row per instrument group.
 */
export function PajakFinalCard() {
  const { t } = useLocale();
  const year = Number(wibDate(new Date().toISOString()).slice(0, 4));
  const { data: result, isPending } = useInvestmentTaxEstimate(year);

  if (isPending) return null;

  const lines = result?.lines ?? [];
  const totals = new Map<TaxFinalInstrument, number>();
  for (const line of lines) {
    totals.set(
      line.instrument,
      (totals.get(line.instrument) ?? 0) + Number(line.tax ?? 0),
    );
  }

  return (
    <SectionCard title={t.tax.invest.title}>
      <div className="space-y-3">
        <StatTile
          label={t.tax.final.totalPrefix}
          value={formatRupiah(Number(result?.totalTax ?? 0))}
        />
        {lines.length === 0 ? (
          <div className="hint">{t.tax.invest.empty}</div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <tbody>
              {[...totals.entries()].map(([instrument, tax]) => (
                <StatementRow
                  key={instrument}
                  label={t.tax.final.instruments[instrument]}
                  value={formatRupiah(tax)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </SectionCard>
  );
}
