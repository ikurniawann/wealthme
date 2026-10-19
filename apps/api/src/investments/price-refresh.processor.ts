import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { MARKETS, effectiveMarketFor } from "@wealthme/contracts";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AntamGoldPriceService } from "../gold-price/antam-gold-price.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import { UnmappedTickerError } from "./coingecko-market-data.adapter";
import { isAutomatedPriceType, MARKET_DATA_PORT } from "./market-data.port";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PricesGateway } from "./prices.gateway";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PriceFeedStatusRegistry } from "./valuation/price-feed-status.registry";

import type {
  MarketDataPort,
  MarketDataQuote,
  MarketDataRequest,
} from "./market-data.port";
import type { InvestmentMarket, InvestmentType, Prisma } from "@prisma/client";
import type { Job } from "bullmq";

/** An unchanged quote is re-stored at most this often (keeps asOf honest). */
const UNCHANGED_REWRITE_MS = 6 * 60 * 60 * 1000;
/** A changed quote is stored at most this often per holding. */
const CHANGED_REWRITE_MS = 15 * 60 * 1000;
/** The Antam cache refreshes itself every 6 h; poke it at most this often. */
const ANTAM_POKE_MS = 30 * 60 * 1000;

interface Holding {
  id: string;
  ticker: string;
  type: InvestmentType;
  familyGroupId: string;
  market: InvestmentMarket | null;
  priceSymbol: string | null;
  currency: string;
  details: Prisma.JsonValue;
}

interface StoredQuote {
  investmentId: string;
  price: Decimal;
  currency: string;
  source: string;
  recordedAt: Date;
  asOf: Date | null;
}

type FetchResult =
  | { ok: true; quote: MarketDataQuote }
  | { ok: false; unmapped: boolean; error: string };

/**
 * Background price refresh — the ONLY automated writer of InvestmentPrice
 * (Task 8: a GET never fetches or persists a price). Every minute it quotes
 * each automated holding (saham via Yahoo with a market-aware symbol, kripto
 * via CoinGecko), records the per-holding feed outcome for the valuation
 * service, broadcasts real quotes, and persists a quote only when it is new
 * enough to matter (see the *_REWRITE_MS limits) — not one row per minute.
 * Simulated (mock) quotes are never persisted nor broadcast.
 */
