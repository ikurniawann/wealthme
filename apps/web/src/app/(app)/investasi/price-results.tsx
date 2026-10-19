"use client";
import type {
  InvestmentPriceBatchResultDto,
  InvestmentValuationDto,
} from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { money } from "./portfolio-model";
export interface FeedResult {
  investmentId: string;
  status: "updated" | "skipped" | "failed";
  valuation: InvestmentValuationDto;
  feed: {
    state: "ok" | "failed" | "no_route" | "simulated";
    at: string;
    error: string | null;
  } | null;
}
export function PriceResults({
  result,
}: {
  result: InvestmentPriceBatchResultDto;
}) {
  const { t, locale } = useLocale();
  const p = t.investasi.prices;
  const { hideBalance } = useMoney();
  const fmt = (v: string | null) => money(v, "IDR", locale, hideBalance);
  return (
    <section className="iv-card" aria-live="polite">
      <h2>{p.summary}</h2>
      <p>
        {result.updatedCount} {p.count}, {result.skippedCount} {p.skipCount},{" "}
        {result.failedCount} {p.failCount}
      </p>
      <div className="iv-price-results">
        {result.rows.map((r) => (
          <article key={r.investmentId} className="iv-transfer-preview">
            <h3>
              {r.name ?? "—"} · {p[r.status]}
            </h3>
            {r.code && (
              <p>{locale === "id" ? r.message : r.code.replaceAll("_", " ")}</p>
            )}
            {r.status === "updated" && (
              <dl>
                <div>
                  <dt>{p.oldValue}</dt>
                  <dd>{fmt(r.oldValueIdr)}</dd>
                </div>
                <div>
                  <dt>{p.newValue}</dt>
                  <dd>{fmt(r.newValueIdr)}</dd>
                </div>
                <div>
                  <dt>{p.impact}</dt>
                  <dd>{fmt(r.impactIdr)}</dd>
                </div>
              </dl>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
