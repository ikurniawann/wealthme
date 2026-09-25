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
import { type Request as ExpressRequest } from "express";

import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { PageAccess } from "../common/decorators/page-access.decorator";

/* eslint-disable @typescript-eslint/consistent-type-imports */
import { CreateGoalContributionDto } from "./dto/create-goal-contribution.dto";
import { CreateGoalDto } from "./dto/create-goal.dto";
import { UpdateGoalDto } from "./dto/update-goal.dto";
import { GoalsService, GoalDto } from "./goals.service";
/* eslint-enable @typescript-eslint/consistent-type-imports */

import type {
  GoalContributionDto,
  GoalContributionResult,
} from "@wealthme/contracts";

@ApiTags("goals")
@ApiBearerAuth()
@PageAccess("goals")
@Controller("family-groups/:familyGroupId/goals")
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get()
  @CheckAbility((ab) => ab.can("read", "Goal"))
  @ApiOperation({ summary: "List all goals for a family group" })
  @ApiResponse({ status: 200, description: "Array of goals" })
  findAll(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
  ): Promise<GoalDto[]> {
    return this.goalsService.findAll(req.params.familyGroupId);
  }

  @Post()
  @CheckAbility((ab) => ab.can("manage", "Goal"))
  @ApiOperation({ summary: "Create a new goal" })
  @ApiResponse({ status: 201, description: "Created goal" })
  create(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Body() dto: CreateGoalDto,
  ): Promise<GoalDto> {
    return this.goalsService.create(req.params.familyGroupId, dto);
  }

  @Patch(":id")
  @CheckAbility((ab) => ab.can("manage", "Goal"))
  @ApiOperation({ summary: "Update a goal" })
  @ApiResponse({ status: 200, description: "Updated goal" })
  update(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Param("id") id: string,
    @Body() dto: UpdateGoalDto,
  ): Promise<GoalDto> {
    return this.goalsService.update(req.params.familyGroupId, id, dto);
  }

  @Get(":id/contributions")
  @CheckAbility((ab) => ab.can("read", "Goal"))
  @ApiOperation({ summary: "List a goal's contributions, newest first" })
  @ApiResponse({ status: 200, description: "Array of contributions" })
  listContributions(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Param("id") id: string,
  ): Promise<GoalContributionDto[]> {
    return this.goalsService.listContributions(req.params.familyGroupId, id);
  }

  @Post(":id/contributions")
  @CheckAbility((ab) => ab.can("update", "Goal"))
  @ApiOperation({
    summary: "Pay into a goal, optionally debiting a source account",
  })
  @ApiResponse({
    status: 201,
    description: "The contribution and the updated goal",
  })
  contribute(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Param("id") id: string,
    @Body() dto: CreateGoalContributionDto,
  ): Promise<GoalContributionResult> {
    return this.goalsService.contribute(req.params.familyGroupId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab) => ab.can("manage", "Goal"))
  @ApiOperation({ summary: "Delete a goal" })
  @ApiResponse({ status: 204 })
  remove(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Param("id") id: string,
  ): Promise<void> {
    return this.goalsService.remove(req.params.familyGroupId, id);
  }
}
