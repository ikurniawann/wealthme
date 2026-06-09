import { Controller, Get, Param } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { CheckAbility } from "../common/decorators/check-ability.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CategoriesService } from "./categories.service";
import { CategoryResponseDto } from "./dto/category-response.dto";

import type { AppAbility } from "../casl/casl-ability.factory";

@ApiTags("categories")
@ApiBearerAuth()
@Controller("family-groups/:familyGroupId/categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @CheckAbility((ab: AppAbility) => ab.can("read", "Category"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "List all categories for a family group" })
  @ApiResponse({ status: 200, type: [CategoryResponseDto] })
  findAll(
    @Param("familyGroupId") familyGroupId: string,
  ): Promise<CategoryResponseDto[]> {
    return this.categoriesService.findAll(familyGroupId);
  }
}
