import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { FxPort } from "../../fx/fx.port";
import { EMASANTAM_SOURCE } from "../../gold-price/antam-gold-price.client";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../prisma/prisma.service";
import { dbDateToYmd } from "../ledger/ledger-dates";

import { ledgerFactsByHolding } from "./ledger-facts";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PriceFeedStatusRegistry } from "./price-feed-status.registry";
import { valueHolding } from "./valuation-core";

import type { LedgerFactRow } from "./ledger-facts";
import type {
  HoldingValuationInput,
  ValuationFx,
  ValuationPrice,
} from "./valuation-core";
import type { Investment } from "@prisma/client";
import type {
  InvestmentDetails,
  InvestmentValuationDto,
} from "@wealthme/contracts";

const D = Prisma.Decimal;
const GRAMS_PER_KG = 1000;

export interface ValuedHolding {
  row: Investment;
  /** The exact input valued, so a preview can re-run it with a new price. */
  input: HoldingValuationInput;
  valuation: InvestmentValuationDto;
}

/** One holding's net-worth figure (whole rupiah), shared by dashboard and reports. */
export interface NetWorthPosition {
  id: string;
  name: string;
  ticker: string;
  valueIdr: bigint;
  usesCost: boolean;
}

interface LatestPriceRow {
  investmentId: string;
  price: Prisma.Decimal;
  currency: string;
  unitLabel: string | null;
  source: string;
  asOf: Date | null;
  recordedAt: Date;
  hasTime: boolean;
  delayed: boolean;
  reference: string | null;
}

/**
 * Investasi Task 8 — the single investment valuation source. Loads every
 * input (latest stored price, gold prices, ledger facts, valuation FX) and
 * runs `valueHolding` (valuation-core.ts). It NEVER fetches or persists a
 * price: prices change only through the refresh job and manual entry.
 */
@Injectable()
export class InvestmentValuationService {
  private readonly logger = new Logger(InvestmentValuationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxPort,
    private readonly feed: PriceFeedStatusRegistry,
  ) {}

  async valueFamily(
    familyGroupId: string,
    where: Prisma.InvestmentWhereInput = {},
    now: Date = new Date(),
  ): Promise<ValuedHolding[]> {
    const rows = await this.prisma.investment.findMany({
      where: { ...where, familyGroupId },
      orderBy: { createdAt: "asc" },
      include: {
        familyGroup: {
          select: { goldPricePerGram: true, goldPriceUpdatedAt: true },
        },
      },
    });
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const hasGold = rows.some((r) => r.type === "emas" || r.market === "GOLD");
    const [prices, ledgerRows, antam] = await Promise.all([
      this.latestPrices(ids),
      this.ledgerRows(ids),
      hasGold
        ? this.prisma.goldMarketPrice.findUnique({
            where: { source: EMASANTAM_SOURCE },
          })
        : Promise.resolve(null),
    ]);
    const facts = ledgerFactsByHolding(ledgerRows);
    const needsFx =
      rows.some((r) => r.currency !== "IDR") ||
      [...prices.values()].some((p) => p.currency !== "IDR");
    const fx = needsFx ? await this.valuationFx() : null;
    const antamGold =
      antam && antam.pricePerKgIdr > 0n
        ? {
            perGramIdr: new D(antam.pricePerKgIdr.toString()).dividedBy(
              GRAMS_PER_KG,
            ),
            fetchedAt: antam.fetchedAt,
          }
        : null;

    return rows.map(({ familyGroup, ...row }) => {
      const perGram = familyGroup.goldPricePerGram;
      const input: HoldingValuationInput = {
        id: row.id,
        type: row.type,
        market: row.market,
        currency: row.currency,
        quantity: row.quantity,
        costBasisPerUnit: row.costBasisPerUnit,
        interestRatePct: row.interestRatePct,
        purchasedAt: row.purchasedAt,
        maturityDate: row.maturityDate,
        details: (row.details ?? null) as InvestmentDetails | null,
        latestPrice: prices.get(row.id) ?? null,
        familyGold:
          perGram !== null && perGram > 0n
            ? {
                perGramIdr: new D(perGram.toString()),
                updatedAt: familyGroup.goldPriceUpdatedAt,
              }
            : null,
        antamGold,
        ledger: facts.get(row.id) ?? null,
        feed: this.feed.get(row.id),
      };
      return { row, input, valuation: valueHolding(input, { now, fx }) };
    });
  }

  /**
   * R8 net worth: each holding at its market value, or at remaining cost
   * when unpriced (labelled). Whole rupiah per holding, so the dashboard
   * total and the balance-sheet line items add up to the same number.
   */
  async netWorthPositions(familyGroupId: string): Promise<NetWorthPosition[]> {
    const valued = await this.valueFamily(familyGroupId);
    return valued.map(({ row, valuation }) => ({
      id: row.id,
      name: row.name,
      ticker: row.ticker,
      valueIdr: BigInt(valuation.netWorthIdr),
      usesCost: valuation.netWorthUsesCost,
    }));
  }

  async netWorthTotal(familyGroupId: string): Promise<bigint> {
    const positions = await this.netWorthPositions(familyGroupId);
    return positions.reduce((sum, p) => sum + p.valueIdr, 0n);
  }

  /** Today's valuation FX; null when the FX service is unavailable. */
  async valuationFx(): Promise<ValuationFx | null> {
    try {
      const snap = await this.fx.getSnapshot();
      return {
        idrPerUnit: snap.idrPerUnit as Record<string, string>,
        rateDate: snap.rateDate,
        source: snap.source,
        stale: snap.stale || snap.source === "indicative",
      };
    } catch (err) {
      this.logger.warn(
        `valuation FX unavailable; foreign holdings stay unpriced: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  /**
   * Latest non-simulated observation by effective price date. Recording an
   * older observation later must not replace a newer price. Recording time
   * and id break ties deterministically.
   */
  private async latestPrices(
    ids: string[],
  ): Promise<Map<string, ValuationPrice>> {
    const found = await this.prisma.$queryRaw<LatestPriceRow[]>`
      SELECT p."investmentId", p."price", p."currency", p."unitLabel",
             p."source", p."asOf", p."recordedAt", p."hasTime", p."delayed",
             p."reference"
      FROM unnest(${ids}::text[]) AS h(id)
      CROSS JOIN LATERAL (
        SELECT * FROM "investment_prices" ip
        WHERE ip."investmentId" = h.id AND ip."source" <> 'mock'
        ORDER BY COALESCE(ip."asOf", ip."recordedAt") DESC, ip."recordedAt" DESC, ip."id" DESC
        LIMIT 1
      ) p`;
    return new Map(
      found.map((p) => [p.investmentId, { ...p, price: new D(p.price) }]),
    );
  }

  private async ledgerRows(ids: string[]): Promise<LedgerFactRow[]> {
    const rows = await this.prisma.investmentTransaction.findMany({
      where: { investmentId: { in: ids }, status: "active" },
      select: {
        id: true,
        investmentId: true,
        kind: true,
        quantity: true,
        pricePerUnit: true,
        grossAmount: true,
        fee: true,
        tax: true,
        currency: true,
        fxRate: true,
        effectiveDate: true,
        effectiveTime: true,
        createdAt: true,
        realizedPnl: true,
      },
    });
    return rows.map((r) => ({
      ...r,
      effectiveDate: dbDateToYmd(r.effectiveDate),
    }));
  }
}
