import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  InsuranceType,
  type InsuranceStatus,
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
import {
  ACCEPTED_INSURANCE_STATUSES,
  ACCEPTED_PREMIUM_PERIODS,
} from "../next-renewal-date.util";

import { CreateInsuranceBeneficiaryDto } from "./create-insurance-beneficiary.dto";

export class UpdateInsuranceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsTrimmedNotEmpty()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  provider?: string;

  @ApiPropertyOptional({ enum: InsuranceType })
  @IsOptional()
  @IsEnum(InsuranceType)
  type?: InsuranceType;

  @ApiPropertyOptional({ enum: ACCEPTED_INSURANCE_STATUSES })
  @IsOptional()
  @IsIn(ACCEPTED_INSURANCE_STATUSES)
  status?: InsuranceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,15}$/, { message: "coverageAmount must be a numeric string" })
  coverageAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,15}$/, { message: "premiumAmount must be a numeric string" })
  premiumAmount?: string;

  @ApiPropertyOptional({ enum: ACCEPTED_PREMIUM_PERIODS })
  @IsOptional()
  @IsIn(ACCEPTED_PREMIUM_PERIODS)
  premiumPeriod?: PremiumPeriod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  renewalDate?: string;

  @ApiPropertyOptional()
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

  // Hardening audit (validation, MEDIUM) — mirrors create-insurance.dto.ts.
  @ApiPropertyOptional({ type: [CreateInsuranceBeneficiaryDto] })
  @IsOptional()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreateInsuranceBeneficiaryDto)
  beneficiaries?: CreateInsuranceBeneficiaryDto[];

  @FxInputsProperty()
  fxInputs?: FxInputDto[];
}
