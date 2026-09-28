import { SectionCard } from "@/components/wm";
import { cssVar, useThemeRebuildToken } from "@/components/charts/apex-base";
import { HBarChart } from "@/components/charts/apex-presets";
import { useMoney } from "@/hooks/use-money";
import { formatJuta } from "@/lib/laporan-utils";
import { useLocale } from "@/hooks/use-locale";
import type { BalanceSheetDto } from "@wealthme/contracts";

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
  // Forces a re-render (and a fresh `cssVar()` read below) on a theme flip —
  // same idiom `AllocationCard`/the chart presets use; --success/--destructive
  // are re-read live rather than baked in once at first render.
  useThemeRebuildToken();
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
          <div className="text-[22px] font-black text-destructive">
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
          balanceSheet.liabilities.length > 0) && (
          <SectionCard title={t.shell.reportTabs.rasl}>
            <HBarChart
              categories={[
                ...balanceSheet.assets.map(
                  (g) =>
                    t.aset.assetTypeLabels[
                      g.category as keyof typeof t.aset.assetTypeLabels
                    ] ?? g.category,
                ),
                ...balanceSheet.liabilities.map(
                  (g) =>
                    t.liabilitas.typeLabels[
                      g.category as keyof typeof t.liabilitas.typeLabels
                    ] ?? g.category,
                ),
              ]}
              data={[
                ...balanceSheet.assets.map((g) => g.amount),
                ...balanceSheet.liabilities.map((g) => g.amount),
              ]}
              colors={[
                ...balanceSheet.assets.map(() => cssVar("--success")),
                ...balanceSheet.liabilities.map(() => cssVar("--destructive")),
              ]}
              showXAxisLabels
              ariaLabel={`${t.shell.reportTabs.rasl}: ${[
                ...balanceSheet.assets,
                ...balanceSheet.liabilities,
              ]
                .map((g) => `${g.category} ${money.format(g.amount)}`)
                .join(", ")}`}
              money={money}
            />
          </SectionCard>
        )}
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
              {balanceSheet ? formatJuta(balanceSheet.netWorth) : "—"}
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
