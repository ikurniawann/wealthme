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
  Req,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { canSeePrivateItems } from "../common/utils/privacy.util";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { BudgetsService } from "./budgets.service";
import { BudgetResponseDto } from "./dto/budget-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateBudgetDto } from "./dto/create-budget.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateBudgetDto } from "./dto/update-budget.dto";

import type { Request } from "express";

@ApiTags("budgets")
@ApiBearerAuth()
@Controller("family-groups/:familyGroupId/budgets")
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Get()
  @CheckAbility((ability) => ability.can("read", "Budget"))
  @ApiOperation({ summary: "List all budgets for a family group" })
  @ApiResponse({ status: 200, type: [BudgetResponseDto] })
  findAll(@Param("familyGroupId") familyGroupId: string, @Req() req: Request) {
    // EPIC-022 A6 — a plain `member` has `manage Budget` but must not see a
    // private category's budget or its spend; every other shared read
    // (transactions, dashboard, categories) already resolves this from the
    // caller's role the same way.
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.budgets.findAll(familyGroupId, canSeePrivate);
  }

  @Post()
  @CheckAbility((ability) => ability.can("manage", "Budget"))
  @ApiOperation({ summary: "Create a budget for a category" })
  @ApiResponse({ status: 201, type: BudgetResponseDto })
  create(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: CreateBudgetDto,
  ) {
    return this.budgets.create(familyGroupId, dto);
  }

  @Patch(":id")
  @CheckAbility((ability) => ability.can("manage", "Budget"))
  @ApiOperation({ summary: "Update a budget" })
  @ApiResponse({ status: 200, type: BudgetResponseDto })
  update(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: UpdateBudgetDto,
  ) {
    return this.budgets.update(familyGroupId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ability) => ability.can("manage", "Budget"))
  @ApiOperation({ summary: "Delete a budget" })
  @ApiResponse({ status: 204 })
  remove(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
  ) {
    return this.budgets.remove(familyGroupId, id);
  }
}
