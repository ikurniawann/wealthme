"use client";

// EPIC-026 — prototype `ringkasan.html` block 4: the full-width
// "Rincian Aset vs Liabilitas" `.card` with a `.table-wrap > .table.table--num`
// (asset rows → Total Aset subtotal → liability rows → Total Liabilitas
// subtotal → Kekayaan Bersih).
//
// Honest UI: the prototype's "Ekspor" header link is omitted — it opens a mock
// dialog there, and this app exposes no ringkasan export endpoint.
//
// Every figure is derived from `netWorthData` / `summary` / `liabilities`
// already fetched by `use-ringkasan-data.ts` — no new endpoint, and each row
// reconciles with the stat cards above.

import { BentoCard, StatusBadge } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";
import { formatPercent1, type RingkasanData } from "./use-ringkasan-data";

/** Prototype's subtotal-row tint (`ringkasan.html` inline style). */
const SUBTOTAL_ROW_STYLE = {
  background: "color-mix(in oklab, var(--secondary) 55%, transparent)",
} as const;

export function BreakdownTableSection({ data }: { data: RingkasanData }) {
  const { t } = useLocale();
  const {
    isLoading,
    isNetWorthLoading,
    isLiabilitiesLoading,
    moneyFull,
    dateLocale,
    assetBreakdownRows,
    allLiabilities,
    totalAssets,
    totalLiabilities,
  } = data;

  const isBusy = isLoading || isNetWorthLoading || isLiabilitiesLoading;
  const isEmpty =
    assetBreakdownRows.length === 0 && allLiabilities.length === 0;

  return (
    <BentoCard
      className="rk2-breakdown"
      title={t.ringkasan.breakdownTableTitle}
    >
      <div style={{ padding: "6px 0 0" }}>
        {isBusy ? (
          <div className="mx-4 mb-4 h-[220px] animate-pulse rounded-md bg-muted" />
        ) : isEmpty ? (
          <div className="px-4 py-4 text-center t-md t-muted">
            {t.ringkasan.breakdownEmpty}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--num">
              <thead>
                <tr>
                  <th style={{ width: "42%" }}>
                    {t.ringkasan.breakdownColPos}
                  </th>
                  <th style={{ width: 130 }}>
                    {t.ringkasan.breakdownColJenis}
                  </th>
                  <th style={{ width: 90 }}>{t.ringkasan.breakdownColPorsi}</th>
                  <th>{t.ringkasan.breakdownColNilai}</th>
                </tr>
              </thead>
              <tbody>
                {assetBreakdownRows.map((row) => (
                  <tr key={row.key}>
                    <td className="t-bold">{row.label}</td>
                    <td>
                      <StatusBadge variant={row.badgeVariant}>
                        {row.badgeLabel}
                      </StatusBadge>
                    </td>
                    <td className="t-xs t-muted mono">
                      {totalAssets > 0
                        ? `${formatPercent1((row.amount / totalAssets) * 100, dateLocale)}%`
                        : t.ringkasan.noDataDash}
                    </td>
                    <td className="mono t-bold t-success private">
                      {moneyFull(row.amount)}
                    </td>
                  </tr>
                ))}
                {assetBreakdownRows.length > 0 && (
                  <tr style={SUBTOTAL_ROW_STYLE}>
                    <td className="t-bold">
                      {t.ringkasan.breakdownTotalAssetsRow}
                    </td>
                    <td />
                    <td className="t-xs t-muted mono">100%</td>
                    <td className="mono t-black t-success private">
                      {moneyFull(totalAssets)}
                    </td>
                  </tr>
                )}

                {allLiabilities.map((liability) => (
                  <tr key={liability.id}>
                    <td className="t-bold">{liability.name}</td>
                    <td>
                      <StatusBadge variant="danger">
                        {t.ringkasan.breakdownBadgeLiabilitas}
                      </StatusBadge>
                    </td>
                    <td className="t-xs t-muted mono">
                      {totalLiabilities > 0
                        ? `${formatPercent1((Number(liability.remainingBalance) / totalLiabilities) * 100, dateLocale)}%`
                        : t.ringkasan.noDataDash}
                    </td>
                    <td className="mono t-bold t-danger private">
                      {moneyFull(Number(liability.remainingBalance))}
                    </td>
                  </tr>
                ))}
                {allLiabilities.length > 0 && (
                  <tr style={SUBTOTAL_ROW_STYLE}>
                    <td className="t-bold">
                      {t.ringkasan.breakdownTotalLiabilitiesRow}
                    </td>
                    <td />
                    <td className="t-xs t-muted mono">100%</td>
                    <td className="mono t-black t-danger private">
                      {moneyFull(totalLiabilities)}
                    </td>
                  </tr>
                )}

                <tr>
                  <td className="t-black">
                    {t.ringkasan.breakdownNetWorthRow}
                  </td>
                  <td colSpan={2} className="t-xs t-muted">
                    {t.ringkasan.breakdownNetWorthFormula}
                  </td>
                  <td
                    className="mono t-black t-primary private"
                    style={{ fontSize: 15 }}
                  >
                    {moneyFull(totalAssets - totalLiabilities)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </BentoCard>
  );
}
