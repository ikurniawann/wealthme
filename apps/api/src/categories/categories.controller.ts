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
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { canSeePrivateItems } from "../common/utils/privacy.util";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CategoriesService } from "./categories.service";
import { CategoryResponseDto } from "./dto/category-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateCategoryDto } from "./dto/create-category.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateCategoryDto } from "./dto/update-category.dto";

import type { Request } from "express";

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
    @Req() req: Request,
  ): Promise<CategoryResponseDto[]> {
    const canSeePrivate = canSeePrivateItems(req.tenantContext?.member?.role);
    return this.categoriesService.findAll(familyGroupId, canSeePrivate);
  }

  @Patch(":id")
  @CheckAbility((ab: AppAbility) => ab.can("update", "Category"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Update a category for a family group" })
  @ApiResponse({ status: 200, type: CategoryResponseDto })
  @ApiResponse({ status: 404, description: "Category not found" })
  update(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.update(familyGroupId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab: AppAbility) => ab.can("delete", "Category"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Delete a category for a family group" })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: "Category not found" })
  remove(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.categoriesService.remove(familyGroupId, id);
  }
}
