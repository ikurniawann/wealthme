import { Pencil, Trash2 } from "lucide-react";
import { SectionCard } from "@/components/wm";
import { DonutChart } from "@/components/charts/apex-presets";
import { useMoney } from "@/hooks/use-money";
import { formatPercent } from "@/lib/format";
import { DELTA_ARROW, deltaDirection } from "@/lib/delta";
import { assetClassColor } from "@/lib/viz-colors";
import { investmentCurrentValue } from "@/lib/laporan-utils";
import { useLocale } from "@/hooks/use-locale";
import type {
  InvestmentDto,
  InvestmentSummaryDto,
  InvestmentType,
} from "@wealthme/contracts";
import { BarRow } from "../atoms";
import "./sections-b.css";

/* ───────────────────────── Section: Investasi ───────────────────────── */

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
  const money = useMoney();
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
  const hasReturn =
    invSummary?.totalReturnRp != null && invSummary?.totalReturnPct != null;

  const typeRows = Array.from(byType.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([type, value]) => ({
      label: t.laporan.investasi.typeLabels[type],
      color: assetClassColor(type),
      value,
      pct: totalValue > 0 ? Math.round((value / totalValue) * 100) : 0,
    }));

  const maxValue = typeRows[0]?.value ?? 0;

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      {invSummary?.costIncomplete && (
        <p role="status">{t.investasi.forms.costUnknown}</p>
      )}
      <SectionCard
        title={t.laporan.investasi.sectionTitle}
        action={
          onAdd && (
            <button
              onClick={onAdd}
              className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:opacity-90"
            >
              + {t.common.add}
            </button>
          )
        }
        bodyClassName="grid grid-cols-1 gap-3.5 md:grid-cols-2"
      >
        <div className="rounded-[12px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">
            {t.laporan.investasi.totalPortfolioLabel}
          </div>
          <div className="text-[22px] font-black text-primary">
            {invSummary ? money.format(totalValue) : "…"}
          </div>
          {invSummary && hasReturn && totalValue > 0 && (
            <div
              className={
                "mt-1 text-[12px] " +
                (deltaDirection(totalReturnPct, 2) === "flat"
                  ? "text-muted-foreground"
                  : totalReturnRp >= 0
                    ? "text-success"
                    : "text-destructive")
              }
            >
              {DELTA_ARROW[deltaDirection(totalReturnPct, 2)]}{" "}
              {formatPercent(Math.abs(totalReturnPct))} ·{" "}
              {totalReturnRp >= 0 ? "+" : "-"}
              {money.format(Math.abs(totalReturnRp))}
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
            {hasReturn ? formatPercent(totalReturnPct, { signed: true }) : "—"}
          </div>
          <div className="mt-1 text-[12px] text-muted-foreground">
            {investments
              ? `${investments.length} ${t.laporan.investasi.instrumentCountSuffix}`
              : "—"}
          </div>
        </div>
      </SectionCard>
      <SectionCard title={t.laporan.investasi.portfolioByTypeTitle}>
        {typeRows.length > 0 ? (
          <div className="grid items-center gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
            {/* EPIC-026 Wave 3 — prototype's `#c-rinv` mount is the Apex
                donut preset (J3 FOLD), over the SAME by-type totals the
                allocation rows below already sum; the rows stay, matching
                the prototype's donut + allocation-row pairing. Legend
                hidden — the rows below are the one legend for this card. */}
            <div className="[&_.apexcharts-legend]:hidden!">
              <DonutChart
                segments={typeRows.map((row) => ({
                  label: row.label,
                  value: row.value,
                  color: row.color,
                }))}
                centerLabel={t.laporan.investasi.totalPortfolioLabel}
                height={190}
                ariaLabel={`${t.laporan.investasi.portfolioByTypeTitle}: ${typeRows
                  .map((row) => `${row.label} ${row.pct}%`)
                  .join(", ")}`}
                money={money}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-2.5">
              {typeRows.map((row) => (
                <BarRow
                  key={row.label}
                  label={row.label}
                  right={
                    <span className="font-bold" style={{ color: row.color }}>
                      {money.format(row.value)} · {row.pct}%
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
                  const typeColor = assetClassColor(inv.type);
                  return (
                    <tr key={inv.id} className="border-b last:border-0">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                            style={{
                              background: `color-mix(in srgb, ${typeColor} 16%, transparent)`,
                              color: typeColor,
                            }}
                            aria-hidden="true"
                          >
                            {inv.ticker.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-semibold">
                              {inv.ticker}
                            </div>
                            <div className="truncate text-[11px] text-muted-foreground">
                              {inv.name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5">
                        <span
                          className="lpb-rate-pill"
                          style={{
                            background: `color-mix(in srgb, ${typeColor} 14%, transparent)`,
                            color: typeColor,
                          }}
                        >
                          {typeLabel ?? inv.type}
                        </span>
                      </td>
                      <td className="lpb-amt mono py-2.5">
                        {val > 0 ? money.format(val) : "—"}
                      </td>
                      <td
                        className={
                          "lpb-amt mono py-2.5 " +
                          (ret >= 0 ? "text-success" : "text-destructive")
                        }
                      >
                        {inv.returnPct !== null
                          ? formatPercent(inv.returnPct ?? 0, { signed: true })
                          : "—"}
                      </td>
                      {(onEdit ?? onDelete) && (
                        <td className="py-2.5">
                          <div className="flex justify-end gap-1.5">
                            {onEdit && (
                              <button
                                type="button"
                                onClick={() => onEdit(inv)}
                                className="lpb-icon-btn"
                                aria-label={t.laporan.investasi.editLink}
                                title={t.laporan.investasi.editLink}
                              >
                                <Pencil size={13} />
                              </button>
                            )}
                            {onDelete && (
                              <button
                                type="button"
                                onClick={() => onDelete(inv)}
                                className="lpb-icon-btn lpb-icon-btn--danger"
                                aria-label={t.common.delete}
                                title={t.common.delete}
                              >
                                <Trash2 size={13} />
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
