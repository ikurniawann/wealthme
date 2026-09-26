import type { LiabilityRateBandDto } from "@wealthme/contracts";

export function ScheduleRateCell({
  bands,
  period,
  estimateLabel,
}: {
  bands: LiabilityRateBandDto[];
  period: number;
  estimateLabel: string;
}) {
  const band = bands.find(
    (b) => period >= b.fromPeriod && period <= b.toPeriod,
  );
  if (!band) return <>—</>;
  return (
    <>
      {band.ratePercent}%
      {band.kind === "floating" && (
        <span className="badge badge--warning ml-1">{estimateLabel}</span>
      )}
    </>
  );
}
