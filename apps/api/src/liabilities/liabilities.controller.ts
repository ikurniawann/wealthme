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

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateLiabilityDto } from "./dto/create-liability.dto";
import {
  LiabilityResponseDto,
  type LiabilitySummaryResponseDto,
} from "./dto/liability-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PayLiabilityDto } from "./dto/pay-liability.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateLiabilityDto } from "./dto/update-liability.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { LiabilitiesService } from "./liabilities.service";

@ApiTags("liabilities")
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

  @Post(":id/pay")
  @HttpCode(HttpStatus.OK)
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Liability"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({
    summary:
      "Record a payment against a liability, splitting principal and interest",
  })
  @ApiResponse({ status: 200, type: LiabilityResponseDto })
  @ApiResponse({ status: 404, description: "Liability or account not found" })
  @ApiResponse({
    status: 400,
    description: "Invalid amount or amount exceeds what is owed",
  })
  pay(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: PayLiabilityDto,
  ): Promise<LiabilityResponseDto> {
    return this.liabilitiesService.pay(familyGroupId, id, dto);
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
