import { SectionCard } from "@/components/wm";
import { useMoney } from "@/hooks/use-money";
import { useLocale } from "@/hooks/use-locale";
import type { BalanceSheetDto } from "@wealthme/contracts";
import { BarRow } from "../atoms";
import { EXPENSE_COLOR } from "@/lib/viz-colors";

/* ───────────────────────── Section: Aset & Liabilitas ───────────────────────── */

export function AslSection({
  balanceSheet,
  isLoading,
}: {
  balanceSheet?: BalanceSheetDto;
  isLoading?: boolean;
}) {
  const { t } = useLocale();
  const money = useMoney();
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const debtRatio =
    balanceSheet && balanceSheet.totalAssets > 0
      ? Math.round(
          (balanceSheet.totalLiabilities / balanceSheet.totalAssets) * 100 * 10,
        ) / 10
      : null;

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <div className="rounded-[12px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">
            {t.laporan.totalAssetsLabel}
          </div>
          <div className="text-[22px] font-black text-success">
            {balanceSheet ? money.format(balanceSheet.totalAssets) : "Rp ·"}
          </div>
        </div>
        <div className="rounded-[12px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">
            {t.laporan.totalLiabilitiesLabel}
          </div>
          <div className="text-[22px] font-black">
            {balanceSheet
              ? `-${money.format(balanceSheet.totalLiabilities)}`
              : "Rp ·"}
          </div>
        </div>
      </div>
      {/* EPIC-026 Wave 3 — prototype's `#c-rasl` mount is the Apex hbar
          preset (J3 FOLD): every asset category then every liability
          category side by side, from the same balance-sheet breakdown
          this section already fetches.

          `category` for the physical-asset/liability buckets is the raw
          Prisma `Asset.type`/`Liability.type` enum value (e.g. "kartu_kredit",
          "kendaraan") — `reports.service.ts`'s `computeLiveBalanceSheet`
          groups by that code verbatim, unlike the snapshot-sourced buckets
          ("Kas & Setara Kas", "Investasi"), which already arrive
          human-labeled. Map through the SAME `assetTypeLabels`/
          `liabilitas.typeLabels` dictionaries `/aset` and `/liabilitas`
          already use for these exact codes, falling back to the raw string
          for any bucket that's already a label (Kas & Setara Kas, Investasi)
          — and mapping each side through its OWN dictionary is what turns
          the asset "kendaraan" into "Kendaraan" while the liability
          "kendaraan" becomes "Kredit Kendaraan", disambiguating the two
          without a manual asset/liability suffix. Colored green vs. red
          (not one flat hue) so a debt never reads as if it were savings. */}
      {balanceSheet &&
        (balanceSheet.assets.length > 0 ||
          balanceSheet.liabilities.length > 0) &&
        (() => {
          const rows = [
            ...balanceSheet.assets.map((g) => ({
              label:
                t.aset.assetTypeLabels[
                  g.category as keyof typeof t.aset.assetTypeLabels
                ] ?? g.category,
              amount: g.amount,
              color: "var(--wm-lime)",
            })),
            ...balanceSheet.liabilities.map((g) => ({
              label:
                t.liabilitas.typeLabels[
                  g.category as keyof typeof t.liabilitas.typeLabels
                ] ?? g.category,
              amount: g.amount,
              color: EXPENSE_COLOR,
            })),
          ];
          const maxAmount = Math.max(...rows.map((r) => r.amount), 0);
          return (
            <SectionCard
              title={t.shell.reportTabs.rasl}
              action={
                <div className="wm-legend">
                  <span>
                    <i style={{ background: "var(--wm-lime)" }} />
                    {t.laporan.balance.assetLabel}
                  </span>
                  <span>
                    <i style={{ background: EXPENSE_COLOR }} />
                    {t.laporan.balance.liabilitiesLabel}
                  </span>
                </div>
              }
            >
              <div className="flex flex-col gap-1.5">
                {rows.map((row) => (
                  <BarRow
                    key={row.label}
                    label={row.label}
                    right={money.format(row.amount)}
                    value={
                      maxAmount > 0
                        ? Math.round((row.amount / maxAmount) * 100)
                        : 0
                    }
                    color={row.color}
                  />
                ))}
              </div>
            </SectionCard>
          );
        })()}
      <SectionCard title={t.laporan.asetLiabilitas.ratioTitle}>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md bg-muted p-3">
            <div className="text-[10.5px] text-muted-foreground">
              {t.laporan.asetLiabilitas.debtRatioLabel}
            </div>
            <div
              className="text-[20px] font-extrabold"
              style={{
                color:
                  debtRatio !== null && debtRatio < 30
                    ? "var(--success)"
                    : "var(--warning)",
              }}
            >
              {debtRatio !== null ? `${debtRatio}%` : "—"}
            </div>
            <div
              className="text-[10.5px]"
              style={{
                color:
                  debtRatio !== null && debtRatio < 30
                    ? "var(--success)"
                    : "var(--warning)",
              }}
            >
              {debtRatio !== null && debtRatio < 30
                ? t.laporan.asetLiabilitas.safeLabel
                : t.laporan.asetLiabilitas.warningLabel}
            </div>
          </div>
          <div className="rounded-md bg-muted p-3">
            <div className="text-[10.5px] text-muted-foreground">
              {t.laporan.netWorthLabel}
            </div>
            <div
              className="text-[20px] font-extrabold"
              style={{ color: "var(--success)" }}
            >
              {balanceSheet ? money.format(balanceSheet.netWorth) : "—"}
            </div>
            <div className="text-[10.5px]" style={{ color: "var(--success)" }}>
              {t.laporan.asetLiabilitas.netWorthDesc}
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
