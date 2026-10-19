import { randomUUID } from "node:crypto";

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
  computeDepositoCurrentValue,
  familyGoldUnitPrice,
} from "../common/utils/investment-value.util";
import { runSerializableWithRetry } from "../common/utils/serializable-retry.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import { UnmappedTickerError } from "./coingecko-market-data.adapter";
import { deriveInternalCode } from "./internal-code.util";
import {
  decimalToString,
  decimalToStringOrNull,
  toTransactionDto,
} from "./investment-transaction.mapper";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InvestmentLedgerService } from "./ledger/investment-ledger.service";
import { cashKeyParts } from "./ledger/ledger-dates";
import { isAutomatedPriceType, MARKET_DATA_PORT } from "./market-data.port";

import type { CreateInvestmentTransactionDto } from "./dto/create-investment-transaction.dto";
import type { CreateInvestmentDto } from "./dto/create-investment.dto";
import type { SetManualPriceDto } from "./dto/set-manual-price.dto";
import type { UpdateInvestmentDto } from "./dto/update-investment.dto";
import type { LedgerActor } from "./ledger/investment-ledger.service";
import type { MarketDataPort } from "./market-data.port";
import type {
  Investment as InvestmentRow,
  InvestmentPrice as InvestmentPriceRow,
  InvestmentType,
} from "@prisma/client";
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

/**
 * Investasi R6 — an instant's calendar date in Asia/Jakarta, as a UTC-midnight
 * Date for a `@db.Date` column. Matches the migration backfill, so a
 * date-only value sent as UTC midnight keeps its own date.
 */
function jakartaDate(instant: Date): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** Investasi rebuild columns (R2, R4) carried on every InvestmentDto. */
function holdingRebuildFields(
  inv: InvestmentRow,
): Pick<
  InvestmentDto,
  | "market"
  | "lotSize"
  | "allowFraction"
  | "priceSymbol"
  | "ownerUserId"
  | "platformAccountId"
  | "cashAccountId"
  | "details"
> {
  return {
    market: inv.market,
    lotSize: inv.lotSize,
    allowFraction: inv.allowFraction,
    priceSymbol: inv.priceSymbol,
    ownerUserId: inv.ownerUserId,
    platformAccountId: inv.platformAccountId,
    cashAccountId: inv.cashAccountId,
    details: (inv.details ?? null) as InvestmentDto["details"],
  };
}

