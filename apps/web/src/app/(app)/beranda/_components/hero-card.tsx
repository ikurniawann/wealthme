"use client";

import { useRouter } from "next/navigation";
import { TrendingDown, TrendingUp } from "lucide-react";
import type {
  DashboardSummaryDto,
  NetWorthHistoryPointDto,
} from "@wealthme/contracts";
import { CountUpRupiah, HeroCard } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";
import { useGoldPrice } from "@/hooks/use-gold-price";
import { cn } from "@/lib/utils";
import { formatGoldGrams } from "@/components/consolidated-total-card";
import type { BerandaPeriod, MoneyFormatters } from "./use-beranda-data";
import { NetWorthTrend } from "./net-worth-trend";

const PERIODS: BerandaPeriod[] = ["6M", "12M"];

/**
 * EPIC-026 Wave 8 — `docs/prototype/pages/beranda.html`'s
 * `.hero.gradient-wealth.bento-hero`: `.bento-hero__top` (label + `.hero__value`
 * + a `.badge` / `.t-xs` delta row) above a three-cell `.bento-hero__footer`.
 *
 * The chart reads persisted net-worth snapshots from the range-selected API
 * query and lets the user inspect each snapshot without fabricated points.
 */
export function BerandaHero({
  isLoading,
  netWorth,
  assetsTotal,
  totalLiabilities,
  currentMonth,
  historyPoints,
  isHistoryLoading,
  period,
  onPeriodChange,
  fmt,
}: {
  isLoading: boolean;
  netWorth: number;
  assetsTotal: number;
  totalLiabilities: number;
  currentMonth: DashboardSummaryDto["currentMonth"] | undefined;
  historyPoints: NetWorthHistoryPointDto[];
  isHistoryLoading: boolean;
  period: BerandaPeriod;
  onPeriodChange: (next: BerandaPeriod) => void;
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
              <CountUpRupiah value={netWorth} format={money} />
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

      <div className="mb-2 flex justify-end">
        <div
          className="segmented"
          role="tablist"
          aria-label={t.beranda.periodToggleAriaLabel}
        >
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              className="segmented__item"
              aria-selected={period === p}
              onClick={() => onPeriodChange(p)}
            >
              {p === "12M" ? t.beranda.periodToggle12 : t.beranda.periodToggle6}
            </button>
          ))}
        </div>
      </div>
      <NetWorthTrend points={historyPoints} isLoading={isHistoryLoading} />

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
