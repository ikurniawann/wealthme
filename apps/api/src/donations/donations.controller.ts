import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { PageAccess } from "../common/decorators/page-access.decorator";
import { FX_FIELD_SPECS } from "../fx/fx-field-specs";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { FxInputService } from "../fx/fx-input.service";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DonationsService } from "./donations.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateDonationDto } from "./dto/create-donation.dto";
import { DonationResponseDto } from "./dto/donation-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateDonationDto } from "./dto/update-donation.dto";

import type { Request } from "express";

@ApiTags("donations")
@ApiBearerAuth()
@PageAccess("donations")
@Controller("family-groups/:familyGroupId/donations")
export class DonationsController {
  constructor(
    private readonly donationsService: DonationsService,
    private readonly fxInputs: FxInputService,
  ) {}

  @Get()
  @CheckAbility((ab: AppAbility) => ab.can("read", "Donation"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiQuery({ name: "year", required: false, type: Number })
  @ApiOperation({ summary: "List donations for a family group" })
  @ApiResponse({ status: 200, type: [DonationResponseDto] })
  findAll(
    @Param("familyGroupId") familyGroupId: string,
    @Query("year") year?: string,
  ): Promise<DonationResponseDto[]> {
    return this.donationsService.findAll(
      familyGroupId,
      year !== undefined ? parseInt(year, 10) : undefined,
    );
  }

  @Get("deductible-total")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Donation"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiQuery({ name: "year", required: false, type: Number })
  @ApiOperation({
    summary:
      "Total tax-deductible donations (zakat + persepuluhan) for a calendar year",
  })
  async getDeductibleTotal(
    @Param("familyGroupId") familyGroupId: string,
    @Query("year") year?: string,
  ): Promise<{ year: number; total: string }> {
    const resolvedYear =
      year === undefined ? new Date().getFullYear() : Number(year);
    if (
      !Number.isInteger(resolvedYear) ||
      resolvedYear < 2000 ||
      resolvedYear > 2100
    ) {
      throw new BadRequestException(
        "year must be an integer between 2000 and 2100",
      );
    }
    const total = await this.donationsService.getTotalDeductibleAmount(
      familyGroupId,
      resolvedYear,
    );
    return { year: resolvedYear, total: total.toString() };
  }

  @Post()
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Donation"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Create a donation record" })
  @ApiResponse({ status: 201, type: DonationResponseDto })
  create(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: CreateDonationDto,
    @Req() req: Request,
  ): Promise<DonationResponseDto> {
    return this.fxInputs.run(
      {
        familyGroupId,
        userId: req.tenantContext?.userId ?? null,
        entity: "Donation",
        dto,
        spec: FX_FIELD_SPECS.donation,
      },
      (converted) => this.donationsService.create(familyGroupId, converted),
    );
  }

  @Get(":id")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Donation"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Get a single donation" })
  @ApiResponse({ status: 200, type: DonationResponseDto })
  @ApiResponse({ status: 404, description: "Donation not found" })
  findOne(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
  ): Promise<DonationResponseDto> {
    return this.donationsService.findOne(familyGroupId, id);
  }

  @Patch(":id")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Donation"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Update a donation record" })
  @ApiResponse({ status: 200, type: DonationResponseDto })
  @ApiResponse({ status: 404, description: "Donation not found" })
  update(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: UpdateDonationDto,
    @Req() req: Request,
  ): Promise<DonationResponseDto> {
    return this.fxInputs.run(
      {
        familyGroupId,
        userId: req.tenantContext?.userId ?? null,
        entity: "Donation",
        entityId: id,
        dto,
        spec: FX_FIELD_SPECS.donation,
      },
      (converted) => this.donationsService.update(familyGroupId, id, converted),
    );
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Donation"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Delete a donation record" })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: "Donation not found" })
  remove(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.donationsService.remove(familyGroupId, id);
  }
}