function toPriceDto(r: InvestmentPriceRow): InvestmentPriceDto {
  return {
    id: r.id,
    investmentId: r.investmentId,
    price: decimalToString(r.price),
    source: r.source,
    asOf: (r.asOf ?? r.recordedAt).toISOString(),
    delayed: r.delayed,
    recordedAt: r.recordedAt.toISOString(),
    currency: r.currency,
    unitLabel: r.unitLabel,
    reference: r.reference,
    hasTime: r.hasTime,
  };
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

@Injectable()
export class InvestmentsService {
  private readonly logger = new Logger(InvestmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MARKET_DATA_PORT) private readonly marketData: MarketDataPort,
    private readonly ledger: InvestmentLedgerService,
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
              kind: "sell",
              status: "active",
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
        // Batch B6 — MockMarketDataAdapter (dev/demo, no USE_REAL_MARKET_DATA)
        // fabricates a deterministic-but-fake price for ANY ticker, including
        // ones that don't exist. Client report: "QQ" showed a real-looking
        // "Live" current value driven entirely by this simulated number. A
        // real holding must never be valued off a source we know is fake —
        // treat a "mock"-sourced price exactly like "no automated price
        // found": current value falls back to cost basis, and `currentPrice`
        // stays null so the UI's existing "price unavailable" honesty path
        // renders instead of a fabricated figure with a "Live" badge.
        const isSimulatedPrice =
          !isDeposito && !familyGoldPrice && latestPrice?.source === "mock";
        let currentPrice = isDeposito
          ? null
          : (familyGoldPrice ??
            (isSimulatedPrice ? null : latestPrice?.price) ??
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
        } else if (isSimulatedPrice) {
          currentValue = costBasis.times(quantity);
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
          automatedPriceSimulated: isSimulatedPrice,
          interestRatePct: inv.interestRatePct?.toString() ?? null,
          projectedAnnualYield: projectedAnnualYield
            ? decimalToString(projectedAnnualYield)
            : null,
          purchasedAt: inv.purchasedAt?.toISOString() ?? null,
          maturityDate: inv.maturityDate?.toISOString() ?? null,
          realizedPnlRp: decimalToStringOrNull(
            realizedPnlByInvestment.get(inv.id) ?? null,
          ),
          ...holdingRebuildFields(inv),
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

    // todayReturn not tracked separately (requires yesterday's snapshot) — return null instead of 0
    return {
      totalCostBasis: decimalToString(totalCostBasis),
      totalCurrentValue: decimalToString(totalCurrentValue),
      totalReturnRp: decimalToString(totalReturnRp),
      totalReturnPct,
      todayReturnRp: null,
      todayReturnPct: null,
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

    const quantity = new Decimal(dto.quantity);
    const costBasisPerUnit = new Decimal(dto.costBasisPerUnit);
    const purchasedAt = dto.purchasedAt ? new Date(dto.purchasedAt) : null;
    const openedAt = purchasedAt ?? new Date();
    // Investasi R5 — the starting position is also an `opening` ledger row
    // (no cash leg), so a replay of the ledger reproduces this holding,
    // exactly like the migration backfill does for legacy holdings.
    const openingAmount = quantity.times(costBasisPerUnit).toDecimalPlaces(2);
    const investment = await this.prisma.investment.create({
      data: {
        familyGroupId,
        ticker,
        name: dto.name,
        type: dto.type,
        quantity,
        costBasisPerUnit,
        currency: dto.currency ?? "IDR",
        notes: dto.notes ?? null,
        interestRatePct: dto.interestRatePct ?? null,
        purchasedAt,
        maturityDate: dto.maturityDate ? new Date(dto.maturityDate) : null,
        ...(quantity.greaterThan(0)
          ? {
              transactions: {
                create: {
                  familyGroup: { connect: { id: familyGroupId } },
                  type: "buy",
                  kind: "opening",
                  quantity,
                  pricePerUnit: costBasisPerUnit,
                  occurredAt: openedAt,
                  effectiveDate: jakartaDate(openedAt),
                  grossAmount: openingAmount,
                  netAmount: openingAmount,
                  currency: "IDR",
                },
              },
            }
          : {}),
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
      automatedPriceSimulated: false,
      interestRatePct: investment.interestRatePct?.toString() ?? null,
      projectedAnnualYield: null,
      purchasedAt: investment.purchasedAt?.toISOString() ?? null,
      maturityDate: investment.maturityDate?.toISOString() ?? null,
      realizedPnlRp: null,
      ...holdingRebuildFields(investment),
      createdAt: investment.createdAt.toISOString(),
      updatedAt: investment.updatedAt.toISOString(),
    };
  }

  async update(
    familyGroupId: string,
    id: string,
    dto: UpdateInvestmentDto,
    actor: LedgerActor = { userId: null, member: null },
  ): Promise<InvestmentDto> {
    const existing = await this.prisma.investment.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Investment not found");
    }

    this.assertValidInterestRatePct(dto.interestRatePct);

    // Investasi Task 7 — quantity/costBasisPerUnit are owned by the ledger:
    // every holding has an `opening` row, so overwriting them here would
    // desync the replay. For EVERY type (deposito included) the change is
    // routed through the ledger instead: it edits the holding's sole
    // `opening` (or creates one when the ledger is empty), replayed and
    // audited; once other ledger rows exist it is refused (409) and must be
    // corrected through the transaction history. Validated here first so a
    // negative value is a 400 before any lock is taken.
    if (dto.quantity !== undefined) {
      this.assertValidQuantity(dto.quantity);
    }
    if (dto.costBasisPerUnit !== undefined) {
      this.assertValidCostBasis(dto.costBasisPerUnit);
    }
    const effectiveType = dto.type ?? existing.type;

    const effectiveName = dto.name ?? existing.name;
    const ticker = this.resolveTickerForUpdate(
      effectiveType,
      existing.type,
      dto.ticker,
      existing.ticker,
      effectiveName,
    );

    const positionChanged =
      dto.quantity !== undefined || dto.costBasisPerUnit !== undefined;
    const updated = await runSerializableWithRetry(this.prisma, async (tx) => {
      if (positionChanged) {
        await this.ledger.reviseOpeningPosition(
          tx,
          familyGroupId,
          id,
          { quantity: dto.quantity, costBasisPerUnit: dto.costBasisPerUnit },
          actor,
        );
      }
      return tx.investment.update({
        where: { id, familyGroupId },
        data: {
          ticker,
          name: dto.name ?? existing.name,
          type: dto.type ?? existing.type,
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
      automatedPriceSimulated: false,
      interestRatePct: updated.interestRatePct?.toString() ?? null,
      projectedAnnualYield: null,
      purchasedAt: updated.purchasedAt?.toISOString() ?? null,
      maturityDate: updated.maturityDate?.toISOString() ?? null,
      realizedPnlRp: null,
      ...holdingRebuildFields(updated),
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

  /** Review fix (fix-round1) — `update()`'s own counterpart to
   * `resolveTickerForCreate`: a PATCH that changes `type` to saham/kripto
   * must still be rejected with the SAME message when there is no REAL
   * ticker, otherwise the create-time guard is trivially bypassed by
   * creating as e.g. `deposito` (an internal code, never a real ticker)
   * then PATCHing `type` to `saham`. The stored ticker only counts as
   * "real" when the ROW WAS ALREADY an automated type — a fresh
   * automated-type PATCH must supply its own `ticker` in the same request.
   * Changing AWAY from an automated type (e.g. saham -> deposito) keeps
   * whatever ticker is already stored — no reason to force it blank. */
  private resolveTickerForUpdate(
    effectiveType: InvestmentType,
    existingType: InvestmentType,
    dtoTicker: string | undefined,
    existingTicker: string,
    name: string,
  ): string {
    if (isAutomatedPriceType(effectiveType)) {
      const fallback = isAutomatedPriceType(existingType) ? existingTicker : "";
      const trimmed = (dtoTicker ?? fallback).trim();
      if (!trimmed) {
        throw new BadRequestException(
          "Ticker wajib diisi untuk saham dan kripto (dipakai sinkronisasi harga)",
        );
      }
      return trimmed;
    }
    const trimmed = (dtoTicker ?? existingTicker).trim();
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

  /** Hardening audit (validation, HIGH) — a manual price must be strictly
   * positive: `@IsNumberString()` on the DTO accepts a leading "-", and a
   * zero/negative quote would corrupt the holding's valuation. */
  private assertValidManualPrice(value: string): void {
    const p = new Decimal(value);
    if (!p.greaterThan(0)) {
      throw new BadRequestException("price must be greater than 0");
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

    // The `opening` row only restates the holding's own starting position
    // (written by create() and the migration backfill, no cash leg), so it
    // alone must not block deletion — it cascades with the holding.
    // Voided rows no longer move cash or units (their cash leg is gone);
    // their audit trail stays in audit_logs.
    const txCount = await this.prisma.investmentTransaction.count({
      where: { investmentId: id, kind: { not: "opening" }, status: "active" },
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
    // Hardening audit (validation, HIGH) — `@IsNumberString()` accepts
    // "-15250"; this used to be persisted unchecked via `new Decimal(...)`,
    // corrupting the holding's valuation.
    this.assertValidManualPrice(dto.price);
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
        // The web sends a date-only entry as UTC midnight; record it as
        // date-only (same rule as the migration backfill) instead of
        // claiming a 00:00 quote time.
        hasTime: !(
          dto.asOf &&
          asOf.getUTCHours() === 0 &&
          asOf.getUTCMinutes() === 0 &&
          asOf.getUTCSeconds() === 0 &&
          asOf.getUTCMilliseconds() === 0
        ),
      },
    });

    return toPriceDto(created);
  }

  /**
   * EPIC-022 D2 — legacy buy/sell endpoint (POST .../investments/:id/
   * transactions) kept for the pre-rebuild web. Since Task 7 it is a thin
   * adapter over the ledger engine (InvestmentLedgerService): the trade is
   * replayed with the holding's whole history (weighted average, R1),
   * checked for holdings and cash at its effective point and every later
   * point (409 on conflict), and `accountId` becomes the cash leg — a buy
   * is a one-sided transfer out, a sell a transfer in of the proceeds (the
   * realized P/L stays on the ledger row; no separate income/loss rows).
   * The legacy body carries IDR prices (fxInputs are converted before this
   * point), so the row is IDR. `occurredAt` maps to its Asia/Jakarta date
   * and HH:MM (midnight = date-only).
   */
  async recordTransaction(
    familyGroupId: string,
    id: string,
    dto: CreateInvestmentTransactionDto,
    actor: LedgerActor = { userId: null, member: null },
  ): Promise<InvestmentTransactionDto> {
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    const { effectiveDate, effectiveTime } = cashKeyParts(occurredAt);
    const result = await this.ledger.create(
      familyGroupId,
      id,
      {
        kind: dto.type,
        idempotencyKey: dto.idempotencyKey ?? randomUUID(),
        effectiveDate,
        effectiveTime,
        timeZone: effectiveTime ? "Asia/Jakarta" : null,
        quantity: dto.quantity,
        pricePerUnit: dto.pricePerUnit,
        currency: "IDR",
        cashAccountId: dto.accountId ?? null,
      },
      actor,
    );

    this.logger.log(
      `Recorded ${dto.type} of ${dto.quantity} unit(s) for investment ${id}`,
    );

    return result.transaction;
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
    return rows.map(toPriceDto);
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

    // Investasi R6, newest first: effectiveDate, effectiveTime (date-only
    // rows count as start of day, so they come last within a day here),
    // createdAt, id. Voided rows are included (status "void").
    const rows = await this.prisma.investmentTransaction.findMany({
      where: { investmentId: id },
      orderBy: [
        { effectiveDate: "desc" },
        { effectiveTime: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
        { id: "desc" },
      ],
    });

    return rows.map(toTransactionDto);
  }
}
