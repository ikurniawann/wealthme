import { Controller, Get, Param, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

import { CheckAbility } from "../common/decorators/check-ability.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SearchService } from "./search.service";

import type { Request } from "express";

@ApiTags("search")
@ApiBearerAuth()
@UseGuards(ThrottlerGuard)
@Throttle({ default: { ttl: 60000, limit: 60 } })
@Controller("family-groups/:familyGroupId/search")
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @CheckAbility((ab) => ab.can("read", "Account"))
  @ApiOperation({ summary: "Search accounts, categories, and transactions" })
  search(
    @Param("familyGroupId") familyGroupId: string,
    @Query("q") q: string,
    @Req() req: Request,
  ) {
    return this.searchService.search(
      familyGroupId,
      q ?? "",
      req.tenantContext?.member?.role ?? null,
      req.tenantContext?.userId,
    );
  }
}
