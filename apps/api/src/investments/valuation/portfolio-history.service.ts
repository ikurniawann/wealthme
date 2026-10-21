import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../prisma/prisma.service";
import { investmentAccessWhere } from "../investment-access";
import { dbDateToYmd, ledgerInstant } from "../ledger/ledger-dates";
import { replayLedger } from "../ledger/replay";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InvestmentValuationService } from "./investment-valuation.service";
import { ledgerFactsByHolding } from "./ledger-facts";
import { jakartaYmd, valueHolding } from "./valuation-core";

import type { LedgerActor } from "../ledger/ledger-support";
import type { PortfolioValuationQueryDto } from "./dto/portfolio-valuation-query.dto";

/** R10: replay positions at actual stored quote instants. No interpolated prices
 * or reconstructed historical FX: a point with an open foreign position is
 * omitted until historical FX exists. This deliberately prefers gaps to fiction.
 */
@Injectable()
export class PortfolioHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly valuation: InvestmentValuationService,
  ) {}

  async history(
    familyGroupId: string,
    query: PortfolioValuationQueryDto,
    actor: LedgerActor,
  ) {
    const holdings = await this.valuation.valueFamily(familyGroupId, {
      AND: [investmentAccessWhere(actor)],
      ...(query.investmentId ? { id: query.investmentId } : {}),
      ...(query.ownerUserId ? { ownerUserId: query.ownerUserId } : {}),
      ...(query.platformAccountId
        ? { platformAccountId: query.platformAccountId }
        : {}),
      ...(query.type ? { type: query.type } : {}),
    });
    const selected = holdings.filter(
      (h) => !query.market || h.valuation.market === query.market,
    );
    const ids = selected.map((h) => h.row.id);
    if (!ids.length)
      return { points: [], currency: "IDR", historicalFxUnavailable: false };
    const [prices, transactions] = await Promise.all([
      this.prisma.investmentPrice.findMany({
        where: { investmentId: { in: ids }, source: { not: "mock" } },
        orderBy: [{ recordedAt: "asc" }, { id: "asc" }],
      }),
      this.prisma.investmentTransaction.findMany({
        where: { investmentId: { in: ids }, status: "active" },
      }),
    ]);
    const now = new Date();
    const instant = (p: (typeof prices)[number]) => p.asOf ?? p.recordedAt;
    const txInstant = (t: (typeof transactions)[number]) =>
      ledgerInstant(dbDateToYmd(t.effectiveDate), t.effectiveTime, t.timeZone);
    // A buy/sell/opening executes at a real price: treat it as an observed
    // quote at its own instant so holdings without stored quotes still plot.
    for (const t of transactions) {
      if (t.kind !== "buy" && t.kind !== "sell" && t.kind !== "opening")
        continue;
      if (!t.pricePerUnit.greaterThan(0)) continue;
      const when = txInstant(t);
      prices.push({
        id: `tx:${t.id}`,
        investmentId: t.investmentId,
        price: t.pricePerUnit,
        source: "transaction",
        asOf: when,
        delayed: false,
        recordedAt: when,
        currency: t.currency,
        unitLabel: null,
        reference: null,
        hasTime: t.effectiveTime !== null,
      } as (typeof prices)[number]);
    }
    const pricesByHolding = new Map<string, typeof prices>();
    const transactionsByHolding = new Map<string, typeof transactions>();
    for (const price of prices) {
      const list = pricesByHolding.get(price.investmentId) ?? [];
      list.push(price);
      pricesByHolding.set(price.investmentId, list);
    }
    for (const list of pricesByHolding.values())
      list.sort(
        (a, b) =>
          instant(b).getTime() - instant(a).getTime() ||
          b.recordedAt.getTime() - a.recordedAt.getTime() ||
          b.id.localeCompare(a.id),
      );
    for (const row of transactions) {
      const list = transactionsByHolding.get(row.investmentId) ?? [];
      list.push(row);
      transactionsByHolding.set(row.investmentId, list);
    }
    const dayEnds = [
      ...new Set(
        prices
          .filter((p) => instant(p) <= now && p.source !== "transaction")
          .map((p) => jakartaYmd(instant(p))),
      ),
    ]
      .sort()
      .slice(-365)
      .map((d) => {
        const end = new Date(`${d}T23:59:59.999+07:00`);
        return end > now ? now : end;
      });
    const instants = [
      ...new Set(
        [
          ...dayEnds,
          ...transactions.map(txInstant).filter((d) => d <= now),
          now,
        ].map((d) => d.getTime()),
      ),
    ].sort((a, b) => a - b);
    let historicalFxUnavailable = false;
    const points: { date: string; at: string; valueIdr: string }[] = [];
    for (const ms of instants) {
      const at = new Date(ms);
      const date = jakartaYmd(at);
      let total = new Prisma.Decimal(0);
      let complete = true;
      let hasPosition = false;
      for (const h of selected) {
        const rows = (transactionsByHolding.get(h.row.id) ?? [])
          .filter(
            (t) =>
              ledgerInstant(
                dbDateToYmd(t.effectiveDate),
                t.effectiveTime,
                t.timeZone,
              ) <= at,
          )
          .map((t) => ({ ...t, effectiveDate: dbDateToYmd(t.effectiveDate) }));
        const replay = replayLedger(rows);
        if (replay.invalid) {
          complete = false;
          break;
        }
        if (replay.quantity.isZero()) continue;
        hasPosition = true;
        const latest = (pricesByHolding.get(h.row.id) ?? []).find(
          (p) => instant(p) <= at,
        );
        // R10 requires an actual price observation for every open position.
        // Current deposit terms and gold caches cannot reconstruct history.
        if (!latest || h.row.type === "deposito") {
          complete = false;
          break;
        }
        if (h.row.currency !== "IDR" || (latest && latest.currency !== "IDR")) {
          historicalFxUnavailable = true;
          complete = false;
          break;
        }
        const value = valueHolding(
          {
            ...h.input,
            quantity: replay.quantity,
            costBasisPerUnit: replay.avgCost,
            latestPrice: latest ?? null,
            // Today's family/Antam caches are not historical observations.
            familyGold: null,
            antamGold: null,
            feed: null,
            ledger: ledgerFactsByHolding(rows).get(h.row.id) ?? null,
          },
          { now: at, fx: null },
        );
        if (value.marketValueIdr === null) {
          complete = false;
          break;
        }
        total = total.plus(value.marketValueIdr);
      }
      if (complete && hasPosition)
        points.push({
          date,
          at: at.toISOString(),
          valueIdr: total.toDecimalPlaces(2).toString(),
        });
    }
    return { points, currency: "IDR", historicalFxUnavailable };
  }
}
