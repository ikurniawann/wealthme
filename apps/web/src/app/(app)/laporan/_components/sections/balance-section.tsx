import { Fragment } from "react";
import { SectionCard } from "@/components/wm";
import { useMoney } from "@/hooks/use-money";
import { computeBalanceSheetIdentity, formatJuta } from "@/lib/laporan-utils";
import { useLocale } from "@/hooks/use-locale";
import type {
  BalanceSheetDto,
  NetWorthDto,
  ReconciliationBridgeDto,
} from "@wealthme/contracts";
import { formatLocaleDateLong } from "../date-helpers";
import { ReconciliationBridgeCard, StatementRow } from "../atoms";

/* ───────────────────────── Section: Balance Sheet ───────────────────────── */

export function BalanceSection({
  balanceSheet,
  isLoading,
  dashboardNetWorth,
  isDashboardNetWorthLoading,
  reconciliationBridge,
  isBridgeLoading,
}: {
  balanceSheet?: BalanceSheetDto;
  isLoading?: boolean;
  /** Independently computed net worth from a different service/query path
   * (`/dashboard/net-worth`) — the only genuine cross-check available; see
   * computeBalanceSheetIdentity's doc comment for why an in-payload check
   * can never be falsifiable here. */
  dashboardNetWorth?: NetWorthDto;
  isDashboardNetWorthLoading?: boolean;
  /** EPIC-023 B3 (D24, US-RPT-11) — why profit and net-worth change disagree. */
  reconciliationBridge?: ReconciliationBridgeDto;
  isBridgeLoading?: boolean;
}) {
  const { t, locale } = useLocale();
  const money = useMoney();
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const hasData = balanceSheet ? balanceSheet.dataAvailable !== false : true;
  // EPIC-023 Task B retry (CRITICAL 2) — distinct from the generic "no
  // snapshot for this date" case: a snapshot DOES exist, it just cannot be
  // shown to this viewer (see `restrictedForViewer`'s doc comment on the
  // contract).
  const isRestrictedForViewer = balanceSheet?.restrictedForViewer === true;
  const asOf = balanceSheet
    ? formatLocaleDateLong(balanceSheet.asOfDate, locale)
    : "—";
  const debtRatio =
    balanceSheet && balanceSheet.totalAssets > 0
      ? `${Math.round((balanceSheet.totalLiabilities / balanceSheet.totalAssets) * 100 * 10) / 10}%`
      : "—";

  // EPIC-022 B1 — the "Total L+E" row always shows the real value (Total
  // Liabilities + Equity), never a re-display of totalAssets. The ✅/⚠️
  // banner below is a SEPARATE cross-source check — see
  // computeBalanceSheetIdentity's doc comment for why two prior in-payload
  // comparisons were both unfalsifiable, and why comparing against the
  // dashboard's independently computed net worth is the one that isn't.
  const { totalLiabilitiesPlusEquity, diff, isBalanced } =
    computeBalanceSheetIdentity(
      balanceSheet ?? { totalLiabilities: 0, netWorth: 0 },
      dashboardNetWorth,
    );
  // EPIC-023 Task B retry (HIGH) — `dashboardNetWorth` is always LIVE (no
  // date param on `/dashboard/net-worth`), so this cross-check is only
  // meaningful when `balanceSheet` is ALSO a live/current figure
  // (`isHistorical === false`). Comparing a historical snapshot against
  // today's live net worth would fire a false "⚠️ Tidak Seimbang" on every
  // past period, even when the books genuinely reconcile.
  const identityCheckApplicable =
    Boolean(balanceSheet) && hasData && balanceSheet?.isHistorical === false;
  const isCheckPending =
    identityCheckApplicable &&
    (isDashboardNetWorthLoading || isBalanced === null);

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div>
        <div className="text-[15px] font-bold">
          {t.laporan.balance.titlePrefix} {asOf}
        </div>
        {/* EPIC-023 B2 (closes EPIC-022 B11) — figures now come from a real
            `NetWorthSnapshot` when one exists (`isHistorical`); the "these
            are current balances, not historical" disclosure only applies to
            the live-fallback path (a family with no snapshot history yet). */}
        {balanceSheet && hasData && !balanceSheet.isHistorical && (
          <div className="text-[10.5px] text-muted-foreground">
            {t.laporan.balance.currentBalanceDisclosure}
          </div>
        )}
      </div>
      {balanceSheet && !hasData && (
        <div className="flex items-start gap-3 rounded-[12px] border border-border bg-muted/40 p-3.5">
          <div className="text-[22px]">
            {isRestrictedForViewer ? "🔒" : "🕘"}
          </div>
          <div>
            <div className="text-[13px] font-bold">
              {isRestrictedForViewer
                ? t.laporan.balance.restrictedForViewerTitle
                : t.laporan.balance.noDataTitle}
            </div>
            <div className="text-[12px] text-muted-foreground">
              {isRestrictedForViewer
                ? t.laporan.balance.restrictedForViewerDescription
                : t.laporan.balance.noDataDescription}
            </div>
          </div>
        </div>
      )}
      {/* EPIC-023 Task B retry (CRITICAL 3) — without real figures behind
          it, the asset/liability tables below used to render a fake
          "Total Aset: Rp 0" / "Net Worth: 0" over the honest banner above. */}
      {hasData && (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <SectionCard
            title={
              <span className="text-success">
                {t.laporan.balance.assetLabel}
              </span>
            }
          >
            <table className="w-full border-collapse text-[12.5px]">
              <tbody>
                {balanceSheet?.assets.map((group) => (
                  <Fragment key={`g-${group.category}`}>
                    <StatementRow
                      label={group.category}
                      labelClass="py-1.5 font-bold text-muted-foreground"
                    />
                    {group.items.map((item) => (
                      <StatementRow
                        key={item.name}
                        label={item.name}
                        value={formatJuta(item.amount)}
                        indent
                      />
                    ))}
                  </Fragment>
                ))}
                <StatementRow
                  label={t.laporan.totalAssetsLabel}
                  value={
                    balanceSheet ? formatJuta(balanceSheet.totalAssets) : "—"
                  }
                  className="border-t-2 border-success"
                  labelClass="py-2 font-extrabold"
                  valueClass="font-extrabold text-success"
                />
              </tbody>
            </table>
          </SectionCard>
          <SectionCard
            title={
              <span className="text-destructive">
                {t.laporan.balance.liabilityEquityLabel}
              </span>
            }
          >
            <table className="w-full border-collapse text-[12.5px]">
              <tbody>
                <StatementRow
                  label={t.laporan.balance.liabilitiesLabel}
                  labelClass="py-1.5 font-bold text-muted-foreground"
                />
                {balanceSheet?.liabilities.map((group) => (
                  <Fragment key={`g-${group.category}`}>
                    <StatementRow
                      label={group.category}
                      labelClass="py-1 text-[11px] text-muted-foreground"
                      indent
                    />
                    {group.items.map((item) => (
                      <StatementRow
                        key={item.name}
                        label={item.name}
                        value={formatJuta(item.amount)}
                        indent
                      />
                    ))}
                  </Fragment>
                ))}
                <StatementRow
                  label={t.laporan.totalLiabilitiesLabel}
                  value={
                    balanceSheet
                      ? formatJuta(balanceSheet.totalLiabilities)
                      : "—"
                  }
                  className="border-b border-border"
                  labelClass="py-1.5 font-bold"
                  valueClass="font-bold text-destructive"
                />
                <StatementRow
                  label={t.laporan.balance.equityLabel}
                  labelClass="py-1.5 font-bold text-muted-foreground"
                />
                <StatementRow
                  label={t.laporan.netWorthLabel}
                  value={balanceSheet ? formatJuta(balanceSheet.netWorth) : "—"}
                  indent
                />
                <StatementRow
                  label={t.laporan.balance.totalLPlusELabel}
                  value={
                    balanceSheet ? formatJuta(totalLiabilitiesPlusEquity) : "—"
                  }
                  className="border-t-2 border-primary"
                  labelClass="py-2 font-extrabold"
                  valueClass="font-extrabold text-primary"
                />
              </tbody>
            </table>
          </SectionCard>
        </div>
      )}
      {isCheckPending && (
        <div className="flex items-center gap-2 rounded-[12px] border border-border bg-muted/40 p-3 text-[12px] text-muted-foreground">
          {t.laporan.balance.checkingLabel}
        </div>
      )}
      {identityCheckApplicable && isBalanced === true && (
        <div className="flex items-start gap-3 rounded-[12px] border border-primary/20 bg-accent p-3.5">
          <div className="text-[22px]">✅</div>
          <div>
            <div className="text-[13px] font-bold text-primary-strong">
              {t.laporan.balance.balancedTitle}
            </div>
            <div className="text-[12px] text-muted-foreground">
              {t.laporan.balance.balancedDescPrefix} {debtRatio}.
            </div>
          </div>
        </div>
      )}
      {identityCheckApplicable && isBalanced === false && (
        <div className="flex items-start gap-3 rounded-[12px] border border-warning/30 bg-warning-soft p-3.5">
          <div className="text-[22px]">⚠️</div>
          <div>
            <div className="text-[13px] font-bold text-warning">
              {t.laporan.balance.imbalancedTitle}
            </div>
            <div className="text-[12px] text-muted-foreground">
              {t.laporan.balance.imbalancedDescPrefix}{" "}
              {money.format(Math.abs(diff))}.
            </div>
          </div>
        </div>
      )}
      <ReconciliationBridgeCard
        bridge={reconciliationBridge}
        isLoading={isBridgeLoading}
      />
    </div>
  );
}
