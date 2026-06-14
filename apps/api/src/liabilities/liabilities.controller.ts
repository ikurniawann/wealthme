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
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";

import { type CreateLiabilityDto } from "./dto/create-liability.dto";
import {
  LiabilityResponseDto,
  type LiabilitySummaryResponseDto,
} from "./dto/liability-response.dto";
import { type UpdateLiabilityDto } from "./dto/update-liability.dto";
import { type LiabilitiesService } from "./liabilities.service";

@ApiTags("liabilities")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller("family-groups/:familyGroupId/liabilities")
export class LiabilitiesController {
  constructor(private readonly liabilitiesService: LiabilitiesService) {}

  @Get()
  @CheckAbility((ab: AppAbility) => ab.can("read", "Liability"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "List all liabilities for a family group" })
  @ApiResponse({ status: 200, type: [LiabilityResponseDto] })
  findAll(
    @Param("familyGroupId") familyGroupId: string,
  ): Promise<LiabilityResponseDto[]> {
    return this.liabilitiesService.findAll(familyGroupId);
  }

  @Get("summary")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Liability"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary: "Get total remaining balance and debt for a family group",
  })
  @ApiResponse({ status: 200, description: "Liability summary" })
  getSummary(
    @Param("familyGroupId") familyGroupId: string,
  ): Promise<LiabilitySummaryResponseDto> {
    return this.liabilitiesService.getSummary(familyGroupId);
  }

  @Post()
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Liability"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Create a new liability" })
  @ApiResponse({ status: 201, type: LiabilityResponseDto })
  create(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: CreateLiabilityDto,
  ): Promise<LiabilityResponseDto> {
    return this.liabilitiesService.create(familyGroupId, dto);
  }

  @Patch(":id")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Liability"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Update a liability" })
  @ApiResponse({ status: 200, type: LiabilityResponseDto })
  @ApiResponse({ status: 404, description: "Liability not found" })
  update(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: UpdateLiabilityDto,
  ): Promise<LiabilityResponseDto> {
    return this.liabilitiesService.update(familyGroupId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Liability"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Delete a liability" })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: "Liability not found" })
  remove(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.liabilitiesService.remove(familyGroupId, id);
  }
}
