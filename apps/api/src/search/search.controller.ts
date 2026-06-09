import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CheckAbility } from "../common/decorators/check-ability.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SearchService } from "./search.service";

@ApiTags("search")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("family-groups/:familyGroupId/search")
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @CheckAbility((ab) => ab.can("read", "Account"))
  @ApiOperation({ summary: "Search accounts, categories, and transactions" })
  search(@Param("familyGroupId") familyGroupId: string, @Query("q") q: string) {
    return this.searchService.search(familyGroupId, q ?? "");
  }
}
