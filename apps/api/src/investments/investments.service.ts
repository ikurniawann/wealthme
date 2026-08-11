import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import { UnmappedTickerError } from "./coingecko-market-data.adapter";
import { isAutomatedPriceType, MARKET_DATA_PORT } from "./market-data.port";

import type { CreateInvestmentDto } from "./dto/create-investment.dto";
import type { SetManualPriceDto } from "./dto/set-manual-price.dto";
import type { UpdateInvestmentDto } from "./dto/update-investment.dto";
import type { MarketDataPort } from "./market-data.port";
import type {
  InvestmentDto,
  InvestmentPriceDto,
  InvestmentSummaryDto,
} from "@wealthme/contracts";

const ZERO = new Decimal(0);
const MIN_INTEREST_RATE_PCT = 0;
const MAX_INTEREST_RATE_PCT = 100;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function decimalToString(d: Decimal | null): string {
  return d?.toString() ?? "0";
}

/**
 * Simple projected annual yield for interest-bearing instruments (obligasi,
 * deposito): currentValue × interestRatePct / 100. Null when either input is
 * unavailable (EPIC-021 #20 — display only, no compounding/term modeling).
 */
function computeProjectedAnnualYield(
  currentValue: Decimal | null,
  interestRatePct: Decimal | null,
): Decimal | null {
  if (!currentValue || !interestRatePct) return null;
  return currentValue.times(interestRatePct).dividedBy(100);
}

/**
 * EPIC-024 C3 (D10) — whole calendar months between `start` and `end`
 * (never negative). Deliberately ignores the day-of-month component (same
 * simplification already used by `monthsUntil` in
 * `apps/web/src/components/crud/crud-config.ts` for goal auto-debit math) —
 * both this epic's hand-computed golden values (2026-01-01 → 2026-07-01 =
 * exactly 6 months) and the goal-savings feature already rely on this
 * whole-month convention rather than a day-count/365 one.
 */
function monthsBetween(start: Date, end: Date): number {
  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth());
  return Math.max(0, months);
}

/**
 * EPIC-024 C3 (D10) — deposito current value via SIMPLE interest, pro-rata
 * by whole elapsed months: nominal × (1 + ratePct/100 × months/12).
 *
 * Hand-computed golden value (Definition of Done — money math is
 * test-first): Rp 100.000.000 at 5%/thn, purchasedAt 2026-01-01, viewed
 * 2026-07-01 → months = 6 → interest = 100_000_000 × 0.05 × 6/12 =
 * 2_500_000 → value = Rp 102.500.000. Verified in investments.service.spec.ts.
 *
 * - No rate set → returns `nominal` unchanged (principal is still a
 *   legitimate "current value" absent interest data; never null).
 * - No `purchasedAt` → returns `nominal` unchanged (no accrual start point
 *   to pro-rate from — matches "not yet dated" rather than guessing).
 * - Past `maturityDate` → interest STOPS accruing at maturity (a matured
 *   deposito does not keep earning simple interest indefinitely); the
 *   elapsed-months clock is capped at `purchasedAt` → `maturityDate`.
 */
function computeDepositoCurrentValue(
  nominal: Decimal,
  ratePct: Decimal | null,
  purchasedAt: Date | null,
  asOf: Date,
  maturityDate: Date | null,
): Decimal {
  if (!ratePct || !purchasedAt) return nominal;

  const effectiveEnd =
    maturityDate && asOf > maturityDate ? maturityDate : asOf;
  if (effectiveEnd <= purchasedAt) return nominal;

  const months = monthsBetween(purchasedAt, effectiveEnd);
  const interest = nominal
    .times(ratePct)
    .dividedBy(100)
    .times(months)
    .dividedBy(12);
  return nominal.plus(interest);
}

