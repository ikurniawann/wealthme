import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { PageAccess } from "../common/decorators/page-access.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateFloatingRateDto } from "./dto/create-floating-rate.dto";
import { LiabilityFloatingRateResponseDto } from "./dto/liability-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { LiabilityFloatingRatesService } from "./liability-floating-rates.service";

import type { Request } from "express";

@ApiTags("liabilities")
@ApiBearerAuth()
@PageAccess("liabilities")
@Controller("family-groups/:familyGroupId/liabilities/:id/floating-rates")
export class LiabilityFloatingRatesController {
  constructor(private readonly floatingRates: LiabilityFloatingRatesService) {}

  @Get()
  @CheckAbility((ab: AppAbility) => ab.can("read", "Liability"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Recorded KPR floating-rate changes, oldest first" })
  @ApiResponse({ status: 200, type: [LiabilityFloatingRateResponseDto] })
  list(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
  ): Promise<LiabilityFloatingRateResponseDto[]> {
    return this.floatingRates.list(familyGroupId, id);
  }

  @Post()
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Liability"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({
    summary:
      "Record a floating-rate change from a bank notice; the installment re-annuitises from its first whole month",
  })
  @ApiResponse({ status: 201, type: LiabilityFloatingRateResponseDto })
  @ApiResponse({
    status: 400,
    description: "Invalid date/rate or no floating period",
  })
  @ApiResponse({
    status: 409,
    description: "A change on this date already exists",
  })
  add(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: CreateFloatingRateDto,
    @Req() req: Request,
  ): Promise<LiabilityFloatingRateResponseDto> {
    return this.floatingRates.add(
      familyGroupId,
      id,
      dto,
      req.tenantContext?.userId ?? null,
    );
  }

  @Delete(":rateId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Liability"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiParam({ name: "rateId", type: String })
  @ApiOperation({ summary: "Delete a recorded floating-rate change" })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: "Liability or rate not found" })
  remove(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Param("rateId") rateId: string,
  ): Promise<void> {
    return this.floatingRates.remove(familyGroupId, id, rateId);
  }
}
