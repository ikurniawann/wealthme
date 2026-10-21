"use client";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChartLine,
  ChevronRight,
  Coins,
  History,
  Plus,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import { INVESTMENT_PLATFORMS } from "@wealthme/contracts";
import { TrendChart } from "@/components/charts/apex-presets";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import type {
  InvestmentDto,
  InvestmentTransactionDto,
  PlatformAccountDto,
} from "@wealthme/contracts";
import type { PortfolioHistory } from "./portfolio-model";
import { historyLabels, money } from "./portfolio-model";

export interface PortfolioActivity extends InvestmentTransactionDto {
  holdingName: string;
  holdingCurrency?: string;
  percentPrice?: boolean;
}
export function PortfolioChart({
  data,
  loading,
  error,
}: {
  data?: PortfolioHistory;
  loading: boolean;
  error: boolean;
}) {
  const { t, locale } = useLocale();
  const c = t.investasi.v3;
  const { hideBalance } = useMoney();
  const format = (v: number) => money(String(v), "IDR", locale, hideBalance);
  return (
    <section className="iv-card iv-chart">
      <h2>{c.chart}</h2>
      {error ? (
        <p className="iv-empty" role="alert">
          {c.error}
        </p>
      ) : loading ? (
        <p className="iv-empty" role="status">
          {c.loading}
        </p>
      ) : hideBalance ? (
        <p className="iv-empty">••••</p>
      ) : (data?.points.length ?? 0) < 2 ? (
        <p className="iv-empty">
          <ChartLine aria-hidden="true" />
          {c.chartEmpty}
        </p>
      ) : (
        <TrendChart
          categories={historyLabels(data!.points)}
          series={[
            {
              name: c.assetValue,
              data: data!.points.map((p) => Number(p.valueIdr)),
            },
          ]}
          ariaLabel={c.chart}
          money={{ format, formatAxis: format }}
        />
      )}
      <small className="iv-note">{c.chartNote}</small>
      {data?.historicalFxUnavailable && (
        <p className="iv-notice">{c.fxHistory}</p>
      )}
    </section>
  );
}
export function PortfolioCashPreview({
  platforms,
  onTopup,
}: {
  platforms: PlatformAccountDto[];
  onTopup?: () => void;
}) {
  const { t, locale } = useLocale();
  const c = t.investasi.v3;
  const { hideBalance } = useMoney();
  const pockets = platforms.flatMap((p) =>
    (p.pockets ?? []).map((pocket) => ({ platform: p, pocket })),
  );
  return (
    <section className="iv-card iv-cash">
      <h2>{c.funds}</h2>
      {!pockets.length && <p className="iv-empty">{c.noFunds}</p>}
      <div className="iv-cash-list">
        {pockets.slice(0, 3).map(({ platform, pocket }) => (
          <Link
            key={pocket.id}
            className="iv-cash-row"
            href="/investasi?tab=funds"
          >
            <span className="iv-instrument-mark" aria-hidden="true">
              {INVESTMENT_PLATFORMS.find((v) => v.key === platform.platformKey)
                ?.mark ?? "P"}
            </span>
            <span className="iv-cash-text">
              <strong>
                {platform.label ??
                  platform.platformName ??
                  platform.customName ??
                  platform.platformKey}{" "}
                · {pocket.name}
              </strong>
              <small>
                {c.available} · {pocket.currency}
              </small>
              <b>
                {money(
                  pocket.availableBalance,
                  "IDR",
                  locale,
                  hideBalance || pocket.balancesHidden,
                )}
              </b>
              {pocket.heldBalance !== "0" && (
                <small>
                  {c.held}:{" "}
                  {money(
                    pocket.heldBalance,
                    "IDR",
                    locale,
                    hideBalance || pocket.balancesHidden,
                  )}
                </small>
              )}
            </span>
            <ChevronRight aria-hidden="true" />
          </Link>
        ))}
      </div>
      <div className="iv-cash-actions">
        {onTopup && (
          <button className="btn btn--primary" onClick={onTopup}>
            <Plus aria-hidden="true" />
            {c.topUp}
          </button>
        )}
        <Link className="btn btn--outline" href="/investasi?tab=funds">
          <History aria-hidden="true" />
          {c.funds}
        </Link>
      </div>
    </section>
  );
}
export function PortfolioActivityList({
  rows,
  loading,
  error,
}: {
  rows: PortfolioActivity[];
  loading: boolean;
  error: boolean;
}) {
  const { t, locale } = useLocale();
  const c = t.investasi.v3;
  const { hideBalance } = useMoney();
  return (
    <section className="iv-card">
      <div className="iv-section-head">
        <h2>{c.activity}</h2>
        <Link className="iv-more-link" href="/investasi?tab=history">
          {c.allHistory}
          <ChevronRight aria-hidden="true" />
        </Link>
      </div>
      {error ? (
        <p role="alert">{c.activityError}</p>
      ) : loading ? (
        <p role="status">{c.loading}</p>
      ) : !rows.length ? (
        <p className="iv-empty">{c.activityEmpty}</p>
      ) : (
        <div className="iv-activity" role="table" aria-label={c.activity}>
          <div className="iv-activity-row iv-activity-head" role="row">
            <span role="columnheader">{c.colDate}</span>
            <span role="columnheader">{c.colKind}</span>
            <span role="columnheader">{c.instrument}</span>
            <span role="columnheader">{c.colAmount}</span>
            <span role="columnheader">{c.colStatus}</span>
          </div>
          {rows.slice(0, 5).map((row) => {
            const kind = row.kind ?? row.type ?? "opening";
            const Icon = KIND_ICONS[kind] ?? Sparkles;
            const status =
              row.status === "void"
                ? "void"
                : row.settlementDate &&
                    row.settlementDate >
                      new Intl.DateTimeFormat("sv-SE", {
                        timeZone: "Asia/Jakarta",
                      }).format(new Date())
                  ? "pending"
                  : "settled";
            return (
              <div className="iv-activity-row" role="row" key={row.id}>
                <span role="cell" className="iv-activity-date">
                  {shortDate(
                    row.effectiveDate ?? row.occurredAt.slice(0, 10),
                    locale,
                  )}
                  {row.effectiveTime && (
                    <small>
                      {row.effectiveTime} {row.timeZone ?? "Asia/Jakarta"}
                    </small>
                  )}
                </span>
                <span role="cell" className="iv-activity-kind" data-kind={kind}>
                  <span className="iv-kind-icon" aria-hidden="true">
                    <Icon />
                  </span>
                  {c[kind]}
                </span>
                <span role="cell" className="iv-activity-desc">
                  <Link href={`/investasi/${row.investmentId}`}>
                    {row.holdingName}
                  </Link>
                  {row.note?.includes("legacy-residual") && (
                    <small>{c.legacy}</small>
                  )}
                </span>
                <span role="cell" className="iv-activity-amount">
                  {money(
                    row.costBasisKnown === false && row.kind === "opening"
                      ? null
                      : (row.netAmount ?? row.grossAmount),
                    row.currency ?? "IDR",
                    locale,
                    hideBalance,
                  )}
                </span>
                <span role="cell">
                  <span className="iv-status" data-status={status}>
                    {c[status]}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
const KIND_ICONS: Partial<Record<string, typeof ShoppingCart>> = {
  buy: ShoppingCart,
  sell: ArrowUpRight,
  opening: Sparkles,
  dividend: Coins,
  coupon: Coins,
  interest: Coins,
  corporate_action: ArrowDownLeft,
};
/** "2026-10-07" -> "7 Okt 2026" (calendar date, no timezone shift). */
export function shortDate(iso: string, locale: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
export function mergeActivity(
  holdings: InvestmentDto[],
  histories: InvestmentTransactionDto[][],
): PortfolioActivity[] {
  return histories
    .flatMap((rows, i) =>
      rows.map((row) => ({
        ...row,
        holdingName: holdings[i]?.name ?? "—",
        holdingCurrency: holdings[i]?.currency,
        percentPrice:
          holdings[i]?.details?.bond?.priceConvention === "percent_of_par",
      })),
    )
    .sort(
      (a, b) =>
        (b.effectiveDate ?? b.occurredAt).localeCompare(
          a.effectiveDate ?? a.occurredAt,
        ) ||
        (b.effectiveTime ?? "").localeCompare(a.effectiveTime ?? "") ||
        b.createdAt.localeCompare(a.createdAt) ||
        b.id.localeCompare(a.id),
    );
}
