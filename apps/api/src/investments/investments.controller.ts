import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  type InvestmentDto,
  type InvestmentPriceDto,
  type InvestmentSummaryDto,
  type InvestmentTransactionDto,
} from "@wealthme/contracts";
import { type Request as ExpressRequest } from "express";

import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { PageAccess } from "../common/decorators/page-access.decorator";
import { FX_FIELD_SPECS } from "../fx/fx-field-specs";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { FxInputService } from "../fx/fx-input.service";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateInvestmentTransactionDto } from "./dto/create-investment-transaction.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateInvestmentDto } from "./dto/create-investment.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SetManualPriceDto } from "./dto/set-manual-price.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateInvestmentDto } from "./dto/update-investment.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InvestmentsService } from "./investments.service";

@ApiTags("investments")
@ApiBearerAuth()
@PageAccess("investments")
@Controller("family-groups/:familyGroupId/investments")
export class InvestmentsController {
  constructor(
    private readonly investmentsService: InvestmentsService,
    private readonly fxInputs: FxInputService,
  ) {}

  @Get()
  @CheckAbility((ab) => ab.can("read", "Investment"))
  @ApiOperation({ summary: "List all investments for a family group" })
  @ApiResponse({ status: 200, description: "Array of investment holdings" })
  findAll(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
  ): Promise<InvestmentDto[]> {
    return this.investmentsService.findAll(req.params.familyGroupId);
  }

  @Get("summary")
  @CheckAbility((ab) => ab.can("read", "Investment"))
  @ApiOperation({ summary: "Get investment summary (P&L) for a family group" })
  @ApiResponse({ status: 200, description: "Investment summary" })
  getSummary(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
  ): Promise<InvestmentSummaryDto> {
    return this.investmentsService.getSummary(req.params.familyGroupId);
  }

  @Post()
  @CheckAbility((ab) => ab.can("manage", "Investment"))
  @ApiOperation({ summary: "Create a new investment holding" })
  @ApiResponse({ status: 201, description: "Created investment" })
  create(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Body() dto: CreateInvestmentDto,
  ): Promise<InvestmentDto> {
    return this.fxInputs.run(
      {
        familyGroupId: req.params.familyGroupId,
        userId: req.tenantContext?.userId ?? null,
        entity: "Investment",
        dto,
        spec: FX_FIELD_SPECS.investment,
      },
      (converted) =>
        this.investmentsService.create(req.params.familyGroupId, converted),
    );
  }

  @Patch(":id")
  @CheckAbility((ab) => ab.can("manage", "Investment"))
  @ApiOperation({ summary: "Update an investment holding" })
  @ApiResponse({ status: 200, description: "Updated investment" })
  update(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Param("id") id: string,
    @Body() dto: UpdateInvestmentDto,
  ): Promise<InvestmentDto> {
    return this.fxInputs.run(
      {
        familyGroupId: req.params.familyGroupId,
        userId: req.tenantContext?.userId ?? null,
        entity: "Investment",
        entityId: id,
        dto,
        spec: FX_FIELD_SPECS.investment,
      },
      (converted) =>
        this.investmentsService.update(req.params.familyGroupId, id, converted),
    );
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab) => ab.can("manage", "Investment"))
  @ApiOperation({ summary: "Delete an investment holding" })
  @ApiResponse({ status: 204 })
  remove(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Param("id") id: string,
  ): Promise<void> {
    return this.investmentsService.remove(req.params.familyGroupId, id);
  }

  @Post(":id/price")
  @CheckAbility((ab) => ab.can("manage", "Investment"))
  @ApiOperation({
    summary:
      "Manually record a current price (the only pricing path for manual-only instrument types)",
  })
  @ApiResponse({ status: 201, description: "Created InvestmentPrice" })
  setManualPrice(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Param("id") id: string,
    @Body() dto: SetManualPriceDto,
  ): Promise<InvestmentPriceDto> {
    return this.fxInputs.run(
      {
        familyGroupId: req.params.familyGroupId,
        userId: req.tenantContext?.userId ?? null,
        entity: "Investment",
        entityId: id,
        fieldPrefix: "price",
        dto,
        spec: FX_FIELD_SPECS.investmentPrice,
      },
      (converted) =>
        this.investmentsService.setManualPrice(
          req.params.familyGroupId,
          id,
          converted,
        ),
    );
  }

  @Post(":id/transactions")
  @CheckAbility((ab) => ab.can("manage", "Investment"))
  @ApiOperation({
    summary:
      "Record a buy or sell against a holding (EPIC-022 D2) — replaces the old silent quantity/costBasisPerUnit overwrite with a real, append-only history",
  })
  @ApiResponse({ status: 201, description: "Created InvestmentTransaction" })
  recordTransaction(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Param("id") id: string,
    @Body() dto: CreateInvestmentTransactionDto,
  ): Promise<InvestmentTransactionDto> {
    return this.fxInputs.run(
      {
        familyGroupId: req.params.familyGroupId,
        userId: req.tenantContext?.userId ?? null,
        entity: "Investment",
        entityId: id,
        fieldPrefix: "trade",
        dto,
        spec: FX_FIELD_SPECS.investmentTrade,
      },
      (converted) =>
        this.investmentsService.recordTransaction(
          req.params.familyGroupId,
          id,
          converted,
        ),
    );
  }

  @Get(":id/prices")
  @CheckAbility((ab) => ab.can("read", "Investment"))
  @ApiOperation({ summary: "Price history for one holding (EPIC-033 p18)" })
  findPrices(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Param("id") id: string,
  ): Promise<InvestmentPriceDto[]> {
    return this.investmentsService.findPrices(req.params.familyGroupId, id);
  }

  @Get(":id/transactions")
  @CheckAbility((ab) => ab.can("read", "Investment"))
  @ApiOperation({ summary: "List the buy/sell history for one holding" })
  @ApiResponse({ status: 200, description: "Array of InvestmentTransaction" })
  findTransactions(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Param("id") id: string,
  ): Promise<InvestmentTransactionDto[]> {
    return this.investmentsService.findTransactions(
      req.params.familyGroupId,
      id,
    );
  }
}
