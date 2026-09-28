import { SectionCard } from "@/components/wm";
import { HBarChart } from "@/components/charts/apex-presets";
import { formatJuta, sankeyToFlowBars } from "@/lib/laporan-utils";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import type { SankeyDto } from "@wealthme/contracts";

/* ───────────────────────── Section: Aliran Dana ───────────────────────── */

export function AliranSection({
  sankeyData,
  isLoading,
  periodLabel,
}: {
  sankeyData?: SankeyDto;
  isLoading?: boolean;
  periodLabel: string;
}) {
  const { t } = useLocale();
  const money = useMoney();
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const incomeBars = sankeyData ? sankeyToFlowBars(sankeyData, "income") : [];
  const expenseBars = sankeyData ? sankeyToFlowBars(sankeyData, "expense") : [];

  const bulan = periodLabel;

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="text-[15px] font-bold">{t.laporan.aliran.title}</div>
      <SectionCard title={`${t.laporan.aliran.cardTitlePrefix} ${bulan}`}>
        {sankeyData && (incomeBars.length > 0 || expenseBars.length > 0) ? (
          /* EPIC-026 Wave 3 — prototype's `#c-aliran` mount is the Apex
             hbar preset (J3 FOLD); same sankey-derived label/amount pairs
             the hand-rolled gradient bars rendered before this rebuild. */
          <div className="flex flex-col gap-3.5">
            {incomeBars.length > 0 && (
              <div>
                <div className="mb-2 text-[11px] font-bold text-success">
                  {t.laporan.aliran.incomeSourceLabel}
                </div>
                <HBarChart
                  categories={incomeBars.map((b) => b.label)}
                  data={incomeBars.map((b) => b.amount)}
                  color="var(--success)"
                  ariaLabel={`${t.laporan.aliran.incomeSourceLabel}: ${incomeBars
                    .map((b) => `${b.label} ${formatJuta(b.amount)}`)
                    .join(", ")}`}
                  money={money}
                />
              </div>
            )}
            {expenseBars.length > 0 && (
              <div>
                <div className="mb-2 text-[11px] font-bold text-destructive">
                  {t.laporan.aliran.expenseAllocLabel}
                </div>
                <HBarChart
                  categories={expenseBars.map((b) => b.label)}
                  data={expenseBars.map((b) => b.amount)}
                  color="var(--destructive)"
                  ariaLabel={`${t.laporan.aliran.expenseAllocLabel}: ${expenseBars
                    .map((b) => `${b.label} ${formatJuta(b.amount)}`)
                    .join(", ")}`}
                  money={money}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="py-4 text-center text-[12px] text-muted-foreground">
            {t.laporan.aliran.emptyFlow}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
