import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { ReferenceItemGroup } from "@prisma/client";

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { PageAccess } from "../common/decorators/page-access.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateReferenceItemDto } from "./dto/create-reference-item.dto";
import { ReferenceItemResponseDto } from "./dto/reference-item-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReferenceItemsService } from "./reference-items.service";

@ApiTags("reference-items")
@ApiBearerAuth()
@PageAccess("reference-items")
@Controller("family-groups/:familyGroupId/reference-items")
export class ReferenceItemsController {
  constructor(private readonly referenceItemsService: ReferenceItemsService) {}

  @Get()
  @CheckAbility((ab: AppAbility) => ab.can("read", "ReferenceItem"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiQuery({ name: "group", enum: ReferenceItemGroup, required: false })
  @ApiOperation({
    summary: "List reference items for a family group, optionally by group",
  })
  @ApiResponse({ status: 200, type: [ReferenceItemResponseDto] })
  findAll(
    @Param("familyGroupId") familyGroupId: string,
    @Query("group") group?: string,
  ): Promise<ReferenceItemResponseDto[]> {
    const parsedGroup = this.parseGroup(group);
    return this.referenceItemsService.findAll(familyGroupId, parsedGroup);
  }

  @Post()
  @HttpCode(201)
  @CheckAbility((ab: AppAbility) => ab.can("create", "ReferenceItem"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Add a reference item to a family group" })
  @ApiResponse({ status: 201, type: ReferenceItemResponseDto })
  @ApiResponse({ status: 409, description: "Label already exists in group" })
  create(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: CreateReferenceItemDto,
  ): Promise<ReferenceItemResponseDto> {
    return this.referenceItemsService.create(
      familyGroupId,
      dto.group,
      dto.label,
    );
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab: AppAbility) => ab.can("delete", "ReferenceItem"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Delete a non-system reference item" })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 403, description: "Item is a seeded system default" })
  @ApiResponse({ status: 404, description: "Reference item not found" })
  remove(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.referenceItemsService.remove(familyGroupId, id);
  }

  private parseGroup(group?: string): ReferenceItemGroup | undefined {
    if (group === undefined) return undefined;
    if (
      !Object.values(ReferenceItemGroup).includes(group as ReferenceItemGroup)
    ) {
      throw new BadRequestException(`Invalid group "${group}"`);
    }
    return group as ReferenceItemGroup;
  }
}
