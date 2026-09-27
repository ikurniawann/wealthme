import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";

import {
  FAMILY_GOLD_PRICE_SOURCE,
  familyGoldUnitPrice,
} from "../common/utils/investment-value.util";
import { runSerializableWithRetry } from "../common/utils/serializable-retry.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import { UnmappedTickerError } from "./coingecko-market-data.adapter";
import { deriveInternalCode } from "./internal-code.util";
import { isAutomatedPriceType, MARKET_DATA_PORT } from "./market-data.port";

import type { CreateInvestmentTransactionDto } from "./dto/create-investment-transaction.dto";
import type { CreateInvestmentDto } from "./dto/create-investment.dto";
import type { SetManualPriceDto } from "./dto/set-manual-price.dto";
import type { UpdateInvestmentDto } from "./dto/update-investment.dto";
import type { MarketDataPort } from "./market-data.port";
import type { TxClient } from "../common/utils/serializable-retry.util";
import type {
  InvestmentDto,
  InvestmentPriceDto,
  InvestmentSummaryDto,
  InvestmentTransactionDto,
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

/** Unlike decimalToString, never fabricates "0" — null stays null (e.g. "no
 * sell has ever been recorded" must read differently from "sold at exactly
 * break-even"). */
function decimalToStringOrNull(d: Decimal | null): string | null {
  return d ? d.toString() : null;
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
        familyGroup: {
          select: { goldPricePerGram: true, goldPriceUpdatedAt: true },
        },
      },
    });

    const today = startOfDay(new Date());

    // EPIC-022 D2 — realized P/L per holding: sum of `realizedPnl` across
    // every SELL ever recorded against it. One grouped query for the whole
    // page rather than N+1 per-holding queries.
    const realizedTotals =
      investments.length > 0
        ? await this.prisma.investmentTransaction.groupBy({
            by: ["investmentId"],
            where: {
              investmentId: { in: investments.map((inv) => inv.id) },
              type: "sell",
            },
            _sum: { realizedPnl: true },
          })
        : [];
    const realizedPnlByInvestment = new Map(
      realizedTotals.map((r) => [r.investmentId, r._sum.realizedPnl]),
    );

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
        const familyGoldPrice = familyGoldUnitPrice(inv);
        const familyGoldAsOf = familyGoldPrice
          ? inv.familyGroup.goldPriceUpdatedAt
          : null;
        let currentPrice = isDeposito
          ? null
          : (familyGoldPrice ??
            latestPrice?.price ??
            (inv.type === "emas" ? costBasis : null));

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
            : familyGoldPrice
              ? (familyGoldAsOf?.toISOString() ?? null)
              : (latestPrice?.recordedAt.toISOString() ?? null),
          latestPriceSource: isDeposito
            ? "computed-interest"
            : familyGoldPrice
              ? FAMILY_GOLD_PRICE_SOURCE
              : (latestPrice?.source ?? null),
          // EPIC-023 G1 (D15) — as-of time + delayed flag, so the UI can
          // label every automated price with its source and delay honestly.
          // `asOf` falls back to `recordedAt` for legacy rows written before
          // this column existed (never null-vs-unknown ambiguity on screen).
          latestPriceAsOf: isDeposito
            ? (depositoAsOf as Date).toISOString()
            : familyGoldPrice
              ? (familyGoldAsOf?.toISOString() ?? null)
              : ((
                  latestPrice?.asOf ?? latestPrice?.recordedAt
                )?.toISOString() ?? null),
          latestPriceDelayed:
            isDeposito || familyGoldPrice
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
          realizedPnlRp: decimalToStringOrNull(
            realizedPnlByInvestment.get(inv.id) ?? null,
          ),
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
    this.assertValidQuantity(dto.quantity);
    this.assertValidCostBasis(dto.costBasisPerUnit);
    const ticker = this.resolveTickerForCreate(dto.type, dto.ticker, dto.name);

    const investment = await this.prisma.investment.create({
      data: {
        familyGroupId,
        ticker,
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
      realizedPnlRp: null,
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

    // Security review HIGH (EPIC-022 D2 retry) — `quantity`/`costBasisPerUnit`
    // must NEVER be settable through this generic edit endpoint for a
    // lot-tracked holding: that's exactly the silent, unvalidated,
    // un-audited overwrite `recordTransaction()` was built to replace, and
    // the frontend disabling those inputs is UI-only (a direct API call
    // bypasses it entirely). Deposito is the sole exception — it has no
    // lot/buy-sell concept and its "costBasisPerUnit" is just a
    // typo-correctable nominal — and even then the value must still be
    // positive/non-negative (see assertValidQuantity/assertValidCostBasis).
    // Gated on the type explicitly here, never trusted from the DTO alone.
    const effectiveType = dto.type ?? existing.type;
    if (
      (dto.quantity !== undefined || dto.costBasisPerUnit !== undefined) &&
      effectiveType !== "deposito"
    ) {
      throw new BadRequestException(
        "quantity and costBasisPerUnit can only be changed via a buy/sell transaction (POST .../investments/:id/transactions) for this investment type",
      );
    }
    if (dto.quantity !== undefined) {
      this.assertValidQuantity(dto.quantity);
    }
    if (dto.costBasisPerUnit !== undefined) {
      this.assertValidCostBasis(dto.costBasisPerUnit);
    }

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
      realizedPnlRp: null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /** E2E round-2 B1 — ticker is required only for the types the price
   * feed actually looks up (saham → Yahoo, kripto → CoinGecko; see
   * AUTOMATED_PRICE_TYPES). Every other type (deposito, emas, reksa_dana,
   * obligasi, lainnya) accepts a missing/blank ticker: Indonesian users
   * have no ticker for a deposito at BRI or emas Antam fisik. For those,
   * derive a stable internal code so the NOT NULL `ticker` column is
   * still satisfied without ever reaching MarketDataPort with it and
   * without displaying it to the user as a real ticker. */
  private resolveTickerForCreate(
    type: CreateInvestmentDto["type"],
    ticker: string | undefined,
    name: string,
  ): string {
    const trimmed = ticker?.trim() ?? "";
    if (isAutomatedPriceType(type)) {
      if (!trimmed) {
        throw new BadRequestException(
          "Ticker wajib diisi untuk saham dan kripto (dipakai sinkronisasi harga)",
        );
      }
      return trimmed;
    }
    return trimmed || deriveInternalCode(name);
  }

  /** MEDIUM (EPIC-022 D2 retry) — mirrors recordTransaction()'s own guard:
   * class-validator's @IsNumberString() accepts a negative sign, so a sign
   * check must happen here too for whatever path still writes quantity. */
  private assertValidQuantity(value: string): void {
    const q = new Decimal(value);
    if (!q.greaterThan(0)) {
      throw new BadRequestException("quantity must be greater than 0");
    }
  }

  /** MEDIUM (EPIC-022 D2 retry) — same reasoning as assertValidQuantity(),
   * for costBasisPerUnit (allowed to be exactly 0, never negative). */
  private assertValidCostBasis(value: string): void {
    const c = new Decimal(value);
    if (c.lessThan(0)) {
      throw new BadRequestException("costBasisPerUnit must not be negative");
    }
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

  /**
   * HIGH (EPIC-022 D2 retry) — refuses deletion while any InvestmentTransaction
   * exists, mirroring `LiabilitiesService.remove()`'s "never a silent
   * cascade" rule for a liability with a budget line still attached. The
   * schema's `onDelete: Cascade` on `InvestmentTransaction.investmentId` is
   * only safe BECAUSE this guard makes that cascade unreachable in
   * practice — see the doc comment on that FK.
   */
  async remove(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.investment.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Investment not found");
    }

    const txCount = await this.prisma.investmentTransaction.count({
      where: { investmentId: id },
    });
    if (txCount > 0) {
      throw new ConflictException(
        `Tidak dapat menghapus "${existing.name}" — riwayat transaksi (beli/jual) sudah ada dan tidak boleh dihapus diam-diam`,
      );
    }

    await this.prisma.investment.delete({ where: { id, familyGroupId } });
  }

  /**
   * EPIC-023 G1 (D15) — manual price entry, the honest counterpart to the
   * automated CoinGecko/Yahoo feeds. Available for any instrument type (an
   * owner may still want to correct a stale automated price), but it is the
   * ONLY way a manual-only type (reksa_dana, obligasi, lainnya — and emas
   * while no family gold price is set) ever
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

  /**
   * EPIC-022 D2 — the honest replacement for editing quantity/costBasisPerUnit
   * directly: a BUY grows the position and recomputes a weighted-average
   * cost (`newAvgCost = (oldQty*oldAvgCost + addedQty*addedCost) /
   * (oldQty+addedQty)`); a SELL shrinks it, books a realized P/L for the
   * sold portion (`(sellPrice - costBasisPerUnit) × soldQty`), and — the
   * disposal-path guard — refuses to sell more than is currently held.
   * Every call appends one InvestmentTransaction row: this table is the
   * real history the old whole-record overwrite destroyed.
   *
   * CRITICAL/HIGH (EPIC-022 D2 retry) — the current `quantity`/
   * `costBasisPerUnit` are read and the guards evaluated INSIDE the
   * Serializable transaction (`runRecordTransaction`), never outside it:
   * two concurrent buy/sell calls against the same holding would otherwise
   * both read the same starting state, both pass their own guards
   * (including the oversell guard) independently, and both commit —
   * silently losing one call's effect while still recording its
   * InvestmentTransaction audit row. `runSerializableWithRetry` (the same
   * helper `LiabilitiesService.pay()` uses for the identical read-then-
   * write-a-balance shape) runs this at Serializable isolation so Postgres
   * itself catches the conflicting concurrent write and the loser retries
   * against the winner's committed state.
   */
  async recordTransaction(
    familyGroupId: string,
    id: string,
    dto: CreateInvestmentTransactionDto,
  ): Promise<InvestmentTransactionDto> {
    const qty = new Decimal(dto.quantity);
    // NOTE: Decimal#isPositive() treats 0 as positive (sign bit only) — use
    // an explicit `> 0` comparison so a zero quantity is correctly rejected.
    if (!qty.greaterThan(0)) {
      throw new BadRequestException("quantity must be greater than 0");
    }
    const price = new Decimal(dto.pricePerUnit);
    if (price.lessThan(0)) {
      throw new BadRequestException("pricePerUnit must not be negative");
    }
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();

    const created = await runSerializableWithRetry(this.prisma, (tx) =>
      this.runRecordTransaction(
        tx,
        familyGroupId,
        id,
        dto.type,
        qty,
        price,
        occurredAt,
        dto.accountId ?? null,
      ),
    );

    this.logger.log(
      `Recorded ${dto.type} of ${qty.toString()} unit(s) for investment ${id}`,
    );

    return {
      id: created.id,
      investmentId: created.investmentId,
      type: created.type,
      quantity: decimalToString(created.quantity),
      pricePerUnit: decimalToString(created.pricePerUnit),
      occurredAt: created.occurredAt.toISOString(),
      realizedPnl: decimalToStringOrNull(created.realizedPnl),
      createdAt: created.createdAt.toISOString(),
    };
  }

  /** The tx-scoped body of recordTransaction() — see that method's doc
   * comment for why the read + guards must live inside the Serializable
   * transaction rather than before it. */
  private async runRecordTransaction(
    tx: TxClient,
    familyGroupId: string,
    id: string,
    type: CreateInvestmentTransactionDto["type"],
    qty: Decimal,
    price: Decimal,
    occurredAt: Date,
    accountId: string | null = null,
  ) {
    const existing = await tx.investment.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Investment not found");
    }
    const settleAccount = accountId
      ? await tx.account.findUnique({ where: { id: accountId, familyGroupId } })
      : null;
    if (accountId && !settleAccount) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    const oldQty = existing.quantity;
    const oldAvgCost = existing.costBasisPerUnit;

    let newQty: Decimal;
    let newAvgCost: Decimal;
    let realizedPnl: Decimal | null = null;

    if (type === "buy") {
      newQty = oldQty.plus(qty);
      newAvgCost = oldQty
        .times(oldAvgCost)
        .plus(qty.times(price))
        .dividedBy(newQty);
    } else {
      // Disposal-path guard — never let a sell drive the position negative.
      // Re-checked against the tx-scoped `oldQty` on every retry, so a
      // concurrent sell that already committed is reflected here.
      if (qty.greaterThan(oldQty)) {
        throw new BadRequestException(
          `Cannot sell ${qty.toString()} unit(s) — only ${oldQty.toString()} currently held`,
        );
      }
      newQty = oldQty.minus(qty);
      // Remaining lots keep the SAME average cost — a sale never changes
      // what the still-held units cost, only the realized result of the
      // portion sold.
      newAvgCost = oldAvgCost;
      realizedPnl = price.minus(oldAvgCost).times(qty);
    }

    await tx.investment.update({
      where: { id, familyGroupId },
      data: { quantity: newQty, costBasisPerUnit: newAvgCost },
    });

    // EPIC-033 p28 — money actually moves when a settlement account is
    // named. A buy is an allocation (transfer out, never an expense); a sell
    // returns the cost through a transfer in and books the realised gain as
    // "Hasil Investasi" income so the P&L sees it.
    if (settleAccount) {
      // A foreign pricePerUnit was already rounded to sen (≤0.005 IDR/unit) before
      // this point — that per-unit rounding is intentional and consistent with how
      // avg cost/PnL is also carried at sen precision.
      const gross = BigInt(qty.times(price).toFixed(0));
      const label = `${qty.toString()} ${existing.ticker} @ ${price.toString()}`;
      if (type === "buy") {
        await tx.account.update({
          where: { id: settleAccount.id },
          data: { balance: { decrement: gross } },
        });
        await tx.transaction.create({
          data: {
            familyGroupId,
            accountId: settleAccount.id,
            toAccountId: null,
            type: "transfer",
            amount: gross,
            description: `Beli ${label}`,
            occurredAt,
          },
        });
      } else {
        const pnl = BigInt((realizedPnl ?? new Decimal(0)).toFixed(0));
        const gain = pnl > BigInt(0) ? pnl : BigInt(0);
        const loss = pnl < BigInt(0) ? -pnl : BigInt(0);
        await tx.account.update({
          where: { id: settleAccount.id },
          data: { balance: { increment: gross } },
        });
        await tx.transaction.create({
          data: {
            familyGroupId,
            accountId: null,
            toAccountId: settleAccount.id,
            type: "transfer",
            amount: gross - gain + loss,
            description: `Jual ${label}`,
            occurredAt,
          },
        });
        if (loss > BigInt(0)) {
          // The cost portion transferred back exceeds the proceeds; the
          // difference is a realised loss, booked as an expense so the P&L
          // and the account balance agree.
          const lossCategory = await this.resolveLossCategoryId(
            tx,
            familyGroupId,
          );
          await tx.transaction.create({
            data: {
              familyGroupId,
              accountId: settleAccount.id,
              categoryId: lossCategory,
              type: "expense",
              amount: loss,
              description: `Rugi jual ${label}`,
              occurredAt,
            },
          });
        }
        if (gain > BigInt(0)) {
          const incomeCategory = await tx.category.findFirst({
            where: { familyGroupId, kind: "income", name: "Hasil Investasi" },
            select: { id: true },
          });
          await tx.transaction.create({
            data: {
              familyGroupId,
              accountId: settleAccount.id,
              categoryId: incomeCategory?.id ?? null,
              type: "income",
              amount: gain,
              description: `Untung jual ${label}`,
              occurredAt,
            },
          });
        }
      }
    }

    return tx.investmentTransaction.create({
      data: {
        investmentId: id,
        type,
        quantity: qty,
        pricePerUnit: price,
        occurredAt,
        realizedPnl,
      },
    });
  }

  /**
   * EPIC-033 p28 — "Rugi Investasi" expense category, created on first use
   * against the family's catch-all expense COA account (20099) when missing.
   */
  private async resolveLossCategoryId(
    tx: TxClient,
    familyGroupId: string,
  ): Promise<string | null> {
    const existing = await tx.category.findFirst({
      where: { familyGroupId, kind: "expense", name: "Rugi Investasi" },
      select: { id: true },
    });
    if (existing) return existing.id;
    const coa = await tx.coaAccount.findFirst({
      where: { familyGroupId, code: "20099" },
      select: { id: true },
    });
    if (!coa) return null;
    const created = await tx.category.create({
      data: {
        familyGroupId,
        name: "Rugi Investasi",
        kind: "expense",
        coaAccountId: coa.id,
      },
      select: { id: true },
    });
    return created.id;
  }

  /** EPIC-033 p18 — every recorded price for one holding, most recent first. */
  async findPrices(
    familyGroupId: string,
    id: string,
  ): Promise<InvestmentPriceDto[]> {
    const existing = await this.prisma.investment.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Investment not found");
    }
    const rows = await this.prisma.investmentPrice.findMany({
      where: { investmentId: id },
      orderBy: { recordedAt: "desc" },
      take: 200,
    });
    return rows.map((r) => ({
      id: r.id,
      investmentId: r.investmentId,
      price: decimalToString(r.price),
      source: r.source,
      delayed: r.delayed,
      asOf: (r.asOf ?? r.recordedAt).toISOString(),
      recordedAt: r.recordedAt.toISOString(),
    }));
  }

  /** EPIC-022 D2 — the real buy/sell history for one holding, most recent first. */
  async findTransactions(
    familyGroupId: string,
    id: string,
  ): Promise<InvestmentTransactionDto[]> {
    const existing = await this.prisma.investment.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Investment not found");
    }

    const rows = await this.prisma.investmentTransaction.findMany({
      where: { investmentId: id },
      orderBy: { occurredAt: "desc" },
    });

    return rows.map((r) => ({
      id: r.id,
      investmentId: r.investmentId,
      type: r.type,
      quantity: decimalToString(r.quantity),
      pricePerUnit: decimalToString(r.pricePerUnit),
      occurredAt: r.occurredAt.toISOString(),
      realizedPnl: decimalToStringOrNull(r.realizedPnl),
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
