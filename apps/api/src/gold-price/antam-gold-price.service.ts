import { Injectable, Logger, Optional, Inject } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  AntamGoldPriceClient,
  EMASANTAM_SOURCE,
} from "./antam-gold-price.client";

/** Refresh at most every 6h — matches the brief; the page itself only
 * updates once a day (see `parser.ts`'s "Last update" doc note), so this
 * just bounds how often we hit emasantam.id, not real staleness risk. */
const REFRESH_MS = 6 * 60 * 60 * 1000;

export type AntamGoldPriceSnapshot = {
  /** IDR, integer digits, or null when nothing has EVER been cached and the
   * live fetch also failed — the UI must ask for a manual price in that case. */
  pricePerKgIdr: string | null;
  source: typeof EMASANTAM_SOURCE | null;
  fetchedAt: string | null;
  /** True when this is a retained (possibly old) cached value because the
   * live fetch just failed — distinct from a fresh quote, same idea as
   * FrankfurterFxService's `stale` flag. */
  stale: boolean;
};

const EMPTY_SNAPSHOT: AntamGoldPriceSnapshot = {
  pricePerKgIdr: null,
  source: null,
  fetchedAt: null,
  stale: false,
};

/**
 * B9 (client revision round 2) — Antam 1 kg gold bar price, scraped
 * server-side from emasantam.id (logammulia.com's "harga dasar non-PPh" is
 * unreachable — Cloudflare 403s every server request, see the B9
 * source-update note), cached in `GoldMarketPrice` like `FxRate`, refreshed
 * at most every 6h, falling back to the last cached value on a failed
 * fetch/parse. Returns an all-null snapshot (never throws) when nothing has
 * ever been cached and the live fetch also fails — callers/UI must treat
 * that as "ask for a manual price," never a fabricated number.
 */
@Injectable()
export class AntamGoldPriceService {
  private readonly logger = new Logger(AntamGoldPriceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: AntamGoldPriceClient,
    // Overridable only for tests — mirrors FrankfurterFxService's own
    // injected clock pattern.
    @Optional()
    @Inject("ANTAM_GOLD_PRICE_NOW")
    private readonly now: () => number = Date.now,
  ) {}

  async getSnapshot(): Promise<AntamGoldPriceSnapshot> {
    let cached: { pricePerKgIdr: bigint; fetchedAt: Date } | null = null;
    try {
      cached = await this.prisma.goldMarketPrice.findUnique({
        where: { source: EMASANTAM_SOURCE },
      });
    } catch (err) {
      this.logger.warn(
        `could not read cached Antam gold price: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (cached && this.now() - cached.fetchedAt.getTime() < REFRESH_MS) {
      return this.toSnapshot(cached.pricePerKgIdr, cached.fetchedAt, false);
    }

    try {
      const live = await this.client.fetchPricePerKg();
      if (live === null) {
        throw new Error("emasantam.id parse returned no price");
      }
      const fetchedAt = new Date(this.now());
      await this.persist(live, fetchedAt);
      return this.toSnapshot(live, fetchedAt, false);
    } catch (err) {
      this.logger.warn(
        `live Antam gold price fetch failed, serving ${cached ? "the last cached value" : "no price (nothing ever cached)"}: ${err instanceof Error ? err.message : String(err)}`,
      );
      if (cached)
        return this.toSnapshot(cached.pricePerKgIdr, cached.fetchedAt, true);
      return EMPTY_SNAPSHOT;
    }
  }

  private toSnapshot(
    pricePerKgIdr: bigint,
    fetchedAt: Date,
    stale: boolean,
  ): AntamGoldPriceSnapshot {
    return {
      pricePerKgIdr: pricePerKgIdr.toString(),
      source: EMASANTAM_SOURCE,
      fetchedAt: fetchedAt.toISOString(),
      stale,
    };
  }

  private async persist(pricePerKgIdr: bigint, fetchedAt: Date): Promise<void> {
    try {
      await this.prisma.goldMarketPrice.upsert({
        where: { source: EMASANTAM_SOURCE },
        create: { source: EMASANTAM_SOURCE, pricePerKgIdr, fetchedAt },
        update: { pricePerKgIdr, fetchedAt },
      });
    } catch (err) {
      this.logger.error(
        `could not cache the Antam gold price`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
