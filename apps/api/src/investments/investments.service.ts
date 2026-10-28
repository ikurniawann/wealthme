import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";

import { runSerializableWithRetry } from "../common/utils/serializable-retry.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import { deriveInternalCode } from "./internal-code.util";
import { investmentAccessWhere } from "./investment-access";
import {
  decimalToString,
  toTransactionDto,
} from "./investment-transaction.mapper";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InvestmentLedgerService } from "./ledger/investment-ledger.service";
import { cashKeyParts } from "./ledger/ledger-dates";
import { isAutomatedPriceType } from "./market-data.port";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InvestmentValuationService } from "./valuation/investment-valuation.service";
import { DEPOSIT_ACCRUAL_SOURCE } from "./valuation/valuation-core";

import type { CreateInvestmentTransactionDto } from "./dto/create-investment-transaction.dto";
import type { CreateInvestmentDto } from "./dto/create-investment.dto";
import type { SetManualPriceDto } from "./dto/set-manual-price.dto";
import type { UpdateInvestmentDto } from "./dto/update-investment.dto";
import type { LedgerActor } from "./ledger/investment-ledger.service";
import type {
  Prisma,
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
  | "isPrivate"
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
    isPrivate: inv.isPrivate,
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
    private readonly ledger: InvestmentLedgerService,
    private readonly valuation: InvestmentValuationService,
  ) {}

  /**
   * Investasi Task 8 — the holdings list, valued by the shared
   * InvestmentValuationService (the same formula as net worth and reports).
   * A GET never fetches or stores a price any more: prices change only via
   * the refresh job and manual entry. The legacy flat fields are derived
   * from `valuation`: `currentValue` is the IDR market value, null when the
   * holding is unpriced (R8 — never 0); `currentPrice` is IDR per unit.
   */
  async findAll(
    familyGroupId: string,
    where: Prisma.InvestmentWhereInput = {},
  ): Promise<InvestmentDto[]> {
    const valued = await this.valuation.valueFamily(familyGroupId, where);
    return valued.map(({ row: inv, valuation: v }) => {
      const currentValue = v.marketValueIdr
        ? new Decimal(v.marketValueIdr)
        : null;
      const currentPrice =
        currentValue && !inv.quantity.isZero()
          ? currentValue.dividedBy(inv.quantity)
          : null;
      const projectedAnnualYield = computeProjectedAnnualYield(
        currentValue,
        inv.interestRatePct,
      );
      const isDeposit = v.method === "deposit_accrual";
      const priceAt = isDeposit
        ? new Date().toISOString()
        : (v.price?.asOf ?? null);
      return {
        id: inv.id,
        familyGroupId: inv.familyGroupId,
        ticker: inv.ticker,
        name: inv.name,
        type: inv.type,
        quantity: decimalToString(inv.quantity),
        costBasisPerUnit: decimalToString(inv.costBasisPerUnit),
        currentPrice: currentPrice ? decimalToString(currentPrice) : null,
        currentValue: currentValue ? decimalToString(currentValue) : null,
        returnRp: v.unrealizedIdr,
        returnPct: v.unrealizedPct,
        currency: inv.currency,
        notes: inv.notes,
        latestPriceRecordedAt: priceAt,
        latestPriceSource: isDeposit
          ? DEPOSIT_ACCRUAL_SOURCE
          : (v.price?.source ?? null),
        latestPriceAsOf: priceAt,
        latestPriceDelayed: isDeposit ? false : (v.price?.delayed ?? null),
        priceRefreshFailed: v.feedStatus === "failed",
        automatedPriceUnmapped: v.feedStatus === "no_route",
        automatedPriceSimulated: v.feedStatus === "simulated",
        interestRatePct: inv.interestRatePct?.toString() ?? null,
        projectedAnnualYield: projectedAnnualYield
          ? decimalToString(projectedAnnualYield)
          : null,
        purchasedAt: inv.purchasedAt?.toISOString() ?? null,
        maturityDate: inv.maturityDate?.toISOString() ?? null,
        realizedPnlRp: v.realizedIdr,
        ...holdingRebuildFields(inv),
        valuation: v,
        createdAt: inv.createdAt.toISOString(),
        updatedAt: inv.updatedAt.toISOString(),
      } satisfies InvestmentDto;
    });
  }

  /**
   * Legacy summary, on the net-worth basis: unpriced holdings count at cost
   * (R8, as before). The /investasi page uses GET …/valuation instead,
   * which separates them and flags the total incomplete.
   */
  async getSummary(
    familyGroupId: string,
    where: Prisma.InvestmentWhereInput = {},
  ): Promise<InvestmentSummaryDto> {
    const valued = await this.valuation.valueFamily(familyGroupId, where);

    let totalCostBasis = ZERO;
    let totalCurrentValue = ZERO;
    for (const { valuation: v } of valued) {
      totalCostBasis = totalCostBasis.plus(v.costRemainingIdr ?? "0");
      totalCurrentValue = totalCurrentValue.plus(v.netWorthIdr);
    }

    const costIncomplete = valued.some(
      (v) => v.valuation.costRemainingIdr === null,
    );
    const totalReturnRp = totalCurrentValue.minus(totalCostBasis);
    const totalReturnPct =
      totalCostBasis.isZero() || costIncomplete
        ? null
        : totalReturnRp
            .dividedBy(totalCostBasis)
            .times(100)
            .toDecimalPlaces(2)
            .toNumber();

    // todayReturn not tracked separately (requires yesterday's snapshot) — return null instead of 0
    return {
      totalCostBasis: decimalToString(totalCostBasis),
      costIncomplete,
      totalCurrentValue: decimalToString(totalCurrentValue),
      totalReturnRp: costIncomplete ? null : decimalToString(totalReturnRp),
      totalReturnPct,
      todayReturnRp: null,
      todayReturnPct: null,
    };
  }

  async create(
    familyGroupId: string,
    dto: CreateInvestmentDto,
    actor: LedgerActor = { userId: null, member: null },
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
        ownerUserId: actor.member?.userId ?? null,
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
    const existing = await this.prisma.investment.findFirst({
      where: { id, familyGroupId, AND: [investmentAccessWhere(actor, true)] },
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

    if (
      (dto.type !== undefined && dto.type !== existing.type) ||
      (dto.currency !== undefined && dto.currency !== existing.currency)
    )
      throw new BadRequestException(
        "Jenis dan mata uang kepemilikan tidak dapat ditafsir ulang melalui formulir lama.",
      );
    const positionChanged =
      dto.quantity !== undefined || dto.costBasisPerUnit !== undefined;
    const updated = await runSerializableWithRetry(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "investments" WHERE "id" = ${id} AND "familyGroupId" = ${familyGroupId} FOR UPDATE`;
      if (
        !(await tx.investment.findFirst({
          where: {
            id,
            familyGroupId,
            AND: [investmentAccessWhere(actor, true)],
          },
        }))
      )
        throw new NotFoundException("Investment not found");
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
  async remove(
    familyGroupId: string,
    id: string,
    actor: LedgerActor = { userId: null, member: null },
  ): Promise<void> {
    await runSerializableWithRetry(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "investments" WHERE "id" = ${id} AND "familyGroupId" = ${familyGroupId} FOR UPDATE`;
      const existing = await tx.investment.findFirst({
        where: { id, familyGroupId, AND: [investmentAccessWhere(actor, true)] },
      });
      if (!existing) throw new NotFoundException("Investment not found");
      const txCount = await tx.investmentTransaction.count({
        where: { investmentId: id, kind: { not: "opening" }, status: "active" },
      });
      const docs = await tx.investmentAttachment.count({
        where: { investmentId: id, familyGroupId },
      });
      if (txCount > 0 || docs > 0)
        throw new ConflictException(
          "Tidak dapat menghapus investasi dengan riwayat aktif atau dokumen; koreksi melalui riwayat dan periksa dokumennya.",
        );
      await tx.investment.delete({ where: { id, familyGroupId } });
      if (actor.userId)
        await tx.auditLog.create({
          data: {
            userId: actor.userId,
            familyGroupId,
            entity: "Investment",
            entityId: id,
            action: "delete",
            before: {
              name: existing.name,
              quantity: existing.quantity.toString(),
              costBasisPerUnit: existing.costBasisPerUnit.toString(),
            },
          },
        });
    });
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
    actor: LedgerActor = { userId: null, member: null },
  ): Promise<InvestmentPriceDto> {
    // Hardening audit (validation, HIGH) — `@IsNumberString()` accepts
    // "-15250"; this used to be persisted unchecked via `new Decimal(...)`,
    // corrupting the holding's valuation.
    this.assertValidManualPrice(dto.price);
    const existing = await this.prisma.investment.findFirst({
      where: { id, familyGroupId, AND: [investmentAccessWhere(actor, true)] },
    });
    if (!existing) {
      throw new NotFoundException("Investment not found");
    }

    const asOf = dto.asOf ? new Date(dto.asOf) : new Date();
    if (asOf > new Date())
      throw new BadRequestException("Tanggal harga tidak boleh di masa depan.");
    if (existing.type === "deposito")
      throw new BadRequestException(
        "Deposito memakai metode pokok dan bunga berjalan.",
      );
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
    if (actor.userId && !dto.idempotencyKey)
      throw new BadRequestException(
        "Kunci transaksi wajib diisi untuk mencegah pencatatan ganda.",
      );
    const replay = dto.idempotencyKey
      ? await this.prisma.investmentTransaction.findUnique({
          where: {
            familyGroupId_idempotencyKey: {
              familyGroupId,
              idempotencyKey: dto.idempotencyKey,
            },
          },
        })
      : null;
    const occurredAt = dto.occurredAt
      ? new Date(dto.occurredAt)
      : (replay?.occurredAt ?? new Date());
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
      // Legacy form: any non-property cash account (a bank account too).
      { strictPocket: false },
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
    actor: LedgerActor = { userId: null, member: null },
  ): Promise<InvestmentPriceDto[]> {
    const existing = await this.prisma.investment.findFirst({
      where: { id, familyGroupId, AND: [investmentAccessWhere(actor, false)] },
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
    actor: LedgerActor = { userId: null, member: null },
  ): Promise<InvestmentTransactionDto[]> {
    const existing = await this.prisma.investment.findFirst({
      where: { id, familyGroupId, AND: [investmentAccessWhere(actor, false)] },
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

    return rows.map((row) => ({
      ...toTransactionDto(row),
      costBasisKnown:
        (existing.details as InvestmentDto["details"])?.costBasisKnown !==
        false,
      realizedPnl:
        (existing.details as InvestmentDto["details"])?.costBasisKnown === false
          ? null
          : (row.realizedPnl?.toString() ?? null),
    }));
  }
}
