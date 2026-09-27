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
import { PageAccess } from "../common/decorators/page-access.decorator";
import { canSeePrivateItems } from "../common/utils/privacy.util";
import { FX_FIELD_SPECS } from "../fx/fx-field-specs";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { FxInputService } from "../fx/fx-input.service";

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
@PageAccess("budgets")
@Controller("family-groups/:familyGroupId/budgets")
export class BudgetsController {
  constructor(
    private readonly budgets: BudgetsService,
    private readonly fxInputs: FxInputService,
  ) {}

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
    @Req() req: Request,
  ) {
    // EPIC-022 A6 follow-up — a member must not be able to budget a
    // category they cannot see (same role resolution as `findAll`).
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.fxInputs.run(
      {
        familyGroupId,
        userId: req.tenantContext?.userId ?? null,
        entity: "Budget",
        dto,
        spec: FX_FIELD_SPECS.budget,
      },
      (converted) =>
        this.budgets.create(familyGroupId, converted, canSeePrivate),
    );
  }

  @Patch(":id")
  @CheckAbility((ability) => ability.can("manage", "Budget"))
  @ApiOperation({ summary: "Update a budget" })
  @ApiResponse({ status: 200, type: BudgetResponseDto })
  update(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: UpdateBudgetDto,
    @Req() req: Request,
  ) {
    // EPIC-022 A6 follow-up — a member must not be able to PATCH a budget
    // tied to a private category (same role resolution as `findAll`).
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.fxInputs.run(
      {
        familyGroupId,
        userId: req.tenantContext?.userId ?? null,
        entity: "Budget",
        entityId: id,
        dto,
        spec: FX_FIELD_SPECS.budget,
      },
      (converted) =>
        this.budgets.update(familyGroupId, id, converted, canSeePrivate),
    );
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ability) => ability.can("manage", "Budget"))
  @ApiOperation({ summary: "Delete a budget" })
  @ApiResponse({ status: 204 })
  remove(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Req() req: Request,
  ) {
    // EPIC-022 A6 follow-up — same role resolution as `findAll`.
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.budgets.remove(familyGroupId, id, canSeePrivate);
  }
}
