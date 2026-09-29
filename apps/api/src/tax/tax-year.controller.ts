import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";
import { type Response } from "express";

import { type AppAbility } from "../casl/casl-ability.factory";
import { CheckAbility } from "../common/decorators/check-ability.decorator";
import { PageAccess } from "../common/decorators/page-access.decorator";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TaxYearQueryDto } from "./dto/final-income.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UmkmYearPutDto } from "./dto/tax-preview.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TaxExportService } from "./tax-export.service";
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
    private readonly taxExportService: TaxExportService,
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

  // Hardening batch G2 — "Unduh Ringkasan" used to only toast "belum
  // tersedia". Real CSV/PDF exports of the same annual summary.
  @Get("summary/csv")
  @CheckAbility((ab: AppAbility) => ab.can("read", "TaxRecord"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Download the annual tax summary as CSV" })
  async summaryCsv(
    @Param("familyGroupId") familyGroupId: string,
    @Query() { year }: TaxYearQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.taxExportService.csv(familyGroupId, year);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="ringkasan-pajak-${year}.csv"`,
    );
    res.send(csv);
  }

  @Get("summary/pdf")
  @CheckAbility((ab: AppAbility) => ab.can("read", "TaxRecord"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiOperation({ summary: "Download the annual tax summary as PDF" })
  async summaryPdf(
    @Param("familyGroupId") familyGroupId: string,
    @Query() { year }: TaxYearQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const pdfBytes = await this.taxExportService.pdf(familyGroupId, year);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="ringkasan-pajak-${year}.pdf"`,
    );
    res.send(Buffer.from(pdfBytes));
  }
}
