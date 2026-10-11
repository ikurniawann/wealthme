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
import { formatAxisMoney, formatRupiah } from "@/lib/format";
import { useMoney } from "@/hooks/use-money";
import { DELTA_ARROW, deltaSrText, deltaTone } from "@/lib/delta";
import type { RingkasanData } from "./use-ringkasan-data";
import {
  formatInDisplayCurrency,
  type DisplayCurrency,
} from "./display-currency";
import { RingkasanPageLead } from "./page-lead";
import type { TrendCustomRange, TrendRangeKey } from "./use-ringkasan-data";
import { formatGoldGrams } from "@/components/consolidated-total-card";

type FxRatesResponse = { base: string; rates: Record<string, number> };

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
    // Headline/KPI figures are always full ("Rp 1.967.216.000"); compact is
    // reserved for chart axes (see format.ts number-format policy).
    moneyFull: moneyIdr,
    netWorth,
    monthNet,
    totalAssets,
    totalLiabilities,
    savingsRate,
    savingsWindowLabel,
    monthExpense,
    accountTypeCount,
  } = data;
  const isError = data.isError ?? false;
  const profileMoney = useMoney();
  // Axis ticks follow the hero's own currency switch: a foreign pick converts
  // with its rate, gold reads in grams, IDR falls back to the profile currency.
  const axis = (v: number): string => {
    if (displayCurrency === "GOLD") {
      return gramPrice
        ? `${formatAxisMoney(v / gramPrice, "IDR").replace("Rp\u00A0", "")} gr`
        : "";
    }
    const rate = fx?.rates[displayCurrency];
    if (displayCurrency !== "IDR" && rate)
      return formatAxisMoney(v * rate, displayCurrency);
    return profileMoney.formatAxis(v);
  };
  const money = (v: number) =>
    formatInDisplayCurrency(v, displayCurrency, {
      formatIdr: moneyIdr,
      rates: fx?.rates,
      gramPrice,
    });

  const trend = data.netWorthTrendValues;
  const hasTrend = trend.filter((v) => v !== 0).length >= 2;
  // No trend yet → Aset vs Liabilitas composition from the same totals the KPI
  // column shows (no fabricated history).
  const compAssets = Math.max(0, totalAssets);
  const compLiabilities = Math.max(0, totalLiabilities);
  const compTotal = compAssets + compLiabilities;
  const compPct = (v: number) =>
    v > 0 && v / compTotal < 0.01
      ? "<1%"
      : `${Math.round((v / compTotal) * 100)}%`;
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
        <span className="private">
          {isError ? "—" : isLoading ? "..." : money(netWorth)}
        </span>
      }
      caption={
        <span className="private rk2-hero-cap">
          <span>{t.ringkasan.totalNetWorthLabel}</span>
          {!isLoading &&
            !isError &&
            (() => {
              // Shared delta rule (lib/delta.ts): arrow = direction of the
              // month's net change, colour + sr-only text = valence.
              const dir = monthNet > 0 ? "up" : monthNet < 0 ? "down" : "flat";
              const tone = deltaTone(dir);
              return (
                <StatusBadge
                  variant={
                    tone === "good"
                      ? "success"
                      : tone === "bad"
                        ? "danger"
                        : "gray"
                  }
                  className="rk2-hero-delta"
                >
                  <span aria-hidden="true">{DELTA_ARROW[dir]} </span>
                  {money(Math.abs(monthNet))}
                  {t.ringkasan.monthDeltaSuffix}
                  <span className="sr-only">
                    , {deltaSrText(dir, tone, t.common.delta)}
                  </span>
                </StatusBadge>
              );
            })()}
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
          // The range select only drives the trend. While no trend is drawn
          // on the default window it would change nothing; any other window
          // keeps it so the user can get back out.
          showTrendRange={hasTrend || trendRange !== "12m"}
        />
      }
      chart={
        hasTrend ? (
          <div className="private wm-chart-fill">
            <HatchedAreaChart
              labels={data.netWorthTrendCategories}
              values={trend}
              format={(v) => money(v)}
              axis={axis}
              floor={Math.min(0, ...trend)}
              ariaLabel={data.netWorthTrendAriaLabel}
            />
          </div>
        ) : (
          <div className="rk2-mix" role="status">
            {!isLoading && !isNetWorthLoading && compTotal > 0 && (
              <div className="rk2-mix-viz private">
                <div
                  className="rk2-mix-bar"
                  role="img"
                  aria-label={`${t.ringkasan.totalAssetsLabel} ${money(totalAssets)}, ${t.ringkasan.totalLiabilitiesLabel} ${money(totalLiabilities)}`}
                >
                  <span
                    className="rk2-mix-seg rk2-mix-seg--asset"
                    style={{ flexGrow: compAssets }}
                    title={money(totalAssets)}
                  />
                  {compLiabilities > 0 && (
                    <span
                      className="rk2-mix-seg rk2-mix-seg--liab"
                      style={{ flexGrow: compLiabilities }}
                      title={money(totalLiabilities)}
                    />
                  )}
                </div>
                <div className="rk2-mix-legend" aria-hidden="true">
                  <span title={money(totalAssets)}>
                    <i className="rk2-mix-dot rk2-mix-dot--asset" />
                    {t.ringkasan.totalAssetsLabel} {compPct(compAssets)}
                  </span>
                  <span title={money(totalLiabilities)}>
                    <i className="rk2-mix-dot rk2-mix-dot--liab" />
                    {t.ringkasan.totalLiabilitiesLabel}{" "}
                    {compPct(compLiabilities)}
                  </span>
                </div>
              </div>
            )}
            <p className="wm-cap">
              {isNetWorthLoading ? "..." : t.ringkasan.emptyNetWorthTrend}
            </p>
          </div>
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
            label={`${t.ringkasan.savingsRateLabel} · ${savingsWindowLabel}`}
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
