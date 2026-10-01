import { BentoCard, Track } from "@/components/wm";
import { sankeyToFlowBars } from "@/lib/laporan-utils";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import type { SankeyDto } from "@wealthme/contracts";
import "./sections-a.css";

/* ───────────────────────── Section: Aliran Dana ───────────────────────── */

function FlowBars({
  bars,
  tone,
  ariaLabel,
}: {
  bars: { label: string; amount: number }[];
  tone: "lime" | "orange";
  ariaLabel: string;
}) {
  const max = Math.max(1, ...bars.map((b) => b.amount));
  const money = useMoney();
  return (
    <div role="img" aria-label={ariaLabel}>
      {bars.map((b) => (
        <div key={b.label} className="lap-a-flow-row" aria-hidden="true">
          <span className="lap-a-flow-name">{b.label}</span>
          <span className="lap-a-flow-amt">
            {money.formatCompact(b.amount)}
          </span>
          <div className="lap-a-flow-track">
            <Track value={(b.amount / max) * 100} fill={tone} />
          </div>
        </div>
      ))}
    </div>
  );
}

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
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const incomeBars = sankeyData ? sankeyToFlowBars(sankeyData, "income") : [];
  const expenseBars = sankeyData ? sankeyToFlowBars(sankeyData, "expense") : [];

  const bulan = periodLabel;
  const hasData = incomeBars.length > 0 || expenseBars.length > 0;

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      {hasData ? (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          {incomeBars.length > 0 && (
            <BentoCard title={t.laporan.aliran.incomeSourceLabel}>
              <FlowBars
                bars={incomeBars}
                tone="lime"
                ariaLabel={`${t.laporan.aliran.incomeSourceLabel}: ${incomeBars
                  .map((b) => b.label)
                  .join(", ")}`}
              />
            </BentoCard>
          )}
          {expenseBars.length > 0 && (
            <BentoCard title={t.laporan.aliran.expenseAllocLabel}>
              <FlowBars
                bars={expenseBars}
                tone="orange"
                ariaLabel={`${t.laporan.aliran.expenseAllocLabel}: ${expenseBars
                  .map((b) => b.label)
                  .join(", ")}`}
              />
            </BentoCard>
          )}
        </div>
      ) : (
        <BentoCard title={`${t.laporan.aliran.cardTitlePrefix} ${bulan}`}>
          <div className="lap-a-empty">
            <b>{t.laporan.aliran.emptyFlow}</b>
          </div>
        </BentoCard>
      )}
    </div>
  );
}
