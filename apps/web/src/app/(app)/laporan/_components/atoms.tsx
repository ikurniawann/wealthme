import { useId } from "react";

import { ProgressBar, SectionCard } from "@/components/wm";
import { formatJuta } from "@/lib/laporan-utils";
import { useLocale } from "@/hooks/use-locale";
import {
  DELTA_ARROW,
  deltaSrText,
  describeDelta,
  type DeltaPolarity,
} from "@/lib/delta";
import type { ReconciliationBridgeDto } from "@wealthme/contracts";

/* ───────────────────────── Small helpers ───────────────────────── */

/** Compact 4-up stat block (the demo's `.laporan-stats`). */
export function StatTile({
  label,
  value,
  valueClass,
  hint,
}: {
  label: string;
  value: string;
  valueClass?: string;
  hint?: React.ReactNode;
}) {
  return (
    <div className="lp-stat">
      <div>
        <div className="lp-stat-l">{label}</div>
        <div className={"lp-stat-v " + (valueClass ?? "")}>
          {value}
          {hint}
        </div>
      </div>
    </div>
  );
}

/** Activity row (the demo's `.act-item`). */
export function ActItem({
  icon,
  iconBg,
  iconColor,
  iconSize = "16px",
  name,
  cat,
  right,
  last,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor?: string;
  iconSize?: string;
  name: string;
  cat?: string;
  right: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className="lp-act" data-last={last ? "" : undefined}>
      <div
        className="flex size-[38px] shrink-0 items-center justify-center rounded-[12px] font-bold"
        style={{ background: iconBg, color: iconColor, fontSize: iconSize }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold">{name}</div>
        {cat && <div className="text-[11px] text-muted-foreground">{cat}</div>}
      </div>
      <div className="text-right">{right}</div>
    </div>
  );
}

/** Labelled progress row (the demo's progress-bar blocks). */
export function BarRow({
  label,
  right,
  value,
  color,
}: {
  label: React.ReactNode;
  right: React.ReactNode;
  value: number;
  color: string;
}) {
  const labelId = useId();

  return (
    <div className="lp-bar">
      <span id={labelId} className="lp-bar-l">
        {label}
      </span>
      <ProgressBar
        value={value}
        color={color}
        height={8}
        ariaLabelledBy={labelId}
      />
      <span className="lp-bar-r">{right}</span>
    </div>
  );
}

/** Up/down change chip (prototype's `chg()`), driven by the shared delta rule
 * (lib/delta.ts): the arrow is the direction previous → current, the tone and
 * the sr-only text are the valence for `polarity` (spending that fell is a ↓
 * in the good colour). Renders nothing when there is no base to compare. */
export function ChgBadge({
  previous,
  current,
  polarity,
}: {
  previous: number;
  current: number;
  polarity: DeltaPolarity;
}) {
  const { t } = useLocale();
  const delta = describeDelta(previous, current, polarity);
  if (!delta) return null;
  return (
    <span className="lp-chg" data-tone={delta.tone}>
      <span aria-hidden="true">{DELTA_ARROW[delta.dir]}</span>
      {Math.abs(Math.round(delta.pct))}%
      <span className="sr-only">
        {deltaSrText(delta.dir, delta.tone, t.common.delta)}
      </span>
    </span>
  );
}

export function StatementRow({
  label,
  value,
  indent,
  valueColor,
  className,
  labelClass,
  valueClass,
}: {
  label: React.ReactNode;
  value?: React.ReactNode;
  indent?: boolean;
  valueColor?: string;
  className?: string;
  labelClass?: string;
  valueClass?: string;
}) {
  return (
    <tr className={className}>
      <td
        className={"py-[7px] " + (indent ? "pl-3.5 " : "") + (labelClass ?? "")}
      >
        {label}
      </td>
      <td
        className={"mono py-[7px] text-right " + (valueClass ?? "")}
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </td>
    </tr>
  );
}

/**
 * EPIC-023 B3 (D24, US-RPT-11; rewrite, attempt 3) — answers "why is my
 * profit X but my wealth up Y" on screen: opening/closing net worth from
 * the snapshots, profit, a `contribution` figure, a single combined
 * asset+investment `holdingsChange` figure, and — only when non-zero — an
 * honestly-named `unexplained` residual (see `getReconciliationBridge`'s
 * doc comment on the API side for why the identity does not always hold,
 * e.g. a Receivable movement).
 *
 * EPIC-023 Task B3 review (HIGH x2, FIX 1) — every row from Opening through
 * Unexplained is now a real addend of the identity `opening + profit −
 * contribution + holdingsChange + unexplained = closing`, and reading the
 * table top to bottom sums to `bridgeClosingLabel`'s value. Previously
 * `contribution` was rendered as a small indented `↳` memo showing its raw
 * (unsubtracted) sign — reading the rows top to bottom produced a number
 * that did NOT match Closing. The contribution row now displays
 * `-bridge.contribution` (the amount it actually subtracts from the running
 * total), at full size, not as a memo.
 */
export function ReconciliationBridgeCard({
  bridge,
  isLoading,
}: {
  bridge?: ReconciliationBridgeDto;
  isLoading?: boolean;
}) {
  const { t } = useLocale();
  if (!bridge) return null;
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  // EPIC-023 Task B retry (CRITICAL 2) — distinct from the generic "not
  // enough history" no-data case: a snapshot exists, it just cannot be
  // shown to this viewer (see `restrictedForViewer`'s doc comment).
  const isRestrictedForViewer = bridge.restrictedForViewer === true;
  // EPIC-023 Task B3 review (LOW, batch fix 6) — the `bridge.dataAvailable
  // &&` clause used to be here too, but this value is only ever read inside
  // the `bridge.dataAvailable === true` branch below, so it was dead.
  // `Number.isFinite` guards against a deploy-skew payload (an older API
  // build, or a network hiccup) delivering `undefined`/`NaN` for
  // `unexplained` — treat that as "no warning" rather than rendering NaN.
  const hasUnexplained =
    Number.isFinite(bridge.unexplained) && bridge.unexplained !== 0;
  const netWorthChange = bridge.closing - bridge.opening;

  return (
    <SectionCard
      title={t.laporan.balance.bridgeTitle}
      bodyClassName={loadingClass}
    >
      <div className="text-[11.5px] text-muted-foreground mb-2">
        {t.laporan.balance.bridgeDescription}
      </div>
      {!bridge.dataAvailable ? (
        <div className="text-[12px] text-muted-foreground">
          {isRestrictedForViewer
            ? t.laporan.balance.bridgeRestrictedDescription
            : t.laporan.balance.bridgeNoDataDescription}
        </div>
      ) : (
        <table className="w-full border-collapse text-[12.5px]">
          <tbody>
            <StatementRow
              label={t.laporan.balance.bridgeOpeningLabel}
              value={formatJuta(bridge.opening)}
              labelClass="py-1.5 font-semibold text-muted-foreground"
            />
            <StatementRow
              label={t.laporan.balance.bridgeProfitLabel}
              value={formatJuta(bridge.profit)}
              indent
            />
            {/* A real subtrahend now, not a memo — displays the SIGNED
                amount this row actually subtracts from the running total
                (`-bridge.contribution`), so it participates correctly in
                the top-to-bottom sum. */}
            <StatementRow
              label={t.laporan.balance.bridgeContributionLabel}
              value={formatJuta(-bridge.contribution)}
              indent
            />
            <StatementRow
              label={t.laporan.balance.bridgeHoldingsChangeLabel}
              value={formatJuta(bridge.holdingsChange)}
              indent
            />
            {/* Shown only when non-zero — an honest residual, not a term
                that is always present. See this component's doc comment.
                EPIC-023 Task B3 review (MEDIUM, FIX 5) — an icon and bold
                text carry the warning, not colour alone. */}
            {hasUnexplained && (
              <StatementRow
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true">⚠️</span>
                    <span className="font-bold">
                      <span className="sr-only">
                        {t.laporan.balance.bridgeUnexplainedWarningPrefix}{" "}
                      </span>
                      {t.laporan.balance.bridgeUnexplainedLabel}
                    </span>
                  </span>
                }
                value={formatJuta(bridge.unexplained)}
                indent
                labelClass="py-1.5 text-warning"
                valueClass="font-bold text-warning"
              />
            )}
            <StatementRow
              label={t.laporan.balance.bridgeClosingLabel}
              value={formatJuta(bridge.closing)}
              className="border-t-2 border-primary"
              labelClass="py-2 font-extrabold"
              valueClass="font-extrabold text-primary"
            />
            <StatementRow
              label={t.laporan.balance.bridgeNetWorthChangeLabel}
              value={formatJuta(netWorthChange)}
              labelClass="pt-2 text-muted-foreground"
              valueClass="text-muted-foreground"
            />
          </tbody>
        </table>
      )}
    </SectionCard>
  );
}
