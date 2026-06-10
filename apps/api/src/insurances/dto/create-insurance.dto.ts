import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { InsuranceStatus, InsuranceType, PremiumPeriod } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

export class CreateInsuranceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  provider?: string;

  @ApiProperty({ enum: InsuranceType })
  @IsEnum(InsuranceType)
  type!: InsuranceType;

  @ApiPropertyOptional({ enum: InsuranceStatus })
  @IsOptional()
  @IsEnum(InsuranceStatus)
  status?: InsuranceStatus;

  @ApiPropertyOptional({ description: "Coverage amount as numeric string" })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: "coverageAmount must be a numeric string" })
  coverageAmount?: string;

  @ApiProperty({ description: "Premium amount as numeric string" })
  @IsString()
  @Matches(/^\d+$/, { message: "premiumAmount must be a numeric string" })
  premiumAmount!: string;

  @ApiPropertyOptional({ enum: PremiumPeriod })
  @IsOptional()
  @IsEnum(PremiumPeriod)
  premiumPeriod?: PremiumPeriod;

  @ApiPropertyOptional({ description: "Renewal date as ISO 8601 string" })
  @IsOptional()
  @IsDateString()
  renewalDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  policyNumber?: string;

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
}
