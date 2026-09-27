import { ApiPropertyOptional } from "@nestjs/swagger";
import { InsuranceStatus, InsuranceType, PremiumPeriod } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";

import { IsTrimmedNotEmpty } from "../../common/decorators/is-trimmed-not-empty.decorator";
import { FxInputsProperty, type FxInputDto } from "../../fx/fx-input.dto";

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

  @ApiPropertyOptional({ enum: InsuranceStatus })
  @IsOptional()
  @IsEnum(InsuranceStatus)
  status?: InsuranceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: "coverageAmount must be a numeric string" })
  coverageAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: "premiumAmount must be a numeric string" })
  premiumAmount?: string;

  @ApiPropertyOptional({ enum: PremiumPeriod })
  @IsOptional()
  @IsEnum(PremiumPeriod)
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

  @ApiPropertyOptional({ type: [CreateInsuranceBeneficiaryDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateInsuranceBeneficiaryDto)
  beneficiaries?: CreateInsuranceBeneficiaryDto[];

  @FxInputsProperty()
  fxInputs?: FxInputDto[];
}