@Processor("price-refresh")
export class PriceRefreshProcessor extends WorkerHost {
  private readonly logger = new Logger(PriceRefreshProcessor.name);
  private lastAntamPoke = 0;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MARKET_DATA_PORT) private readonly marketData: MarketDataPort,
    private readonly pricesGateway: PricesGateway,
    private readonly feed: PriceFeedStatusRegistry,
    private readonly antamGold: AntamGoldPriceService,
  ) {
    super();
  }

  async process(_job: Job): Promise<void> {
    const investments: Holding[] = await this.prisma.investment.findMany({
      where: { quantity: { gt: 0 } },
      select: {
        id: true,
        ticker: true,
        type: true,
        familyGroupId: true,
        market: true,
        priceSymbol: true,
        currency: true,
        details: true,
      },
    });
    await this.pokeAntam(investments);

    // Manual-only types (reksa_dana, obligasi, emas, lainnya, deposito)
    // never get an automated quote.
    const automated = investments.filter(
      (inv) =>
        isAutomatedPriceType(inv.type) &&
        !(
          inv.details &&
          typeof inv.details === "object" &&
          !Array.isArray(inv.details) &&
          inv.details.manualInstrument === true
        ),
    );
    if (automated.length === 0) return;

    const results = new Map<string, FetchResult>();
    for (const inv of automated) {
      const key = this.quoteKey(inv);
      if (!results.has(key)) results.set(key, await this.fetch(inv));
    }

    const latest = await this.latestStored(automated.map((i) => i.id));
    const now = new Date();
    for (const inv of automated) {
      const result = results.get(this.quoteKey(inv));
      if (!result) continue;
      if (!result.ok) {
        this.feed.record(
          inv.id,
          result.unmapped ? "no_route" : "failed",
          result.error,
          now,
        );
        continue;
      }
      if (result.quote.source === "mock") {
        this.feed.record(inv.id, "simulated", null, now);
        continue;
      }
      this.feed.record(inv.id, "ok", null, now);
      await this.store(inv, result.quote, latest.get(inv.id), now);
    }
  }

  private request(inv: Holding): MarketDataRequest {
    return {
      market: inv.market,
      priceSymbol: inv.priceSymbol,
      currency: inv.currency,
    };
  }

  private quoteKey(inv: Holding): string {
    return [
      inv.type,
      inv.market ?? "",
      inv.priceSymbol ?? "",
      inv.ticker.toUpperCase(),
      inv.currency,
    ].join("|");
  }

  private async fetch(inv: Holding): Promise<FetchResult> {
    try {
      const quote = await this.marketData.getPrice(
        inv.ticker,
        inv.type,
        this.request(inv),
      );
      if (
        !Number.isFinite(quote.price) ||
        quote.price <= 0 ||
        Number.isNaN(quote.asOf.getTime())
      ) {
        throw new Error("Invalid market quote");
      }
      return { ok: true, quote };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      if (err instanceof UnmappedTickerError) {
        return { ok: false, unmapped: true, error };
      }
      this.logger.warn(`Price fetch failed for ${inv.ticker}: ${error}`);
      return { ok: false, unmapped: false, error };
    }
  }

  private shouldStore(
    quote: MarketDataQuote,
    prev: StoredQuote | undefined,
    now: Date,
  ): boolean {
    if (!prev) return true;
    if (prev.source !== quote.source || prev.currency !== quote.currency) {
      return true;
    }
    const age = now.getTime() - prev.recordedAt.getTime();
    const changed = !prev.price.equals(new Decimal(quote.price));
    return changed ? age >= CHANGED_REWRITE_MS : age >= UNCHANGED_REWRITE_MS;
  }

  private async store(
    inv: Holding,
    quote: MarketDataQuote,
    prev: StoredQuote | undefined,
    now: Date,
  ): Promise<void> {
    // A delayed feed must not replace a newer broker/manual observation.
    if (prev && quote.asOf < (prev.asOf ?? prev.recordedAt)) return;
    if (this.shouldStore(quote, prev, now)) {
      try {
        const market = effectiveMarketFor(inv.type, inv.market, inv.currency);
        await this.prisma.investmentPrice.create({
          data: {
            investmentId: inv.id,
            price: new Decimal(quote.price),
            source: quote.source,
            asOf: quote.asOf,
            delayed: quote.delayed,
            currency: quote.currency,
            unitLabel: MARKETS[market].priceUnitLabel,
            hasTime: true,
          },
        });
      } catch (err) {
        this.logger.error(
          `Failed to save price for investment ${inv.id} (${inv.ticker})`,
          err,
        );
        return;
      }
    }
    this.pricesGateway.broadcastPriceUpdate(
      inv.familyGroupId,
      inv.ticker,
      quote.price,
      inv.id,
      quote.currency,
    );
  }

  /** Latest stored (non-mock) quote per holding — one index walk each. */
  private async latestStored(ids: string[]): Promise<Map<string, StoredQuote>> {
    const rows = await this.prisma.$queryRaw<StoredQuote[]>`
      SELECT p."investmentId", p."price", p."currency", p."source", p."recordedAt", p."asOf"
      FROM unnest(${ids}::text[]) AS h(id)
      CROSS JOIN LATERAL (
        SELECT * FROM "investment_prices" ip
        WHERE ip."investmentId" = h.id AND ip."source" <> 'mock'
        ORDER BY COALESCE(ip."asOf", ip."recordedAt") DESC, ip."recordedAt" DESC, ip."id" DESC
        LIMIT 1
      ) p`;
    return new Map(
      rows.map((r) => [r.investmentId, { ...r, price: new Decimal(r.price) }]),
    );
  }

  /** Keeps the Antam gold reference cache warm while gold holdings exist. */
  private async pokeAntam(investments: Holding[]): Promise<void> {
    const hasGold = investments.some(
      (i) => i.type === "emas" || i.market === "GOLD",
    );
    if (!hasGold || Date.now() - this.lastAntamPoke < ANTAM_POKE_MS) return;
    this.lastAntamPoke = Date.now();
    try {
      await this.antamGold.getSnapshot();
    } catch (err) {
      this.logger.warn(
        `Antam gold reference refresh failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
