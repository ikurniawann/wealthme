import { Injectable, Logger } from "@nestjs/common";
import {
  FOREIGN_FX_CURRENCY_CODES,
  formatScaled,
  FX_RATE_SCALE,
  type FxCurrencyCode,
} from "@wealthme/contracts";

import { FRANKFURTER_SOURCE } from "./frankfurter.client";
import { ratesFromSnapshot, type FxSnapshot } from "./fx-snapshot";
import { FxPort } from "./fx.port";

import type { FrankfurterClient } from "./frankfurter.client";
import type { FxMockService } from "./fx-mock.service";
import type { PrismaService } from "../prisma/prisma.service";

const MEMO_TTL_MS = 60 * 60 * 1000;
const STALE_MEMO_TTL_MS = 5 * 60 * 1000;
const FRESH_MS = 12 * 60 * 60 * 1000;
const IDR_ONE = formatScaled(10n ** BigInt(FX_RATE_SCALE), FX_RATE_SCALE);

@Injectable()
export class FrankfurterFxService extends FxPort {
  private readonly logger = new Logger(FrankfurterFxService.name);
  private memo: { snapshot: FxSnapshot; at: number } | null = null;
  private inflight: Promise<FxSnapshot> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: FrankfurterClient,
    private readonly fallback: FxMockService,
    private readonly now: () => number = Date.now,
  ) {
    super();
  }

  async getSnapshot(): Promise<FxSnapshot> {
    if (this.memo) {
      const ttl = this.memo.snapshot.stale ? STALE_MEMO_TTL_MS : MEMO_TTL_MS;
      if (this.now() - this.memo.at < ttl) return this.memo.snapshot;
    }
    this.inflight ??= this.load().finally(() => {
      this.inflight = null;
    });
    const snapshot = await this.inflight;
    this.memo = { snapshot, at: this.now() };
    return snapshot;
  }

  async getRates(base: string): Promise<Record<string, number>> {
    return ratesFromSnapshot(await this.getSnapshot(), base);
  }

  async getRate(from: string, to: string): Promise<number> {
    if (from === to) return 1;
    return (await this.getRates(from))[to] ?? 1;
  }

  private async load(): Promise<FxSnapshot> {
    let stored: FxSnapshot | null = null;
    try {
      stored = await this.latestStored();
    } catch (err) {
      // A failing fx_rates read must not block the live feed or the indicative fallback.
      this.logger.warn(
        `could not read cached FX rates: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (stored && this.now() - Date.parse(stored.fetchedAt) < FRESH_MS) {
      return stored;
    }
    try {
      const live = await this.client.fetchLatest();
      const fetchedAt = new Date(this.now());
      await this.persist(live.rateDate, live.idrPerUnit, fetchedAt);
      return {
        source: "frankfurter",
        rateDate: live.rateDate,
        fetchedAt: fetchedAt.toISOString(),
        stale: false,
        idrPerUnit: live.idrPerUnit,
      };
    } catch (err) {
      this.logger.warn(
        `live FX fetch failed, serving ${stored ? `stored ${stored.rateDate}` : "indicative"} rates: ${err instanceof Error ? err.message : String(err)}`,
      );
      if (stored) return { ...stored, stale: true };
      return this.fallback.getSnapshot();
    }
  }

  private async latestStored(): Promise<FxSnapshot | null> {
    const rows = await this.prisma.fxRate.findMany({
      where: { source: FRANKFURTER_SOURCE },
      orderBy: [{ rateDate: "desc" }, { fetchedAt: "desc" }],
      distinct: ["currency"],
    });
    const byCode = new Map(rows.map((r) => [r.currency, r]));
    if (!FOREIGN_FX_CURRENCY_CODES.every((c) => byCode.has(c))) return null;
    const idrPerUnit = { IDR: IDR_ONE } as Record<FxCurrencyCode, string>;
    for (const code of FOREIGN_FX_CURRENCY_CODES) {
      idrPerUnit[code] = byCode.get(code)!.idrPerUnit.toFixed(FX_RATE_SCALE);
    }
    const oldestFetch = Math.min(...rows.map((r) => r.fetchedAt.getTime()));
    return {
      source: "frankfurter",
      rateDate: byCode.get("USD")!.rateDate.toISOString().slice(0, 10),
      fetchedAt: new Date(oldestFetch).toISOString(),
      stale: false,
      idrPerUnit,
    };
  }

  private async persist(
    rateDate: string,
    idrPerUnit: Record<FxCurrencyCode, string>,
    fetchedAt: Date,
  ): Promise<void> {
    const day = new Date(`${rateDate}T00:00:00.000Z`);
    try {
      await this.prisma.$transaction(
        FOREIGN_FX_CURRENCY_CODES.map((currency) =>
          this.prisma.fxRate.upsert({
            where: {
              source_currency_rateDate: {
                source: FRANKFURTER_SOURCE,
                currency,
                rateDate: day,
              },
            },
            create: {
              source: FRANKFURTER_SOURCE,
              currency,
              rateDate: day,
              idrPerUnit: idrPerUnit[currency],
              fetchedAt,
            },
            update: { idrPerUnit: idrPerUnit[currency], fetchedAt },
          }),
        ),
      );
    } catch (err) {
      this.logger.error(
        `could not cache FX rates for ${rateDate}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
