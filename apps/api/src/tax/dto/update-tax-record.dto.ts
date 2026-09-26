import { ApiPropertyOptional } from "@nestjs/swagger";
import { SptStatus } from "@prisma/client";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from "class-validator";

import { MARITAL, TAX_DIGITS } from "./tax-preview.dto";

export class UpdateTaxRecordDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  taxYear?: number;

  @ApiPropertyOptional({ description: "Gross income as numeric string" })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: "grossIncome must be a numeric string" })
  grossIncome?: string;

  @ApiPropertyOptional({ description: "PTKP amount as numeric string" })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: "ptkp must be a numeric string" })
  ptkp?: string;

  @ApiPropertyOptional({ description: "Net tax as numeric string" })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: "netTax must be a numeric string" })
  netTax?: string;

  @ApiPropertyOptional({ enum: SptStatus })
  @IsOptional()
  @IsEnum(SptStatus)
  sptStatus?: SptStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  documentUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: MARITAL })
  @IsOptional()
  @IsIn(MARITAL)
  maritalStatus?: "TK" | "K" | "KI";

  @ApiPropertyOptional()
  @ValidateIf(
    (o: UpdateTaxRecordDto) =>
      o.maritalStatus !== undefined || o.dependents !== undefined,
  )
  @IsInt()
  @Min(0)
  @Max(3)
  dependents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(TAX_DIGITS, {
    message: "pensionContribution must be a numeric string",
  })
  pensionContribution?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(TAX_DIGITS, { message: "freelanceGross must be a numeric string" })
  freelanceGross?: string;

  @ApiPropertyOptional({ description: "NPPN % in basis points (5000 = 50%)" })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  nppnRateBps?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(TAX_DIGITS, { message: "otherNetIncome must be a numeric string" })
  otherNetIncome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(TAX_DIGITS, { message: "withheldPph21 must be a numeric string" })
  withheldPph21?: string;
}
