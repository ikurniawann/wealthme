import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PlatformAccountsService } from "../../platform-accounts/platform-accounts.service";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InvestmentValuationService } from "./investment-valuation.service";
import { idrPerUnit, isPricedBasis, pct } from "./valuation-core";

import type { PortfolioValuationQueryDto } from "./dto/portfolio-valuation-query.dto";
import type { ValuationFx } from "./valuation-core";
import type { PlatformViewer } from "../../platform-accounts/platform-accounts.service";
import type {
  InvestmentMoneyDto,
  InvestmentPlatformCashDto,
  InvestmentPortfolioTotalsDto,
  InvestmentPortfolioValuationDto,
  InvestmentValuationDto,
  InvestmentValuationFxDto,
  PlatformAccountDto,
} from "@wealthme/contracts";

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;
const ZERO = new D(0);

type MoneyFn = (idr: Decimal) => InvestmentMoneyDto;

function moneyFn(displayRate: Decimal | null): MoneyFn {
  return (idr) => ({
    idr: idr.toDecimalPlaces(2, D.ROUND_HALF_UP).toString(),
    display: displayRate
      ? idr
          .dividedBy(displayRate)
          .toDecimalPlaces(2, D.ROUND_HALF_UP)
          .toString()
      : null,
  });
}

/**
 * Kas platform (R2/R9): visible pockets of the visible platform accounts.
 * Pockets whose balances are hidden from this viewer are counted but never
 * summed. Pockets are Accounts, so this is the same cash net worth counts
 * once through the accounts sum — shown here, never added to net worth again.
 */
function platformCash(
  platforms: PlatformAccountDto[],
  money: MoneyFn,
): InvestmentPlatformCashDto {
  let recorded = ZERO;
  let held = ZERO;
  let pocketCount = 0;
  let hiddenPocketCount = 0;
  let heldIncomplete = false;
  for (const p of platforms) {
    for (const pocket of p.pockets ?? []) {
      pocketCount += 1;
      if (pocket.balancesHidden || pocket.recordedBalance === null) {
        hiddenPocketCount += 1;
        continue;
      }
      recorded = recorded.plus(pocket.recordedBalance);
      held = held.plus(pocket.heldBalance ?? "0");
      heldIncomplete = heldIncomplete || pocket.heldIncomplete;
    }
  }
  return {
    recorded: money(recorded),
    held: money(held),
    available: money(recorded.minus(held)),
    pocketCount,
    hiddenPocketCount,
    heldIncomplete,
  };
}

function totalsOf(
  holdings: InvestmentValuationDto[],
  cash: InvestmentPlatformCashDto,
  money: MoneyFn,
): InvestmentPortfolioTotalsDto {
  let assetValue = ZERO;
  let costRemaining = ZERO;
  let pricedCost = ZERO;
  let unpricedCost = ZERO;
  let realized = ZERO;
  let income = ZERO;
  let netWorth = ZERO;
  const count = { unpriced: 0, failed: 0, stale: 0, cost: 0 };
  for (const v of holdings) {
    const cost = new D(v.costRemainingIdr);
    costRemaining = costRemaining.plus(cost);
    realized = realized.plus(v.realizedIdr ?? "0");
    income = income.plus(v.incomeIdr);
    netWorth = netWorth.plus(v.netWorthIdr);
    if (v.basis === "unpriced") count.unpriced += 1;
    if (v.basis === "failed") count.failed += 1;
    if (v.basis === "stale") count.stale += 1;
    if (v.basis === "cost_basis") count.cost += 1;
    if (isPricedBasis(v.basis) && v.marketValueIdr !== null) {
      assetValue = assetValue.plus(v.marketValueIdr);
      pricedCost = pricedCost.plus(cost);
    } else {
      unpricedCost = unpricedCost.plus(cost);
    }
  }
  const unrealized = assetValue.minus(pricedCost);
  return {
    incomplete: count.unpriced + count.failed > 0,
    unpricedCount: count.unpriced,
    failedCount: count.failed,
    staleCount: count.stale,
    costValuedCount: count.cost,
    holdingCount: holdings.length,
    assetValue: money(assetValue),
    platformCash: cash,
    total: money(assetValue.plus(cash.recorded.idr)),
    costRemaining: money(costRemaining),
    pricedCostRemaining: money(pricedCost),
    unpricedCost: money(unpricedCost),
    unrealized: money(unrealized),
    unrealizedPct: pct(unrealized, pricedCost),
    realized: money(realized),
    income: money(income),
    netWorthValue: money(netWorth),
  };
}

function displayFxDto(
  fx: ValuationFx | null,
  currency: string,
  rate: Decimal | null,
): InvestmentValuationFxDto | null {
  if (currency === "IDR" || !fx || !rate) return null;
  return {
    currency,
    idrPerUnit: rate.toString(),
    rateDate: fx.rateDate,
    source: fx.source,
    stale: fx.stale,
  };
}

/**
 * GET …/investments/valuation — the /investasi page summary: every holding's
 * shared valuation plus totals (R8 `incomplete`), platform cash
 * (recorded / held / available) and an optional display currency.
 */
@Injectable()
export class InvestmentPortfolioService {
  constructor(
    private readonly valuation: InvestmentValuationService,
    private readonly platforms: PlatformAccountsService,
  ) {}

  async summary(
    familyGroupId: string,
    query: PortfolioValuationQueryDto,
    viewer: PlatformViewer,
  ): Promise<InvestmentPortfolioValuationDto> {
    const now = new Date();
    const displayCurrency = query.displayCurrency ?? "IDR";
    const [valued, platformRows, fx] = await Promise.all([
      this.valuation.valueFamily(
        familyGroupId,
        {
          ...(query.ownerUserId ? { ownerUserId: query.ownerUserId } : {}),
          ...(query.platformAccountId
            ? { platformAccountId: query.platformAccountId }
            : {}),
          ...(query.type ? { type: query.type } : {}),
        },
        now,
      ),
      this.platforms.findAll(familyGroupId, viewer),
      displayCurrency === "IDR"
        ? Promise.resolve(null)
        : this.valuation.valuationFx(),
    ]);
    // Market is filtered after valuation: legacy rows (market null) are
    // matched on their effective market.
    const holdings = valued
      .map((v) => v.valuation)
      .filter((v) => !query.market || v.market === query.market);
    const rate =
      displayCurrency === "IDR" ? null : idrPerUnit(fx, displayCurrency);
    const money = moneyFn(rate);
    const visiblePlatforms = platformRows.filter(
      (p) =>
        (!query.platformAccountId || p.id === query.platformAccountId) &&
        (!query.ownerUserId || p.ownerUserId === query.ownerUserId),
    );
    return {
      asOf: now.toISOString(),
      displayCurrency,
      displayFx: displayFxDto(fx, displayCurrency, rate),
      holdings: holdings.map((v) => {
        const convert = (value: string | null) =>
          value === null
            ? null
            : displayCurrency === "IDR"
              ? value
              : money(new D(value)).display;
        return {
          ...v,
          display: {
            currency: displayCurrency,
            marketValue: convert(v.marketValueIdr),
            unrealized: convert(v.unrealizedIdr),
          },
        };
      }),
      totals: totalsOf(holdings, platformCash(visiblePlatforms, money), money),
    };
  }
}
