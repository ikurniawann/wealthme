import { SectionCard } from "@/components/wm";
import { DonutChart } from "@/components/charts/apex-presets";
import { formatRupiah } from "@/lib/format";
import { investmentCurrentValue } from "@/lib/laporan-utils";
import { useLocale } from "@/hooks/use-locale";
import type {
  InvestmentDto,
  InvestmentSummaryDto,
  InvestmentType,
} from "@wealthme/contracts";
import { BarRow } from "../atoms";

/* ───────────────────────── Section: Investasi ───────────────────────── */

const INV_TYPE_COLORS: Record<InvestmentType, string> = {
  saham: "var(--brand-cyan)",
  reksa_dana: "var(--primary)",
  obligasi: "var(--success)",
  emas: "var(--warning)",
  kripto: "#F97316",
  lainnya: "#8B5CF6",
  // EPIC-024 C2/C3 (D10).
  deposito: "#0F766E",
};

export function InvSection({
  investments,
  invSummary,
  isLoading,
  onAdd,
  onEdit,
  onDelete,
}: {
  investments?: InvestmentDto[];
  invSummary?: InvestmentSummaryDto;
  isLoading?: boolean;
  onAdd?: () => void;
  onEdit?: (inv: InvestmentDto) => void;
  onDelete?: (inv: InvestmentDto) => void;
}) {
  const { t } = useLocale();
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";

  const byType = new Map<InvestmentType, number>();
  for (const inv of investments ?? []) {
    // EPIC-022 B9 (CRITICAL fix) — inv.currentValue is already the total
    // position value; only the costBasisPerUnit fallback is per-unit. See
    // investmentCurrentValue's doc comment for the exact inflation bug this
    // replaces (price × quantity² whenever a market price existed).
    const val = investmentCurrentValue(inv);
    byType.set(inv.type, (byType.get(inv.type) ?? 0) + val);
  }

  const totalValue = parseFloat(invSummary?.totalCurrentValue ?? "0");
  const totalReturnRp = parseFloat(invSummary?.totalReturnRp ?? "0");
  const totalReturnPct = invSummary?.totalReturnPct ?? 0;

  const typeRows = Array.from(byType.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([type, value]) => ({
      label: t.laporan.investasi.typeLabels[type],
      color: INV_TYPE_COLORS[type],
      value,
      pct: totalValue > 0 ? Math.round((value / totalValue) * 100) : 0,
    }));

  const maxValue = typeRows[0]?.value ?? 0;

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="flex items-center justify-between">
        <div className="text-[15px] font-bold">
          {t.laporan.investasi.sectionTitle}
        </div>
        {onAdd && (
          <button
            onClick={onAdd}
            className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:opacity-90"
          >
            + {t.common.add}
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <div className="rounded-[12px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">
            {t.laporan.investasi.totalPortfolioLabel}
          </div>
          <div className="text-[22px] font-black text-primary">
            {invSummary ? formatRupiah(totalValue) : "Rp —"}
          </div>
          {invSummary && totalValue > 0 && (
            <div
              className={
                "mt-1 text-[12px] " +
                (totalReturnRp >= 0 ? "text-success" : "text-destructive")
              }
            >
              {totalReturnRp >= 0 ? "▲" : "▼"}{" "}
              {Math.abs(totalReturnPct).toFixed(2)}% ·{" "}
              {totalReturnRp >= 0 ? "+" : "-"}
              {formatRupiah(Math.abs(totalReturnRp))}
            </div>
          )}
        </div>
        <div className="rounded-[12px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">
            {t.laporan.investasi.totalReturnLabel}
          </div>
          <div
            className={
              "text-[22px] font-black " +
              (totalReturnPct >= 0 ? "text-success" : "text-destructive")
            }
          >
            {invSummary
              ? `${totalReturnPct >= 0 ? "+" : ""}${totalReturnPct.toFixed(2)}%`
              : "—"}
          </div>
          <div className="mt-1 text-[12px] text-muted-foreground">
            {investments
              ? `${investments.length} ${t.laporan.investasi.instrumentCountSuffix}`
              : "—"}
          </div>
        </div>
      </div>
      <SectionCard title={t.laporan.investasi.portfolioByTypeTitle}>
        {typeRows.length > 0 ? (
          <div className="flex flex-col gap-3.5">
            {/* EPIC-026 Wave 3 — prototype's `#c-rinv` mount is the Apex
                donut preset (J3 FOLD), over the SAME by-type totals the
                allocation rows below already sum; the rows stay, matching
                the prototype's donut + allocation-row pairing. Legend
                hidden — the rows below are the one legend for this card. */}
            <div className="[&_.apexcharts-legend]:hidden">
              <DonutChart
                segments={typeRows.map((row) => ({
                  label: row.label,
                  value: row.value,
                  color: row.color,
                }))}
                centerLabel={t.laporan.investasi.totalPortfolioLabel}
                height={230}
                ariaLabel={`${t.laporan.investasi.portfolioByTypeTitle}: ${typeRows
                  .map((row) => `${row.label} ${row.pct}%`)
                  .join(", ")}`}
              />
            </div>
            <div className="flex flex-col gap-2.5">
              {typeRows.map((row) => (
                <BarRow
                  key={row.label}
                  label={row.label}
                  right={
                    <span className="font-bold" style={{ color: row.color }}>
                      {formatRupiah(row.value)} · {row.pct}%
                    </span>
                  }
                  value={
                    maxValue > 0 ? Math.round((row.value / maxValue) * 100) : 0
                  }
                  color={row.color}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="py-4 text-center text-[12px] text-muted-foreground">
            {t.laporan.investasi.emptyInvestment}{" "}
            {onAdd && (
              <button
                onClick={onAdd}
                className="text-primary underline underline-offset-2"
              >
                {t.laporan.investasi.addNowLink}
              </button>
            )}
          </div>
        )}
      </SectionCard>
      {investments && investments.length > 0 && (
        <SectionCard title={t.laporan.investasi.instrumentListTitle}>
          <div className="w-full overflow-x-auto [mask-image:linear-gradient(to_left,transparent,black_24px)]">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-semibold">
                    {t.laporan.investasi.colName}
                  </th>
                  <th className="py-2 font-semibold">
                    {t.laporan.investasi.colType}
                  </th>
                  <th className="py-2 font-semibold">
                    {t.laporan.investasi.colValue}
                  </th>
                  <th className="py-2 font-semibold">
                    {t.laporan.investasi.colReturn}
                  </th>
                  {(onEdit ?? onDelete) && (
                    <th className="py-2 font-semibold"></th>
                  )}
                </tr>
              </thead>
              <tbody>
                {investments.map((inv) => {
                  // EPIC-022 B9 — use the same current-value basis as the
                  // portfolio-by-type breakdown above and `invSummary` (see
                  // investmentCurrentValue: currentValue is already a total,
                  // not per-unit — do NOT multiply it by quantity again), so
                  // this table never disagrees with the totals shown
                  // elsewhere on this tab.
                  const val = investmentCurrentValue(inv);
                  const ret = parseFloat(inv.returnRp ?? "0");
                  const typeLabel = t.laporan.investasi.typeLabels[inv.type];
                  return (
                    <tr key={inv.id} className="border-b last:border-0">
                      <td className="py-2.5">
                        <div className="font-semibold">{inv.ticker}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {inv.name}
                        </div>
                      </td>
                      <td className="py-2.5 text-[11px]">
                        {typeLabel ?? inv.type}
                      </td>
                      <td className="mono py-2.5">
                        {val > 0 ? formatRupiah(val) : "—"}
                      </td>
                      <td
                        className={
                          "mono py-2.5 " +
                          (ret >= 0 ? "text-success" : "text-destructive")
                        }
                      >
                        {inv.returnPct !== null
                          ? `${ret >= 0 ? "+" : ""}${(inv.returnPct ?? 0).toFixed(1)}%`
                          : "—"}
                      </td>
                      {(onEdit ?? onDelete) && (
                        <td className="py-2.5">
                          <div className="flex gap-2">
                            {onEdit && (
                              <button
                                onClick={() => onEdit(inv)}
                                className="text-[11px] text-primary hover:underline"
                              >
                                {t.laporan.investasi.editLink}
                              </button>
                            )}
                            {onDelete && (
                              <button
                                onClick={() => onDelete(inv)}
                                className="text-[11px] text-destructive hover:underline"
                              >
                                {t.common.delete}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
