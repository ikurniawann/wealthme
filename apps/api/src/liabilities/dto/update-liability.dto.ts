import { ApiPropertyOptional } from "@nestjs/swagger";
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

export class UpdateLiabilityDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsTrimmedNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  institution?: string;

  @ApiPropertyOptional({ enum: LiabilityType })
  @IsOptional()
  @IsEnum(LiabilityType)
  type?: LiabilityType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,15}$/, { message: "totalDebt must be a numeric string" })
  totalDebt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,15}$/, {
    message: "remainingBalance must be a numeric string",
  })
  remainingBalance?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,15}$/, { message: "minimumPayment must be a numeric string" })
  minimumPayment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  // A percentage: 0–100 with at most two decimals. Larger values used to
  // pass and then overflow the decimal column (a 500 instead of a 400).
  @Matches(/^(100(\.0{1,2})?|\d{1,2}(\.\d{1,2})?)$/, {
    message: "interestRate must be a percentage between 0 and 100",
  })
  interestRate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
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

  @ApiPropertyOptional({ enum: InterestMethod })
  @IsOptional()
  @IsEnum(InterestMethod)
  interestMethod?: InterestMethod;

  @ApiPropertyOptional({ minimum: 1, maximum: 600 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  tenorMonths?: number;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: "null clears the Tanggal Akad",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,15}$/, {
    message: "installmentAmount must be a numeric string",
  })
  installmentAmount?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 600 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  fixedRateMonths?: number;

  @ApiPropertyOptional()
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

  @ApiPropertyOptional({
    description:
      "Shared-with-others toggle OFF: hidden from plain members (Owner / Co-Master / admin_staff still see it).",
  })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}
