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
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CheckAbility } from "../common/decorators/check-ability.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DonationsService } from "./donations.service";
import { DonationResponseDto } from "./dto/donation-response.dto";

import type { AppAbility } from "../casl/casl-ability.factory";
import type { CreateDonationDto } from "./dto/create-donation.dto";
import type { UpdateDonationDto } from "./dto/update-donation.dto";

@ApiTags("donations")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller("family-groups/:familyGroupId/donations")
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

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

  @Post()
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Donation"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Create a donation record" })
  @ApiResponse({ status: 201, type: DonationResponseDto })
  create(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: CreateDonationDto,
  ): Promise<DonationResponseDto> {
    return this.donationsService.create(familyGroupId, dto);
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
  ): Promise<DonationResponseDto> {
    return this.donationsService.update(familyGroupId, id, dto);
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
