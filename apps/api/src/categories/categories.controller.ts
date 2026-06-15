import { Body, Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CategoriesService } from "./categories.service";
import { CategoryResponseDto } from "./dto/category-response.dto";
import { type CreateCategoryDto } from "./dto/create-category.dto";

@ApiTags("categories")
@ApiBearerAuth()
@Controller("family-groups/:familyGroupId/categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @HttpCode(201)
  @CheckAbility((ab: AppAbility) => ab.can("create", "Category"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Create a category for a family group" })
  @ApiResponse({ status: 201, type: CategoryResponseDto })
  @ApiResponse({ status: 409, description: "Category already exists" })
  create(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.create(familyGroupId, dto);
  }

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
