import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { PageAccess } from "../common/decorators/page-access.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TaxYearQueryDto } from "./dto/final-income.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UmkmYearPutDto } from "./dto/tax-preview.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TaxSummaryService } from "./tax-summary.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UmkmYearService } from "./umkm-year.service";

import type { TaxAnnualSummaryDto, UmkmResultDto } from "@wealthme/contracts";

class TaxYearParamDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;
}

@ApiTags("tax")
@ApiBearerAuth()
@PageAccess("tax")
@Controller("family-groups/:familyGroupId/tax")
export class TaxYearController {
  constructor(
    private readonly umkmYearService: UmkmYearService,
    private readonly taxSummaryService: TaxSummaryService,
  ) {}

  @Get("umkm/:year")
  @CheckAbility((ab: AppAbility) => ab.can("read", "TaxRecord"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Get the saved UMKM omzet/tax for a tax year" })
  get(
    @Param("familyGroupId") familyGroupId: string,
    @Param() { year }: TaxYearParamDto,
  ): Promise<UmkmResultDto | null> {
    return this.umkmYearService.get(familyGroupId, year);
  }

  @Put("umkm/:year")
  @HttpCode(HttpStatus.OK)
  @CheckAbility((ab: AppAbility) => ab.can("manage", "TaxRecord"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Save monthly UMKM omzet for a tax year" })
  put(
    @Param("familyGroupId") familyGroupId: string,
    @Param() { year }: TaxYearParamDto,
    @Body() dto: UmkmYearPutDto,
  ): Promise<UmkmResultDto> {
    return this.umkmYearService.put(familyGroupId, year, dto);
  }

  @Get("summary")
  @CheckAbility((ab: AppAbility) => ab.can("read", "TaxRecord"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({
    summary: "Annual PPh OP + final tax + UMKM + SPT timing summary",
  })
  summary(
    @Param("familyGroupId") familyGroupId: string,
    @Query() { year }: TaxYearQueryDto,
  ): Promise<TaxAnnualSummaryDto> {
    return this.taxSummaryService.summary(familyGroupId, year);
  }
}
