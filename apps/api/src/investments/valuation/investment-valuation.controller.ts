import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { CheckAbility } from "../../common/decorators/check-ability.decorator";
import { PageAccess } from "../../common/decorators/page-access.decorator";
import { BalancesVisibleGuard } from "../../common/guards/balances-visible.guard";
import { investmentAccessWhere } from "../investment-access";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PriceRefreshProcessor } from "../price-refresh.processor";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PortfolioValuationQueryDto } from "./dto/portfolio-valuation-query.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PriceBatchDto } from "./dto/price-batch.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { RefreshPricesDto } from "./dto/refresh-prices.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InvestmentPortfolioService } from "./investment-portfolio.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InvestmentValuationService } from "./investment-valuation.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PortfolioHistoryService } from "./portfolio-history.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PriceBatchService } from "./price-batch.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PriceFeedStatusRegistry } from "./price-feed-status.registry";

import type {
  InvestmentPortfolioValuationDto,
  InvestmentPriceBatchResultDto,
} from "@wealthme/contracts";
import type { Request } from "express";

/**
 * Investasi Task 8 — valuation summary and manual price batch. Same base
 * path, page gate and "Lihat saldo" guard as InvestmentsController; the
 * static paths here never collide with its `:id/...` routes.
 */
@ApiTags("investments")
@ApiBearerAuth()
@UseGuards(BalancesVisibleGuard)
@PageAccess("investments")
@Controller("family-groups/:familyGroupId/investments")
export class InvestmentValuationController {
  constructor(
    private readonly portfolio: InvestmentPortfolioService,
    private readonly prices: PriceBatchService,
    private readonly historyService: PortfolioHistoryService,
    private readonly refresh: PriceRefreshProcessor,
    private readonly valuationService: InvestmentValuationService,
    private readonly feed: PriceFeedStatusRegistry,
  ) {}

  @Get("valuation")
  @CheckAbility((ab) => ab.can("read", "Investment"))
  @ApiOperation({
    summary:
      "Portfolio valuation: per-holding value, basis, price age/stale, valuation FX; totals with incomplete flag (R8) and platform cash",
  })
  @ApiResponse({ status: 200, description: "InvestmentPortfolioValuationDto" })
  valuation(
    @Param("familyGroupId") familyGroupId: string,
    @Query() query: PortfolioValuationQueryDto,
    @Req() req: Request,
  ): Promise<InvestmentPortfolioValuationDto> {
    return this.portfolio.summary(familyGroupId, query, {
      member: req.tenantContext?.member ?? null,
      userId: req.tenantContext?.userId,
    });
  }

  @Get("value-history")
  @CheckAbility((ab) => ab.can("read", "Investment"))
  history(
    @Param("familyGroupId") familyGroupId: string,
    @Query() query: PortfolioValuationQueryDto,
  ) {
    return this.historyService.history(familyGroupId, query);
  }

  @Post("prices/preview")
  @HttpCode(HttpStatus.OK)
  @CheckAbility((ab) => ab.can("manage", "Investment"))
  @ApiOperation({
    summary:
      "Preview a manual price batch: per row updated / skipped / failed, old and new value, impact. Writes nothing.",
  })
  @ApiResponse({ status: 200, description: "InvestmentPriceBatchResultDto" })
  preview(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: PriceBatchDto,
    @Req() req: Request,
  ): Promise<InvestmentPriceBatchResultDto> {
    return this.prices.preview(familyGroupId, dto, {
      member: req.tenantContext?.member ?? null,
      userId: req.tenantContext?.userId ?? null,
    });
  }

  @Post("prices/bulk")
  @CheckAbility((ab) => ab.can("manage", "Investment"))
  @ApiOperation({
    summary:
      "Save a manual price batch: writes InvestmentPrice rows for the `updated` rows only — never transactions, cost or cash.",
  })
  @ApiResponse({ status: 201, description: "InvestmentPriceBatchResultDto" })
  bulk(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: PriceBatchDto,
    @Req() req: Request,
  ): Promise<InvestmentPriceBatchResultDto> {
    return this.prices.bulk(familyGroupId, dto, {
      member: req.tenantContext?.member ?? null,
      userId: req.tenantContext?.userId ?? null,
    });
  }

  @Post("prices/refresh")
  @HttpCode(HttpStatus.OK)
  @CheckAbility((ab) => ab.can("manage", "Investment"))
  async refreshPrices(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: RefreshPricesDto,
    @Req() req: Request,
  ) {
    const actor = {
      member: req.tenantContext?.member ?? null,
      userId: req.tenantContext?.userId ?? null,
    };
    const where = {
      AND: [
        { id: { in: dto.investmentIds } },
        investmentAccessWhere(actor, true),
      ],
    };
    const before = await this.valuationService.valueFamily(
      familyGroupId,
      where,
    );
    const ids = before.map((h) => h.row.id);
    await this.refresh.refreshFamily(familyGroupId, ids);
    const after = await this.valuationService.valueFamily(familyGroupId, where);
    return after.map((h) => {
      const previous = before.find((v) => v.row.id === h.row.id)?.valuation
        .price;
      const current = h.valuation.price;
      const feed = this.feed.get(h.row.id);
      const manualOnly =
        !["saham", "kripto"].includes(h.row.type) ||
        (h.row.details !== null &&
          typeof h.row.details === "object" &&
          !Array.isArray(h.row.details) &&
          h.row.details.manualInstrument === true);
      const changed =
        current !== null &&
        (previous?.value !== current.value ||
          previous.asOf !== current.asOf ||
          previous.source !== current.source);
      const status =
        manualOnly || feed?.state === "simulated"
          ? "skipped"
          : feed?.state === "failed" || feed?.state === "no_route"
            ? "failed"
            : changed
              ? "updated"
              : "skipped";
      return { investmentId: h.row.id, valuation: h.valuation, feed, status };
    });
  }
}
