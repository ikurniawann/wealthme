"use client";

// EPIC-026 — prototype `ringkasan.html` block 2: the `.bento-grid` carrying
// `.hero.gradient-wealth.bento-span-5` plus three `.card.stat` cells
// (span-2 / span-2 / span-3 of the 12-column bento).

import { useQuery } from "@tanstack/react-query";
import { useLocale } from "@/hooks/use-locale";
import { useGoldPrice } from "@/hooks/use-gold-price";
import { apiFetch } from "@/lib/api-client";
import type { RingkasanData } from "./use-ringkasan-data";
import type { DisplayCurrency } from "./page-lead";

type FxRatesResponse = { base: string; rates: Record<string, number> };

export function HeroStatsSection({
  data,
  displayCurrency = "IDR",
}: {
  data: RingkasanData;
  displayCurrency?: DisplayCurrency;
}) {
  const { t } = useLocale();
  // EPIC-033 group 5 (p30) — the headline figures can be read in USD or
  // gram-emas. Same FX cache key as ConsolidatedTotalCard; gold uses the
  // family's own manually-entered price per gram.
  const { data: fx } = useQuery<FxRatesResponse>({
    queryKey: ["fx", "rates", "IDR"],
    queryFn: () => apiFetch<FxRatesResponse>("/fx/rates?base=IDR"),
    staleTime: 5 * 60_000,
    enabled: displayCurrency === "USD",
  });
  const { pricePerGram } = useGoldPrice();
  const usdRate = fx?.rates["USD"];
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
  const money = (v: number) => {
    if (displayCurrency === "USD") {
      return usdRate
        ? `$ ${Math.round(v * usdRate).toLocaleString("en-US")}`
        : "...";
    }
    if (displayCurrency === "GOLD") {
      return gramPrice
        ? `${(v / gramPrice).toLocaleString("id-ID", { maximumFractionDigits: 2 })} gr`
        : "...";
    }
    return moneyIdr(v);
  };

  return (
    <section className="bento-grid">
      <article className="hero gradient-wealth bento-span-5">
        <div>
          <div className="hero__label">{t.ringkasan.totalNetWorthLabel}</div>
          <div className="hero__value mono private" style={{ fontSize: 24 }}>
            {isLoading ? "..." : money(netWorth)}
          </div>
          <div
            className="t-xs private"
            style={{ marginTop: 8, color: "#a7f3d0" }}
          >
            {isLoading
              ? "..."
              : monthNet >= 0
                ? `${t.ringkasan.monthDeltaUpPrefix}${money(monthNet)}${t.ringkasan.monthDeltaSuffix}`
                : `${t.ringkasan.monthDeltaDownPrefix}${money(Math.abs(monthNet))}${t.ringkasan.monthDeltaSuffix}`}
          </div>
        </div>
      </article>

      <article className="card stat bento-span-2">
        <div>
          <div className="stat__label">{t.ringkasan.totalAssetsLabel}</div>
          <div className="stat__value mono t-success private">
            {isLoading || isNetWorthLoading ? "..." : money(totalAssets)}
          </div>
        </div>
        <div className="stat__delta t-muted">
          {accountTypeCount
            ? `${accountTypeCount}${t.ringkasan.accountTypesSuffix}`
            : t.ringkasan.noDataDash}
        </div>
      </article>

      <article className="card stat bento-span-2">
        <div>
          <div className="stat__label">{t.ringkasan.totalLiabilitiesLabel}</div>
          <div className="stat__value mono t-muted private">
            {isLoading || isNetWorthLoading ? "..." : money(totalLiabilities)}
          </div>
        </div>
        <div className="stat__delta t-muted">
          {t.ringkasan.liabilitiesSublabel}
        </div>
      </article>

      <article className="card stat bento-span-3">
        <div>
          <div className="stat__label">{t.ringkasan.savingsRateLabel}</div>
          <div className="stat__value t-primary">
            {isLoading ? "..." : `${savingsRate}%`}
          </div>
        </div>
        <div className="stat__delta t-success private">
          {monthExpense > 0
            ? `${t.ringkasan.expenseValuePrefix}${money(monthExpense)}`
            : t.ringkasan.noDataDash}
        </div>
      </article>
    </section>
  );
}
