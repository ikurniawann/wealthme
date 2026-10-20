import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

import { IsTrimmedNotEmpty } from "../../common/decorators/is-trimmed-not-empty.decorator";

const DEC_8 = /^\d{1,16}(\.\d{1,8})?$/;
const DEC_4 = /^\d{1,20}(\.\d{1,4})?$/;

/** A policy report is a few pages; this bounds the paid prompt. */
export const MAX_REPORT_PAGES = 30;
export const MAX_REPORT_PAGE_CHARS = 20_000;
/** Second, independent bound on the whole prompt. */
export const MAX_REPORT_TOTAL_CHARS = 120_000;
/** Below this many non-whitespace characters there is nothing to read. */
export const MIN_REPORT_TEXT_CHARS = 80;

export class ReportPageTextDto {
  @ApiProperty({ example: 1, description: "1-based page number in the PDF" })
  @IsInt()
  @Min(1)
  @Max(1000)
  page!: number;

  @ApiProperty({ description: "Text layer of this page (browser-extracted)" })
  @IsString()
  @MaxLength(MAX_REPORT_PAGE_CHARS)
  text!: string;
}

/**
 * Asuransi S8 — the browser extracts the PDF text layer (pdfjs; the file and
 * any password never reach this endpoint) and sends it page by page.
 */
export class PreviewInsuranceReportDto {
  @ApiPropertyOptional({ description: "Policy the report belongs to" })
  @IsOptional()
  @IsUUID()
  insuranceId?: string;

  @ApiPropertyOptional({
    description: "Uploaded InsuranceDocument (same policy)",
  })
  @IsOptional()
  @IsUUID()
  documentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @ApiProperty({ type: [ReportPageTextDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_REPORT_PAGES)
  @ValidateNested({ each: true })
  @Type(() => ReportPageTextDto)
  pages!: ReportPageTextDto[];
}

export class ConfirmInsuranceReportItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  fundId?: string;

  @ApiPropertyOptional({ description: "Create (or reuse by name) a sub-fund" })
  @IsOptional()
  @IsString()
  @IsTrimmedNotEmpty()
  @MaxLength(120)
  newFundName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  newFundCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(DEC_8)
  units?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(DEC_8)
  navPerUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  navDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  unitsDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(DEC_4)
  reportedValue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(DEC_4)
  cashValue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(DEC_4)
  surrenderEstimate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(DEC_4)
  maturityBenefit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  guaranteed?: boolean;

  @ApiProperty({ description: "Effective date of the value (YYYY-MM-DD)" })
  @IsDateString()
  effectiveDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  snippet?: string;
}

export class ConfirmInsuranceReportDto {
  @ApiPropertyOptional({
    description: "The report document the values came from",
  })
  @IsOptional()
  @IsUUID()
  documentId?: string;

  @ApiProperty({ type: [ConfirmInsuranceReportItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ConfirmInsuranceReportItemDto)
  items!: ConfirmInsuranceReportItemDto[];
}

export class UploadInsuranceDocumentDto {
  @ApiPropertyOptional({
    description: "Date printed on the report (YYYY-MM-DD)",
  })
  @IsOptional()
  @IsDateString()
  reportDate?: string;
}
