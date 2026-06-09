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
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { CheckAbility } from "../common/decorators/check-ability.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { BudgetsService } from "./budgets.service";
import { BudgetResponseDto } from "./dto/budget-response.dto";

import type { CreateBudgetDto } from "./dto/create-budget.dto";
import type { UpdateBudgetDto } from "./dto/update-budget.dto";

@ApiTags("budgets")
@ApiBearerAuth()
@Controller("family-groups/:familyGroupId/budgets")
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Get()
  @CheckAbility((ability) => ability.can("read", "Budget"))
  @ApiOperation({ summary: "List all budgets for a family group" })
  @ApiResponse({ status: 200, type: [BudgetResponseDto] })
  findAll(@Param("familyGroupId") familyGroupId: string) {
    return this.budgets.findAll(familyGroupId);
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
