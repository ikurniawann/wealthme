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

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateTaxRecordDto } from "./dto/create-tax-record.dto";
import { TaxRecordResponseDto } from "./dto/tax-record-response.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateTaxRecordDto } from "./dto/update-tax-record.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TaxService } from "./tax.service";

@ApiTags("tax")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller("family-groups/:familyGroupId/tax")
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  @Get()
  @CheckAbility((ab: AppAbility) => ab.can("read", "TaxRecord"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "List all tax records for a family group" })
  @ApiResponse({ status: 200, type: [TaxRecordResponseDto] })
  findAll(
    @Param("familyGroupId") familyGroupId: string,
  ): Promise<TaxRecordResponseDto[]> {
    return this.taxService.findAll(familyGroupId);
  }

  @Post()
  @CheckAbility((ab: AppAbility) => ab.can("manage", "TaxRecord"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Create or upsert a tax record by taxYear" })
  @ApiResponse({ status: 201, type: TaxRecordResponseDto })
  upsert(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: CreateTaxRecordDto,
  ): Promise<TaxRecordResponseDto> {
    return this.taxService.upsertByYear(familyGroupId, dto);
  }

  @Get(":id")
  @CheckAbility((ab: AppAbility) => ab.can("read", "TaxRecord"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Get a single tax record" })
  @ApiResponse({ status: 200, type: TaxRecordResponseDto })
  @ApiResponse({ status: 404, description: "Tax record not found" })
  findOne(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
  ): Promise<TaxRecordResponseDto> {
    return this.taxService.findOne(familyGroupId, id);
  }

  @Patch(":id")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "TaxRecord"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({
    summary: "Update a tax record (sptStatus, netTax, zakatDeduction, etc.)",
  })
  @ApiResponse({ status: 200, type: TaxRecordResponseDto })
  @ApiResponse({ status: 404, description: "Tax record not found" })
  update(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: UpdateTaxRecordDto,
  ): Promise<TaxRecordResponseDto> {
    return this.taxService.update(familyGroupId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility((ab: AppAbility) => ab.can("manage", "TaxRecord"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({ summary: "Delete a tax record" })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: "Tax record not found" })
  remove(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.taxService.remove(familyGroupId, id);
  }
}
