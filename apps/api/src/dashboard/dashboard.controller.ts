import { Controller, Get, Param, Query, Req } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  type DashboardSummaryDto,
  type NetWorthDto,
  type NetWorthHistoryDto,
} from "@wealthme/contracts";

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { canSeePrivateItems } from "../common/utils/privacy.util";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DashboardService } from "./dashboard.service";

import type { Request } from "express";

@ApiTags("dashboard")
@ApiBearerAuth()
@Controller("family-groups/:familyGroupId/dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Account"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Get dashboard aggregation summary" })
  @ApiResponse({ status: 200, description: "Dashboard summary data" })
  getSummary(
    @Param("familyGroupId") familyGroupId: string,
    @Req() req: Request,
  ): Promise<DashboardSummaryDto> {
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.dashboardService.getSummary(familyGroupId, canSeePrivate);
  }

  @Get("net-worth")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Account"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Get net-worth rollup for a family group" })
  @ApiResponse({ status: 200, description: "Net-worth breakdown by category" })
  getNetWorth(
    @Param("familyGroupId") familyGroupId: string,
    @Req() req: Request,
  ): Promise<NetWorthDto> {
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.dashboardService.getNetWorth(familyGroupId, canSeePrivate);
  }

  @Get("net-worth/history")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Account"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiQuery({ name: "range", required: false, example: "30d" })
  @ApiOperation({ summary: "Get persisted net-worth history (wealth trend)" })
  @ApiResponse({ status: 200, description: "Net-worth snapshots over time" })
  getNetWorthHistory(
    @Param("familyGroupId") familyGroupId: string,
    @Query("range") range?: string,
  ): Promise<NetWorthHistoryDto> {
    return this.dashboardService.getNetWorthHistory(familyGroupId, range);
  }
}
