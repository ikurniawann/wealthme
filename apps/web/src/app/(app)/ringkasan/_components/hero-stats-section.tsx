"use client";

// Structural port fidelity follow-up — `docs/design/proto/ringkasan.html`'s
// `.r-hero` card: big number + green up/down delta PILL + an indicative
// "≈ $X · Y gr emas" multi-currency line, the compact currency/range/privacy
// control row (top-right, via `RingkasanPageLead`), an area trend chart, and
// the Total aset / Total liabilitas / Menabung bulan ini KPI column — all in
// one dark hero card. There is no page title row above it (see page.tsx).

import { useQuery } from "@tanstack/react-query";
import { useLocale } from "@/hooks/use-locale";
import { BentoHero, HeroKpi } from "@/components/wm";
import { StatusBadge } from "@/components/wm/badge";
import { HatchedAreaChart } from "@/components/charts/bento-charts";
import { useGoldPrice } from "@/hooks/use-gold-price";
import { apiFetch } from "@/lib/api-client";
import { formatRupiah } from "@/lib/format";
import type { RingkasanData } from "./use-ringkasan-data";
import {
  formatInDisplayCurrency,
  type DisplayCurrency,
} from "./display-currency";
import { RingkasanPageLead } from "./page-lead";
import type { TrendCustomRange, TrendRangeKey } from "./use-ringkasan-data";
import { formatGoldGrams } from "@/components/consolidated-total-card";

type FxRatesResponse = { base: string; rates: Record<string, number> };

/** Axis ticks without currency: "12 jt", "1,5 M". */
function compactAxis(value: number): string {
  const abs = Math.abs(value);
  const trim = (n: number) =>
    n.toFixed(1).replace(/\.0$/, "").replace(".", ",");
  if (abs >= 1e9) return `${trim(value / 1e9)} M`;
  if (abs >= 1e6) return `${trim(value / 1e6)} jt`;
  if (abs >= 1e3) return `${trim(value / 1e3)} rb`;
  return String(Math.round(value));
}

export function HeroStatsSection({
  data,
  displayCurrency = "IDR",
  trendRange,
  onTrendRangeChange,
  customRange,
  onCustomRangeChange,
  onDisplayCurrencyChange,
  privacyOn,
  onTogglePrivacy,
}: {
  data: RingkasanData;
  displayCurrency?: DisplayCurrency;
  trendRange: TrendRangeKey;
  onTrendRangeChange: (range: TrendRangeKey) => void;
  customRange: TrendCustomRange;
  onCustomRangeChange: (range: TrendCustomRange) => void;
  onDisplayCurrencyChange: (c: DisplayCurrency) => void;
  privacyOn: boolean;
  onTogglePrivacy: () => void;
}) {
  const { t } = useLocale();
  // Same FX cache key as ConsolidatedTotalCard; gold uses the family's own
  // price per gram. Fetched unconditionally — the hero's "≈ $X · Y gr emas"
  // multicur line (prototype `#multiCur`) always shows USD + gold alongside
  // whatever `displayCurrency` is selected.
  const { data: fx } = useQuery<FxRatesResponse>({
    queryKey: ["fx", "rates", "IDR"],
    queryFn: () => apiFetch<FxRatesResponse>("/fx/rates?base=IDR"),
    staleTime: 5 * 60_000,
  });
  const { pricePerGram } = useGoldPrice();
  const gramPrice = pricePerGram ? Number(pricePerGram) : null;
  const usdRate = fx?.rates.USD;
  const {
    isLoading,
    isNetWorthLoading,
    money: moneyIdr,
    netWorth,
    monthNet,
    totalAssets,
    totalLiabilities,
    savingsRate,
    monthExpense,
    accountTypeCount,
  } = data;
  const money = (v: number) =>
    formatInDisplayCurrency(v, displayCurrency, {
      formatIdr: moneyIdr,
      rates: fx?.rates,
      gramPrice,
    });

  const trend = data.netWorthTrendValues;
  // Prototype `#multiCur` — indicative USD + gold-gram equivalent of the net
  // worth, always shown under the delta pill regardless of `displayCurrency`.
  const multiCur =
    !isLoading && usdRate && gramPrice
      ? `≈ ${formatRupiah(netWorth, { code: "USD", rate: usdRate })} · ${formatGoldGrams(netWorth / gramPrice)}${t.consolidatedTotal.goldUnitSuffix}`
      : null;
  return (
    <BentoHero
      className="rk2-hero private-scope"
      currency={null}
      value={
        <span className="private">{isLoading ? "..." : money(netWorth)}</span>
      }
      caption={
        <span className="private rk2-hero-cap">
          <span>{t.ringkasan.totalNetWorthLabel}</span>
          {!isLoading && (
            <StatusBadge
              variant={monthNet >= 0 ? "success" : "danger"}
              className="rk2-hero-delta"
            >
              {monthNet >= 0
                ? `${t.ringkasan.monthDeltaUpPrefix}${money(monthNet)}${t.ringkasan.monthDeltaSuffix}`
                : `${t.ringkasan.monthDeltaDownPrefix}${money(Math.abs(monthNet))}${t.ringkasan.monthDeltaSuffix}`}
            </StatusBadge>
          )}
          {multiCur && <span className="rk2-hero-multicur">{multiCur}</span>}
        </span>
      }
      controls={
        <RingkasanPageLead
          trendRange={trendRange}
          onTrendRangeChange={onTrendRangeChange}
          customRange={customRange}
          onCustomRangeChange={onCustomRangeChange}
          displayCurrency={displayCurrency}
          onDisplayCurrencyChange={onDisplayCurrencyChange}
          privacyOn={privacyOn}
          onTogglePrivacy={onTogglePrivacy}
        />
      }
      chart={
        trend.length >= 2 ? (
          <div className="private wm-chart-fill">
            <HatchedAreaChart
              labels={data.netWorthTrendCategories}
              values={trend}
              format={(v) => money(v)}
              axis={compactAxis}
              floor={Math.min(0, ...trend)}
              ariaLabel={data.netWorthTrendAriaLabel}
            />
          </div>
        ) : (
          <p className="wm-cap">{data.netWorthTrendAriaLabel}</p>
        )
      }
      kpis={
        <>
          <HeroKpi
            label={t.ringkasan.totalAssetsLabel}
            value={
              <span className="private">
                {isLoading || isNetWorthLoading ? "..." : money(totalAssets)}
              </span>
            }
            delta={
              <small className="wm-cap">
                {accountTypeCount
                  ? `${accountTypeCount}${t.ringkasan.accountTypesSuffix}`
                  : t.ringkasan.noDataDash}
              </small>
            }
          />
          <HeroKpi
            label={t.ringkasan.totalLiabilitiesLabel}
            value={
              <span className="private">
                {isLoading || isNetWorthLoading
                  ? "..."
                  : money(totalLiabilities)}
              </span>
            }
            delta={
              <small className="wm-cap">
                {t.ringkasan.liabilitiesSublabel}
              </small>
            }
          />
          <HeroKpi
            label={t.ringkasan.savingsRateLabel}
            value={isLoading ? "..." : `${savingsRate}%`}
            delta={
              <small className="wm-cap private">
                {monthExpense > 0
                  ? `${t.ringkasan.expenseValuePrefix}${money(monthExpense)}`
                  : t.ringkasan.noDataDash}
              </small>
            }
          />
        </>
      }
    />
  );
}
