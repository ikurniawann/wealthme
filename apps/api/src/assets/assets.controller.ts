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
import { AssetsService } from "./assets.service";
import { CreateAssetDto } from "./dto/create-asset.dto";
import { UpdateAssetDto } from "./dto/update-asset.dto";
/* eslint-enable @typescript-eslint/consistent-type-imports */

import type {
  AssetHistoryResponseDto,
  AssetResponseDto,
} from "./dto/asset-response.dto";

@ApiTags("assets")
@ApiBearerAuth()
@PageAccess("assets")
@Controller("family-groups/:familyGroupId/assets")
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @CheckAbility((ab) => ab.can("read", "Asset"))
  @ApiOperation({ summary: "List all assets for a family group" })
  @ApiResponse({ status: 200, description: "Array of assets" })
  findAll(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
  ): Promise<AssetResponseDto[]> {
    return this.assetsService.findAll(req.params.familyGroupId);
  }

  @Post()
  @CheckAbility((ab) => ab.can("manage", "Asset"))
  @ApiOperation({ summary: "Create a new asset" })
  @ApiResponse({ status: 201, description: "Created asset" })
  create(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Body() dto: CreateAssetDto,
  ): Promise<AssetResponseDto> {
    return this.assetsService.create(req.params.familyGroupId, dto);
  }

  @Patch(":id")
  @CheckAbility((ab) => ab.can("manage", "Asset"))
  @ApiOperation({ summary: "Update an asset" })
  @ApiResponse({ status: 200, description: "Updated asset" })
  update(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Param("id") id: string,
    @Body() dto: UpdateAssetDto,
  ): Promise<AssetResponseDto> {
    return this.assetsService.update(req.params.familyGroupId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab) => ab.can("manage", "Asset"))
  @ApiOperation({ summary: "Delete an asset" })
  @ApiResponse({ status: 204 })
  remove(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Param("id") id: string,
  ): Promise<void> {
    return this.assetsService.remove(req.params.familyGroupId, id);
  }

  @Get(":id/history")
  @CheckAbility((ab) => ab.can("read", "Asset"))
  @ApiOperation({ summary: "Get value history for an asset" })
  @ApiResponse({ status: 200, description: "Array of asset history records" })
  findHistory(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Param("id") id: string,
  ): Promise<AssetHistoryResponseDto[]> {
    return this.assetsService.findHistory(req.params.familyGroupId, id);
  }
}