@Injectable()
export class InvestmentsService {
  private readonly logger = new Logger(InvestmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MARKET_DATA_PORT) private readonly marketData: MarketDataPort,
  ) {}

  async findAll(familyGroupId: string): Promise<InvestmentDto[]> {
    const investments = await this.prisma.investment.findMany({
      where: { familyGroupId },
      orderBy: { createdAt: "asc" },
      include: {
        prices: {
          orderBy: { recordedAt: "desc" },
          take: 1,
        },
      },
    });

    const today = startOfDay(new Date());

    const results = await Promise.all(
      investments.map(async (inv) => {
        let latestPrice = inv.prices[0] ?? null;
        // EPIC-023 Task G retry (MEDIUM finding) — true only when THIS
        // request attempted a fresh quote and it failed, so the UI can say
        // "refresh failed, showing the last known price" instead of
        // presenting a retained price identically to a fresh one.
        let priceRefreshFailed = false;
        // EPIC-024 C1 (D8) — true only for UnmappedTickerError: a PERMANENT
        // "no automated route exists" state, never set for a transient
        // failure (those still set priceRefreshFailed above).
        let automatedPriceUnmapped = false;

        // EPIC-023 G1 (D15) — only saham/kripto ever get an automated quote.
        // Mutual funds, bonds, gold and "lainnya" are manual-only: if no
        // manual price has been entered yet, this stays null rather than
        // fabricating one (see setManualPrice + the investasi page's
        // "diinput manual, per <date>" prompt for the no-price case).
        if (
          isAutomatedPriceType(inv.type) &&
          (!latestPrice || latestPrice.recordedAt < today)
        ) {
          try {
            const { price, source, asOf, delayed } =
              await this.marketData.getPrice(inv.ticker, inv.type);
            latestPrice = await this.prisma.investmentPrice.create({
              data: {
                investmentId: inv.id,
                price: new Decimal(price),
                source,
                asOf,
                delayed,
              },
            });
          } catch (err) {
            // A down/rate-limited external feed must not break the whole
            // portfolio view — fall back to the last known price (possibly
            // still null) rather than throwing out of findAll().
            if (err instanceof UnmappedTickerError) {
              // EPIC-024 C1 (D8) — permanent, not transient: this ticker has
              // no automated route at all. Label it as a manual-price
              // fallback rather than a failed refresh — logging every
              // request as a "warn" for an inherently unmapped ticker would
              // be noise, not signal.
              automatedPriceUnmapped = true;
            } else {
              priceRefreshFailed = true;
              this.logger.warn(
                `Price fetch failed for ${inv.ticker} (${inv.type}); keeping last known price`,
                err,
              );
            }
          }
        }

        const quantity = inv.quantity;
        const costBasis = inv.costBasisPerUnit;

        // EPIC-024 C3 (D10) — deposito is valued by SIMPLE INTEREST
        // pro-rata, never by a stored/fetched price row: it has no market,
        // automated or manual. `costBasisPerUnit` doubles as the nominal;
        // quantity is expected to be "1" (the form enforces this).
        const isDeposito = inv.type === "deposito";
        const depositoAsOf = isDeposito ? new Date() : null;
        let currentPrice = isDeposito ? null : (latestPrice?.price ?? null);

        let currentValue: Decimal | null = null;
        let returnRp: Decimal | null = null;
        let returnPct: number | null = null;

        if (isDeposito) {
          currentValue = computeDepositoCurrentValue(
            costBasis,
            inv.interestRatePct,
            inv.purchasedAt,
            depositoAsOf as Date,
            inv.maturityDate,
          );
          currentPrice = quantity.isZero()
            ? null
            : currentValue.dividedBy(quantity);
        } else if (currentPrice) {
          currentValue = currentPrice.times(quantity);
        }

        if (currentValue) {
          const totalCost = costBasis.times(quantity);
          returnRp = currentValue.minus(totalCost);
          const totalCostNum = totalCost.toNumber();
          returnPct =
            totalCostNum !== 0
              ? (returnRp.toNumber() / totalCostNum) * 100
              : null;
        }

        const projectedAnnualYield = computeProjectedAnnualYield(
          currentValue,
          inv.interestRatePct,
        );

        return {
          id: inv.id,
          familyGroupId: inv.familyGroupId,
          ticker: inv.ticker,
          name: inv.name,
          type: inv.type,
          quantity: decimalToString(quantity),
          costBasisPerUnit: decimalToString(costBasis),
          currentPrice: currentPrice ? decimalToString(currentPrice) : null,
          currentValue: currentValue ? decimalToString(currentValue) : null,
          returnRp: returnRp ? decimalToString(returnRp) : null,
          returnPct:
            returnPct !== null ? Math.round(returnPct * 100) / 100 : null,
          currency: inv.currency,
          notes: inv.notes,
          // EPIC-024 C3 (D10) — deposito's "price" is a live-computed
          // simple-interest value, never a stored InvestmentPrice row: its
          // provenance fields are synthesized ("computed-interest",
          // never delayed) rather than read from `latestPrice`.
          latestPriceRecordedAt: isDeposito
            ? (depositoAsOf as Date).toISOString()
            : (latestPrice?.recordedAt.toISOString() ?? null),
          latestPriceSource: isDeposito
            ? "computed-interest"
            : (latestPrice?.source ?? null),
          // EPIC-023 G1 (D15) — as-of time + delayed flag, so the UI can
          // label every automated price with its source and delay honestly.
          // `asOf` falls back to `recordedAt` for legacy rows written before
          // this column existed (never null-vs-unknown ambiguity on screen).
          latestPriceAsOf: isDeposito
            ? (depositoAsOf as Date).toISOString()
            : ((latestPrice?.asOf ?? latestPrice?.recordedAt)?.toISOString() ??
              null),
          latestPriceDelayed: isDeposito
            ? false
            : (latestPrice?.delayed ?? null),
          priceRefreshFailed,
          automatedPriceUnmapped,
          interestRatePct: inv.interestRatePct?.toString() ?? null,
          projectedAnnualYield: projectedAnnualYield
            ? decimalToString(projectedAnnualYield)
            : null,
          purchasedAt: inv.purchasedAt?.toISOString() ?? null,
          maturityDate: inv.maturityDate?.toISOString() ?? null,
          createdAt: inv.createdAt.toISOString(),
          updatedAt: inv.updatedAt.toISOString(),
        } satisfies InvestmentDto;
      }),
    );

    return results;
  }

  async getSummary(familyGroupId: string): Promise<InvestmentSummaryDto> {
    const holdings = await this.findAll(familyGroupId);

    let totalCostBasis = ZERO;
    let totalCurrentValue = ZERO;

    for (const h of holdings) {
      const qty = new Decimal(h.quantity);
      const cost = new Decimal(h.costBasisPerUnit);
      totalCostBasis = totalCostBasis.plus(cost.times(qty));

      if (h.currentValue) {
        totalCurrentValue = totalCurrentValue.plus(new Decimal(h.currentValue));
      } else {
        totalCurrentValue = totalCurrentValue.plus(cost.times(qty));
      }
    }

    const totalReturnRp = totalCurrentValue.minus(totalCostBasis);
    const totalCostNum = totalCostBasis.toNumber();
    const totalReturnPct =
      totalCostNum !== 0
        ? Math.round((totalReturnRp.toNumber() / totalCostNum) * 10_000) / 100
        : 0;

    // todayReturn not tracked separately (requires yesterday's snapshot) — default to 0
    return {
      totalCostBasis: decimalToString(totalCostBasis),
      totalCurrentValue: decimalToString(totalCurrentValue),
      totalReturnRp: decimalToString(totalReturnRp),
      totalReturnPct,
      todayReturnRp: "0",
      todayReturnPct: 0,
    };
  }

  async create(
    familyGroupId: string,
    dto: CreateInvestmentDto,
  ): Promise<InvestmentDto> {
    this.assertValidInterestRatePct(dto.interestRatePct);

    const investment = await this.prisma.investment.create({
      data: {
        familyGroupId,
        ticker: dto.ticker,
        name: dto.name,
        type: dto.type,
        quantity: new Decimal(dto.quantity),
        costBasisPerUnit: new Decimal(dto.costBasisPerUnit),
        currency: dto.currency ?? "IDR",
        notes: dto.notes ?? null,
        interestRatePct: dto.interestRatePct ?? null,
        purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : null,
        maturityDate: dto.maturityDate ? new Date(dto.maturityDate) : null,
      },
    });

    this.logger.log(
      `Created investment ${investment.id} (${investment.ticker})`,
    );

    return {
      id: investment.id,
      familyGroupId: investment.familyGroupId,
      ticker: investment.ticker,
      name: investment.name,
      type: investment.type,
      quantity: decimalToString(investment.quantity),
      costBasisPerUnit: decimalToString(investment.costBasisPerUnit),
      currentPrice: null,
      currentValue: null,
      returnRp: null,
      returnPct: null,
      currency: investment.currency,
      notes: investment.notes,
      latestPriceRecordedAt: null,
      latestPriceSource: null,
      latestPriceAsOf: null,
      latestPriceDelayed: null,
      priceRefreshFailed: false,
      automatedPriceUnmapped: false,
      interestRatePct: investment.interestRatePct?.toString() ?? null,
      projectedAnnualYield: null,
      purchasedAt: investment.purchasedAt?.toISOString() ?? null,
      maturityDate: investment.maturityDate?.toISOString() ?? null,
      createdAt: investment.createdAt.toISOString(),
      updatedAt: investment.updatedAt.toISOString(),
    };
  }

  async update(
    familyGroupId: string,
    id: string,
    dto: UpdateInvestmentDto,
  ): Promise<InvestmentDto> {
    const existing = await this.prisma.investment.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Investment not found");
    }

    this.assertValidInterestRatePct(dto.interestRatePct);

    const updated = await this.prisma.investment.update({
      where: { id, familyGroupId },
      data: {
        ticker: dto.ticker ?? existing.ticker,
        name: dto.name ?? existing.name,
        type: dto.type ?? existing.type,
        quantity: dto.quantity ? new Decimal(dto.quantity) : existing.quantity,
        costBasisPerUnit: dto.costBasisPerUnit
          ? new Decimal(dto.costBasisPerUnit)
          : existing.costBasisPerUnit,
        currency: dto.currency ?? existing.currency,
        notes: dto.notes !== undefined ? (dto.notes ?? null) : existing.notes,
        interestRatePct:
          dto.interestRatePct !== undefined
            ? dto.interestRatePct
            : existing.interestRatePct,
        purchasedAt:
          dto.purchasedAt !== undefined
            ? new Date(dto.purchasedAt)
            : existing.purchasedAt,
        maturityDate:
          dto.maturityDate !== undefined
            ? new Date(dto.maturityDate)
            : existing.maturityDate,
      },
    });

    return {
      id: updated.id,
      familyGroupId: updated.familyGroupId,
      ticker: updated.ticker,
      name: updated.name,
      type: updated.type,
      quantity: decimalToString(updated.quantity),
      costBasisPerUnit: decimalToString(updated.costBasisPerUnit),
      currentPrice: null,
      currentValue: null,
      returnRp: null,
      returnPct: null,
      currency: updated.currency,
      notes: updated.notes,
      latestPriceRecordedAt: null,
      latestPriceSource: null,
      latestPriceAsOf: null,
      latestPriceDelayed: null,
      priceRefreshFailed: false,
      automatedPriceUnmapped: false,
      interestRatePct: updated.interestRatePct?.toString() ?? null,
      projectedAnnualYield: null,
      purchasedAt: updated.purchasedAt?.toISOString() ?? null,
      maturityDate: updated.maturityDate?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /** 0..100 inclusive; class-validator only checks the string format. */
  private assertValidInterestRatePct(value?: string): void {
    if (value == null) return;
    const n = Number(value);
    if (
      !Number.isFinite(n) ||
      n < MIN_INTEREST_RATE_PCT ||
      n > MAX_INTEREST_RATE_PCT
    ) {
      throw new BadRequestException(
        `interestRatePct must be between ${MIN_INTEREST_RATE_PCT} and ${MAX_INTEREST_RATE_PCT}`,
      );
    }
  }

  async remove(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.investment.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Investment not found");
    }
    await this.prisma.investment.delete({ where: { id, familyGroupId } });
  }

  /**
   * EPIC-023 G1 (D15) — manual price entry, the honest counterpart to the
   * automated CoinGecko/Yahoo feeds. Available for any instrument type (an
   * owner may still want to correct a stale automated price), but it is the
   * ONLY way a manual-only type (reksa_dana, obligasi, emas, lainnya) ever
   * gets a price — never fabricated, always dated, `source: "manual"`.
   */
  async setManualPrice(
    familyGroupId: string,
    id: string,
    dto: SetManualPriceDto,
  ): Promise<InvestmentPriceDto> {
    const existing = await this.prisma.investment.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Investment not found");
    }

    const asOf = dto.asOf ? new Date(dto.asOf) : new Date();
    const created = await this.prisma.investmentPrice.create({
      data: {
        investmentId: id,
        price: new Decimal(dto.price),
        source: "manual",
        asOf,
        delayed: false,
      },
    });

    return {
      id: created.id,
      investmentId: created.investmentId,
      price: decimalToString(created.price),
      source: created.source,
      asOf: (created.asOf ?? created.recordedAt).toISOString(),
      delayed: created.delayed,
      recordedAt: created.recordedAt.toISOString(),
    };
  }
}
