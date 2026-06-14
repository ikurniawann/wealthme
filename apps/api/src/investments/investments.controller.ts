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
  type InvestmentSummaryDto,
} from "@wealthme/contracts";
import { type Request as ExpressRequest } from "express";

import { CheckAbility } from "../common/decorators/check-ability.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateInvestmentDto } from "./dto/create-investment.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateInvestmentDto } from "./dto/update-investment.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InvestmentsService } from "./investments.service";

@ApiTags("investments")
@ApiBearerAuth()
@Controller("family-groups/:familyGroupId/investments")
export class InvestmentsController {
  constructor(private readonly investmentsService: InvestmentsService) {}

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
    return this.investmentsService.create(req.params.familyGroupId, dto);
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
    return this.investmentsService.update(req.params.familyGroupId, id, dto);
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
}
