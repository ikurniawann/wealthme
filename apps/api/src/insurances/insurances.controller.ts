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
import { CreateInsuranceDto } from "./dto/create-insurance.dto";
import {
  InsuranceResponseDto,
  type InsuranceSummaryResponseDto,
} from "./dto/insurance-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateInsuranceDto } from "./dto/update-insurance.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InsurancesService } from "./insurances.service";

@ApiTags("insurances")
@ApiBearerAuth()
@Controller("family-groups/:familyGroupId/insurances")
export class InsurancesController {
  constructor(private readonly insurancesService: InsurancesService) {}

  @Get()
  @CheckAbility((ab: AppAbility) => ab.can("read", "Insurance"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "List all insurance policies for a family group" })
  @ApiResponse({ status: 200, type: [InsuranceResponseDto] })
  findAll(
    @Param("familyGroupId") familyGroupId: string,
  ): Promise<InsuranceResponseDto[]> {
    return this.insurancesService.findAll(familyGroupId);
  }

  @Get("summary")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Insurance"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary: "Get active policies count and total monthly premium",
  })
  @ApiResponse({ status: 200, description: "Insurance summary" })
  getSummary(
    @Param("familyGroupId") familyGroupId: string,
  ): Promise<InsuranceSummaryResponseDto> {
    return this.insurancesService.getSummary(familyGroupId);
  }

  @Post()
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Insurance"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Create a new insurance policy" })
  @ApiResponse({ status: 201, type: InsuranceResponseDto })
  create(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: CreateInsuranceDto,
  ): Promise<InsuranceResponseDto> {
    return this.insurancesService.create(familyGroupId, dto);
  }

  @Patch(":id")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Insurance"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Update an insurance policy" })
  @ApiResponse({ status: 200, type: InsuranceResponseDto })
  @ApiResponse({ status: 404, description: "Insurance not found" })
  update(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: UpdateInsuranceDto,
  ): Promise<InsuranceResponseDto> {
    return this.insurancesService.update(familyGroupId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab: AppAbility) => ab.can("manage", "Insurance"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Delete an insurance policy" })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: "Insurance not found" })
  remove(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.insurancesService.remove(familyGroupId, id);
  }
}
