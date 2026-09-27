"use client";

import { useRouter } from "next/navigation";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { DashboardSummaryDto } from "@wealthme/contracts";
import { SparklineChart } from "@/components/charts/apex-presets";
import { CountUpRupiah, HeroCard } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";
import { useGoldPrice } from "@/hooks/use-gold-price";
import { cn } from "@/lib/utils";
import { formatGoldGrams } from "@/components/consolidated-total-card";
import type { MoneyFormatters } from "./use-beranda-data";

/**
 * EPIC-026 Wave 8 — `docs/prototype/pages/beranda.html`'s
 * `.hero.gradient-wealth.bento-hero`: `.bento-hero__top` (label + `.hero__value`
 * + a `.badge` / `.t-xs` delta row) above a three-cell `.bento-hero__footer`.
 *
 * The prototype's hero has no sparkline; this one keeps it because the series
 * is real persisted net-worth history driven by the Arus Kas range toggle —
 * dropping it would orphan a live query, not remove decoration.
 */
export function BerandaHero({
  isLoading,
  netWorth,
  assetsTotal,
  totalLiabilities,
  currentMonth,
  sparklinePoints,
  fmt,
}: {
  isLoading: boolean;
  netWorth: number;
  assetsTotal: number;
  totalLiabilities: number;
  currentMonth: DashboardSummaryDto["currentMonth"] | undefined;
  sparklinePoints: number[];
  fmt: MoneyFormatters;
}) {
  const router = useRouter();
  const { t } = useLocale();
  // EPIC-021 Group F (#6) — the hero card's gold-equivalent line (part of
  // the consolidated IDR/USD/gram-emas total, Open Design Decision #6).
  const { hasPrice: hasGoldPrice, toGoldGrams } = useGoldPrice();
  const goldGrams = hasGoldPrice ? toGoldGrams(netWorth) : null;

  const { money, moneyCompact, currency, isIndicative, isReady, formatMoney } =
    fmt;

  // EPIC-025 N3-G1 — chart-parity aria label: every value below is read from
  // the same series the chart renders, never a separately-computed number.
  const sparklineAriaLabel =
    sparklinePoints.length >= 2
      ? `${t.beranda.totalWealth}: ${money(sparklinePoints[0]!)} → ${money(
          sparklinePoints[sparklinePoints.length - 1]!,
        )}`
      : t.beranda.totalWealth;

  const isUp = (currentMonth?.net ?? 0) >= 0;
  // Batch 2 (#3) — the hero's base treatment must track `netWorth`'s own
  // sign, not `currentMonth.net` (that's the separate "did I improve this
  // month" trend pill below, left as-is). `globals.css`/`design-system.css`
  // are protected, so this is an arbitrary Tailwind bg utility built from
  // the existing `--warning` token rather than a new `gradient-warning`
  // global class.
  const isNetWorthNegative = netWorth < 0;

  return (
    <HeroCard
      className={cn(
        "bento-hero",
        isNetWorthNegative
          ? "bg-[linear-gradient(135deg,var(--warning)_0%,color-mix(in_oklab,var(--warning)_70%,black)_55%,var(--warning)_100%)]"
          : "gradient-wealth",
      )}
    >
      <div className="bento-hero__top">
        <div className="min-w-0">
          <div className="hero__label" id="beranda-net-worth-label">
            {t.beranda.totalWealth}
          </div>
          {/* EPIC-026 Wave 3 — the eye "toggle" here had no onClick (dead
              control, not in the prototype hero either) — removed per the J1
              honest-UI rule. */}
          <h1
            className="hero__value mono"
            aria-labelledby="beranda-net-worth-label"
          >
            {isLoading || (isIndicative && !isReady) ? (
              t.common.loading
            ) : isIndicative ? (
              <>≈ {formatMoney(netWorth)}</>
            ) : (
              <CountUpRupiah value={netWorth} />
            )}
          </h1>

          {isIndicative && (
            <div className="t-xs mt-1 opacity-70">
              Perkiraan dalam {currency}, kurs indikatif, bukan kurs pasar
              real-time
            </div>
          )}

          {/* EPIC-021 Group F (#6) — gold-equivalent line (Open Design
              Decision #6: no live gold feed, manual price only). */}
          {!isLoading && goldGrams !== null && (
            <div className="t-xs mt-1 opacity-70">
              ≈ {formatGoldGrams(goldGrams)}
              {t.consolidatedTotal.goldUnitSuffix}{" "}
              {t.consolidatedTotal.goldLabel.toLowerCase()}
            </div>
          )}
          {!isLoading && goldGrams === null && (
            <div className="t-xs mt-1 opacity-70">
              <button
                type="button"
                onClick={() => router.push("/akun")}
                className="cursor-pointer underline decoration-white/40 underline-offset-2 hover:decoration-white"
              >
                {t.consolidatedTotal.goldPromptText}
              </button>
            </div>
          )}

          {/* Prototype's `.badge` + `.t-xs` delta row. The prototype hardcodes
              "4,8% bulan ini / vs Rp … di Juli"; the API carries no
              month-over-month percentage, so the badge shows the real
              `currentMonth.net` and the note shows the real savings rate. */}
          {currentMonth && (
            <div className="row mt-2.5 gap-2">
              <span className="badge bg-white/20 text-white">
                {isUp ? (
                  <TrendingUp className="size-[13px]" />
                ) : (
                  <TrendingDown className="size-[13px]" />
                )}
                {money(Math.abs(currentMonth.net))} {t.beranda.thisMonth}
              </span>
              <span className="t-xs opacity-85">
                {t.common.savingsRate} {currentMonth.savingsRate}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* EPIC-025 N3-G1 — Sparkline → SparklineChart (Apex); same series as
          before the swap, bled to the hero's padding edges. */}
      <div className="-mx-5 mt-3">
        <SparklineChart
          data={sparklinePoints}
          color="#ffffff"
          ariaLabel={sparklineAriaLabel}
        />
        <div className="mt-1 flex justify-between px-5 text-[10px] opacity-60">
          {t.common.sparkLabels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      </div>

      <div className="bento-hero__footer">
        <div className="bento-hero__metric">
          <span className="bento-hero__metric-label">
            {t.ringkasan.totalAssetsLabel}
          </span>
          <span className="bento-hero__metric-value mono">
            {isLoading ? "…" : moneyCompact(assetsTotal)}
          </span>
        </div>
        <div className="bento-hero__metric">
          <span className="bento-hero__metric-label">
            {t.ringkasan.totalLiabilitiesLabel}
          </span>
          <span className="bento-hero__metric-value mono">
            {isLoading ? "…" : moneyCompact(totalLiabilities)}
          </span>
        </div>
        <div className="bento-hero__metric">
          <span className="bento-hero__metric-label">
            {t.beranda.cashflowThisMonth}
          </span>
          <span className="bento-hero__metric-value mono">
            {isLoading ? "…" : moneyCompact(currentMonth?.net ?? 0)}
          </span>
        </div>
      </div>
    </HeroCard>
  );
}
