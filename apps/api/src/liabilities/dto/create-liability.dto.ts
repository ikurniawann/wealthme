import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { InterestMethod, KprScheme, LiabilityType } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

import { IsTrimmedNotEmpty } from "../../common/decorators/is-trimmed-not-empty.decorator";
import { FxInputsProperty, type FxInputDto } from "../../fx/fx-input.dto";

import { RatePeriodDto } from "./rate-period.dto";

export class CreateLiabilityDto {
  @ApiProperty()
  @IsString()
  @IsTrimmedNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  institution?: string;

  @ApiProperty({ enum: LiabilityType })
  @IsEnum(LiabilityType)
  type!: LiabilityType;

  @ApiProperty({
    description: "Total original debt or credit limit as numeric string",
  })
  @IsString()
  @Matches(/^\d{1,15}$/, { message: "totalDebt must be a numeric string" })
  totalDebt!: string;

  @ApiProperty({ description: "Current remaining balance as numeric string" })
  @IsString()
  @Matches(/^\d{1,15}$/, {
    message: "remainingBalance must be a numeric string",
  })
  remainingBalance!: string;

  @ApiPropertyOptional({
    description: "Minimum monthly payment as numeric string",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,15}$/, { message: "minimumPayment must be a numeric string" })
  minimumPayment?: string;

  @ApiPropertyOptional({
    description: "Annual interest rate as decimal string, e.g. '2.25'",
  })
  @IsOptional()
  @IsString()
  // A percentage: 0–100 with at most two decimals. Larger values used to
  // pass and then overflow the decimal column (a 500 instead of a 400).
  @Matches(/^(100(\.0{1,2})?|\d{1,2}(\.\d{1,2})?)$/, {
    message: "interestRate must be a percentage between 0 and 100",
  })
  interestRate?: string;

  @ApiPropertyOptional({ description: "Next due date as ISO 8601 string" })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({
    description: "Automatically advance dueDate by 1 month once it's passed",
  })
  @IsOptional()
  @IsBoolean()
  autoAdvanceDueDate?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({
    enum: InterestMethod,
    description:
      "Defaults per type on create: kpr→anuitas, kendaraan/pinjaman_pribadi→flat, otherwise efektif",
  })
  @IsOptional()
  @IsEnum(InterestMethod)
  interestMethod?: InterestMethod;

  @ApiPropertyOptional({ minimum: 1, maximum: 600 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  tenorMonths?: number;

  @ApiPropertyOptional({ description: "Loan start (akad) date, ISO 8601" })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description:
      "Monthly installment override as numeric string; computed for flat/anuitas when omitted",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,15}$/, {
    message: "installmentAmount must be a numeric string",
  })
  installmentAmount?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 600,
    description: "KPR fixed-rate period in months",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  fixedRateMonths?: number;

  @ApiPropertyOptional({
    description: "Annual rate after the fixed period, e.g. '11.00'",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: "floatingRate must be a decimal string",
  })
  floatingRate?: string;

  @ApiPropertyOptional({
    enum: KprScheme,
    description: "KPR scheme label (kpr only)",
  })
  @IsOptional()
  @IsEnum(KprScheme)
  kprScheme?: KprScheme;

  @ApiPropertyOptional({
    type: [RatePeriodDto],
    description:
      "Revisi K — ordered rate periods (kpr + anuitas); supersedes fixedRateMonths/floatingRate",
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => RatePeriodDto)
  ratePeriods?: RatePeriodDto[];

  @FxInputsProperty()
  fxInputs?: FxInputDto[];
}
