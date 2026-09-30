"use client";

// EPIC-026 — prototype `ringkasan.html` block 2: the `.bento-grid` carrying
// `.hero.gradient-wealth.bento-span-5` plus three `.card.stat` cells
// (span-2 / span-2 / span-3 of the 12-column bento).

import { useQuery } from "@tanstack/react-query";
import { useLocale } from "@/hooks/use-locale";
import { BentoHero, HeroKpi } from "@/components/wm";
import { HatchedAreaChart } from "@/components/charts/bento-charts";
import { useGoldPrice } from "@/hooks/use-gold-price";
import { apiFetch } from "@/lib/api-client";
import type { RingkasanData } from "./use-ringkasan-data";
import {
  formatInDisplayCurrency,
  isForeignCurrency,
  type DisplayCurrency,
} from "./display-currency";

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
}: {
  data: RingkasanData;
  displayCurrency?: DisplayCurrency;
}) {
  const { t } = useLocale();
  // Same FX cache key as ConsolidatedTotalCard; gold uses the family's own price per gram.
  const { data: fx } = useQuery<FxRatesResponse>({
    queryKey: ["fx", "rates", "IDR"],
    queryFn: () => apiFetch<FxRatesResponse>("/fx/rates?base=IDR"),
    staleTime: 5 * 60_000,
    enabled: isForeignCurrency(displayCurrency),
  });
  const { pricePerGram } = useGoldPrice();
  const gramPrice = pricePerGram ? Number(pricePerGram) : null;
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
  return (
    <BentoHero
      className="rk2-hero private-scope"
      currency={null}
      value={
        <span className="private">{isLoading ? "..." : money(netWorth)}</span>
      }
      caption={
        <span className="private">
          {t.ringkasan.totalNetWorthLabel}
          {!isLoading &&
            ` · ${
              monthNet >= 0
                ? `${t.ringkasan.monthDeltaUpPrefix}${money(monthNet)}${t.ringkasan.monthDeltaSuffix}`
                : `${t.ringkasan.monthDeltaDownPrefix}${money(Math.abs(monthNet))}${t.ringkasan.monthDeltaSuffix}`
            }`}
        </span>
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
