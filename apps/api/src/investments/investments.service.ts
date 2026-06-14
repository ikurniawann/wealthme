import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import { MARKET_DATA_PORT } from "./market-data.port";

import type { CreateInvestmentDto } from "./dto/create-investment.dto";
import type { UpdateInvestmentDto } from "./dto/update-investment.dto";
import type { MarketDataPort } from "./market-data.port";
import type { InvestmentDto, InvestmentSummaryDto } from "@wealthme/contracts";

const ZERO = new Decimal(0);

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function decimalToString(d: Decimal | null): string {
  return d?.toString() ?? "0";
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

        if (!latestPrice || latestPrice.recordedAt < today) {
          const { price, source } = await this.marketData.getPrice(inv.ticker);
          latestPrice = await this.prisma.investmentPrice.create({
            data: {
              investmentId: inv.id,
              price: new Decimal(price),
              source,
            },
          });
        }

        const currentPrice = latestPrice?.price ?? null;
        const quantity = inv.quantity;
        const costBasis = inv.costBasisPerUnit;

        let currentValue: Decimal | null = null;
        let returnRp: Decimal | null = null;
        let returnPct: number | null = null;

        if (currentPrice) {
          currentValue = currentPrice.times(quantity);
          const totalCost = costBasis.times(quantity);
          returnRp = currentValue.minus(totalCost);
          const totalCostNum = totalCost.toNumber();
          returnPct =
            totalCostNum !== 0
              ? (returnRp.toNumber() / totalCostNum) * 100
              : null;
        }

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
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
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
}
