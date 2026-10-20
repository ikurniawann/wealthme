import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  InsuranceStatus,
  InsuranceType,
  type PremiumPeriod,
} from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";

import { IsTrimmedNotEmpty } from "../../common/decorators/is-trimmed-not-empty.decorator";
import { FxInputsProperty, type FxInputDto } from "../../fx/fx-input.dto";
import { ACCEPTED_PREMIUM_PERIODS } from "../next-renewal-date.util";

import { CreateInsuranceBeneficiaryDto } from "./create-insurance-beneficiary.dto";

export class CreateInsuranceDto {
  @ApiProperty()
  @IsString()
  @IsTrimmedNotEmpty()
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
  @Matches(/^\d{1,15}$/, { message: "coverageAmount must be a numeric string" })
  coverageAmount?: string;

  @ApiProperty({ description: "Premium amount as numeric string" })
  @IsString()
  @Matches(/^\d{1,15}$/, { message: "premiumAmount must be a numeric string" })
  premiumAmount!: string;

  @ApiPropertyOptional({ enum: ACCEPTED_PREMIUM_PERIODS })
  @IsOptional()
  @IsIn(ACCEPTED_PREMIUM_PERIODS)
  premiumPeriod?: PremiumPeriod;

  @ApiPropertyOptional({ description: "Renewal date as ISO 8601 string" })
  @IsOptional()
  @IsDateString()
  renewalDate?: string;

  @ApiPropertyOptional({
    description:
      "Automatically advance renewalDate by premiumPeriod once it's passed",
  })
  @IsOptional()
  @IsBoolean()
  autoRenewDate?: boolean;

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

  // Hardening audit (validation, MEDIUM) — was unbounded; the sum of
  // sharePercent is checked in insurances.service.ts.
  @ApiPropertyOptional({ type: [CreateInsuranceBeneficiaryDto] })
  @IsOptional()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreateInsuranceBeneficiaryDto)
  beneficiaries?: CreateInsuranceBeneficiaryDto[];

  @FxInputsProperty()
  fxInputs?: FxInputDto[];
}
