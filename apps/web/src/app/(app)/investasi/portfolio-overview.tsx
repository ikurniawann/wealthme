"use client";
import Link from "next/link";
import { TrendChart } from "@/components/charts/apex-presets";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import type {
  InvestmentDto,
  InvestmentTransactionDto,
  PlatformAccountDto,
} from "@wealthme/contracts";
import type { PortfolioHistory } from "./portfolio-model";
import { money } from "./portfolio-model";

export interface PortfolioActivity extends InvestmentTransactionDto {
  holdingName: string;
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
        <p className="iv-empty">{c.chartEmpty}</p>
      ) : (
        <TrendChart
          categories={data!.points.map((p) => p.date)}
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
      <small>{c.chartNote}</small>
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
    <section className="iv-card">
      <h2>{c.funds}</h2>
      {!pockets.length && <p className="iv-empty">{c.noFunds}</p>}
      {pockets.slice(0, 3).map(({ platform, pocket }) => (
        <div key={pocket.id} className="iv-pocket">
          <strong>
            {platform.label ??
              platform.platformName ??
              platform.customName ??
              platform.platformKey}{" "}
            · {pocket.currency}
          </strong>
          <span>{pocket.name}</span>
          <small>{c.available}</small>
          <strong>
            {money(
              pocket.availableBalance,
              "IDR",
              locale,
              hideBalance || pocket.balancesHidden,
            )}
          </strong>
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
        </div>
      ))}
      <div className="iv-tools">
        {onTopup && (
          <button className="btn btn--primary" onClick={onTopup}>
            {c.topUp}
          </button>
        )}
        <Link className="btn btn--outline" href="/investasi?tab=funds">
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
        <Link href="/investasi?tab=history">{c.allHistory}</Link>
      </div>
      {error ? (
        <p role="alert">{c.activityError}</p>
      ) : loading ? (
        <p role="status">{c.loading}</p>
      ) : !rows.length ? (
        <p className="iv-empty">{c.activityEmpty}</p>
      ) : (
        <ul className="iv-activities">
          {rows.slice(0, 5).map((row) => (
            <li key={row.id}>
              <span>
                {row.effectiveDate ?? row.occurredAt.slice(0, 10)}
                <small>
                  {row.effectiveTime
                    ? `${row.effectiveTime} ${row.timeZone ?? "Asia/Jakarta"}`
                    : ""}
                </small>
              </span>
              <strong>{c[row.kind ?? row.type ?? "opening"]}</strong>
              <Link href={`/investasi/${row.investmentId}`}>
                {row.holdingName}
                {row.note?.includes("legacy-residual") && (
                  <small>{c.legacy}</small>
                )}
              </Link>
              <span>
                {money(
                  row.costBasisKnown === false && row.kind === "opening"
                    ? null
                    : (row.netAmount ?? row.grossAmount),
                  row.currency ?? "IDR",
                  locale,
                  hideBalance,
                )}
              </span>
              <small>
                {row.status === "void"
                  ? c.void
                  : row.settlementDate &&
                      row.settlementDate >
                        new Intl.DateTimeFormat("sv-SE", {
                          timeZone: "Asia/Jakarta",
                        }).format(new Date())
                    ? c.pending
                    : c.settled}
              </small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
export function mergeActivity(
  holdings: InvestmentDto[],
  histories: InvestmentTransactionDto[][],
): PortfolioActivity[] {
  return histories
    .flatMap((rows, i) =>
      rows.map((row) => ({ ...row, holdingName: holdings[i]?.name ?? "—" })),
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
