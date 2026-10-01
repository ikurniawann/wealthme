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
import { PageAccess } from "../common/decorators/page-access.decorator";
import {
  assertBalancesVisible,
  redactDashboardSummary,
  redactNetWorth,
} from "../common/utils/balance-visibility.util";
import {
  assertHouseholdWideReadAllowed,
  canSeePrivateItems,
} from "../common/utils/privacy.util";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DashboardService } from "./dashboard.service";

import type { Request } from "express";

@ApiTags("dashboard")
@ApiBearerAuth()
@PageAccess("dashboard")
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
    const member = req.tenantContext?.member ?? null;
    return this.dashboardService
      .getSummary(
        familyGroupId,
        canSeePrivate,
        member,
        req.tenantContext?.userId,
      )
      .then((dto) => redactDashboardSummary(dto, member));
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
    const member = req.tenantContext?.member ?? null;
    return this.dashboardService
      .getNetWorth(
        familyGroupId,
        canSeePrivate,
        member,
        req.tenantContext?.userId,
      )
      .then((dto) => redactNetWorth(dto, member));
  }

  @Get("net-worth/history")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Account"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiQuery({ name: "range", required: false, example: "30d" })
  @ApiOperation({ summary: "Get persisted net-worth history (wealth trend)" })
  @ApiResponse({ status: 200, description: "Net-worth snapshots over time" })
  getNetWorthHistory(
    @Param("familyGroupId") familyGroupId: string,
    @Req() req: Request,
    @Query("range") range?: string,
  ): Promise<NetWorthHistoryDto> {
    // EPIC-023 Task C — snapshots are pre-aggregated family-wide totals with
    // no per-viewer dimension (see DashboardService.captureSnapshot); a
    // dependant/operational cannot be scoped to "their own" history without
    // a new snapshot dimension this task does not add, so this endpoint is
    // denied outright rather than leaking the household's wealth trend.
    assertHouseholdWideReadAllowed(req.tenantContext?.member);
    assertBalancesVisible(req.tenantContext?.member);
    return this.dashboardService.getNetWorthHistory(familyGroupId, range);
  }
}
