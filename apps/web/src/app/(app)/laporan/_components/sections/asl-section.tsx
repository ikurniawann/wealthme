import { SectionCard } from "@/components/wm";
import { HBarChart } from "@/components/charts/apex-presets";
import { formatRupiah } from "@/lib/format";
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
            {balanceSheet ? formatRupiah(balanceSheet.totalAssets) : "Rp —"}
          </div>
        </div>
        <div className="rounded-[12px] border bg-card p-4">
          <div className="mb-1 text-[11px] text-muted-foreground">
            {t.laporan.totalLiabilitiesLabel}
          </div>
          <div className="text-[22px] font-black text-destructive">
            {balanceSheet
              ? `-${formatRupiah(balanceSheet.totalLiabilities)}`
              : "Rp —"}
          </div>
        </div>
      </div>
      {/* EPIC-026 Wave 3 — prototype's `#c-rasl` mount is the Apex hbar
          preset (J3 FOLD): every asset category then every liability
          category side by side, from the same balance-sheet breakdown
          this section already fetches. */}
      {balanceSheet &&
        (balanceSheet.assets.length > 0 ||
          balanceSheet.liabilities.length > 0) && (
          <SectionCard title={t.shell.reportTabs.rasl}>
            <HBarChart
              categories={[
                ...balanceSheet.assets.map((g) => g.category),
                ...balanceSheet.liabilities.map((g) => g.category),
              ]}
              data={[
                ...balanceSheet.assets.map((g) => g.amount),
                ...balanceSheet.liabilities.map((g) => g.amount),
              ]}
              ariaLabel={`${t.shell.reportTabs.rasl}: ${[
                ...balanceSheet.assets,
                ...balanceSheet.liabilities,
              ]
                .map((g) => `${g.category} ${formatRupiah(g.amount)}`)
                .join(", ")}`}
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
