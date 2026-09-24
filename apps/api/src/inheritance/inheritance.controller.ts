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
import { PageAccess } from "../common/decorators/page-access.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateInheritanceAssetDto } from "./dto/create-inheritance-asset.dto";
import { InheritanceAssetResponseDto } from "./dto/inheritance-asset-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateInheritanceAssetDto } from "./dto/update-inheritance-asset.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InheritanceService } from "./inheritance.service";

@ApiTags("inheritance")
@ApiBearerAuth()
@PageAccess("inheritance")
@Controller("family-groups/:familyGroupId/inheritance")
export class InheritanceController {
  constructor(private readonly inheritanceService: InheritanceService) {}

  @Get()
  @CheckAbility((ab: AppAbility) => ab.can("read", "Inheritance"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "List all inheritance assets for a family group" })
  @ApiResponse({ status: 200, type: [InheritanceAssetResponseDto] })
  findAll(
    @Param("familyGroupId") familyGroupId: string,
  ): Promise<InheritanceAssetResponseDto[]> {
    return this.inheritanceService.findAll(familyGroupId);
  }

  @Post()
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Inheritance"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Create a new inheritance asset" })
  @ApiResponse({ status: 201, type: InheritanceAssetResponseDto })
  create(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: CreateInheritanceAssetDto,
  ): Promise<InheritanceAssetResponseDto> {
    return this.inheritanceService.create(familyGroupId, dto);
  }

  @Get(":id")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Inheritance"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Get a single inheritance asset" })
  @ApiResponse({ status: 200, type: InheritanceAssetResponseDto })
  @ApiResponse({ status: 404, description: "Inheritance asset not found" })
  findOne(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
  ): Promise<InheritanceAssetResponseDto> {
    return this.inheritanceService.findOne(familyGroupId, id);
  }

  @Patch(":id")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Inheritance"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Update an inheritance asset" })
  @ApiResponse({ status: 200, type: InheritanceAssetResponseDto })
  @ApiResponse({ status: 404, description: "Inheritance asset not found" })
  update(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: UpdateInheritanceAssetDto,
  ): Promise<InheritanceAssetResponseDto> {
    return this.inheritanceService.update(familyGroupId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Inheritance"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Delete an inheritance asset" })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: "Inheritance asset not found" })
  remove(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.inheritanceService.remove(familyGroupId, id);
  }
}
