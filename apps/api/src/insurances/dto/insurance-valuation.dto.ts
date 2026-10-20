import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { InsuranceValuationSource } from "@prisma/client";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from "class-validator";

import { IsTrimmedNotEmpty } from "../../common/decorators/is-trimmed-not-empty.decorator";

const DEC_8 = /^\d{1,16}(\.\d{1,8})?$/;
const DEC_4 = /^\d{1,20}(\.\d{1,4})?$/;

export class CreateInsuranceFundDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @ApiProperty()
  @IsString()
  @IsTrimmedNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;
}

export class UpdateInsuranceFundDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsTrimmedNotEmpty()
  @MaxLength(150)
  name?: string;
}

/**
 * S5 — a dated value statement. Decimals are strings. A row is EITHER a
 * reported value OR units + NAV (both required together, unit_link only);
 * cash value / surrender estimate / maturity benefit may accompany either.
 */
export class CreateInsuranceValuationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  fundId?: string;

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

  @ApiPropertyOptional({ enum: InsuranceValuationSource })
  @IsOptional()
  @IsEnum(InsuranceValuationSource)
  source?: InsuranceValuationSource;

  @ApiPropertyOptional({
    enum: ["needs_confirmation", "confirmed"],
    description:
      "Manual entry defaults to confirmed (typed by the user); report rows always start as needs_confirmation.",
  })
  @IsOptional()
  @IsIn(["needs_confirmation", "confirmed"])
  status?: "needs_confirmation" | "confirmed";

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  documentId?: string;

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

export class UpdateInsuranceValuationDto extends PartialType(
  CreateInsuranceValuationDto,
) {}
