import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  InsuranceBenefitKind,
  InsuranceBenefitPeriod,
  InsurancePolicyType,
} from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";

import { IsTrimmedNotEmpty } from "../../common/decorators/is-trimmed-not-empty.decorator";
import { IsUserId } from "../../common/decorators/is-user-id.decorator";

/** Decimal money as a string (no float). */
export const DECIMAL_MONEY_RE = /^\d{1,20}(\.\d{1,2})?$/;

export class CreateInsuranceInsuredDto {
  @ApiPropertyOptional()
  @IsString()
  @IsTrimmedNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  relationship?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUserId()
  memberUserId?: string;
}

export class CreateInsuranceBenefitDto {
  @ApiPropertyOptional({ enum: InsuranceBenefitKind })
  @IsEnum(InsuranceBenefitKind)
  kind!: InsuranceBenefitKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  label?: string;

  @ApiPropertyOptional({ description: "Decimal string" })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_MONEY_RE, { message: "amount must be a decimal string" })
  amount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiPropertyOptional({ enum: InsuranceBenefitPeriod })
  @IsOptional()
  @IsEnum(InsuranceBenefitPeriod)
  period?: InsuranceBenefitPeriod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

/**
 * Asuransi rebuild fields (S1–S4, S6, S9) shared by create and update. All
 * optional; `null` clears a nullable field on update. Dates are YYYY-MM-DD.
 */
export class InsuranceRebuildFieldsDto {
  @ApiPropertyOptional({ enum: InsurancePolicyType, nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsEnum(InsurancePolicyType)
  policyType?: InsurancePolicyType | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsDateString()
  nextPremiumDueDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsDateString()
  policyRenewalDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsDateString()
  premiumPaymentEndDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsDateString()
  coverageStartDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsDateString()
  coverageEndDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUserId()
  holderUserId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(150)
  holderName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUserId()
  payerUserId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(150)
  payerName?: string | null;

  @ApiPropertyOptional({ type: [CreateInsuranceInsuredDto] })
  @IsOptional()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CreateInsuranceInsuredDto)
  insured?: CreateInsuranceInsuredDto[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  paymentAccountId?: string | null;

  @ApiPropertyOptional({ type: [CreateInsuranceBenefitDto] })
  @IsOptional()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CreateInsuranceBenefitDto)
  benefits?: CreateInsuranceBenefitDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includeInNetWorth?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: "S9 — family members this policy is explicitly shared with",
  })
  @IsOptional()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(1, 64, { each: true })
  @Matches(/^[A-Za-z0-9_-]+$/, { each: true })
  sharedWithUserIds?: string[];
}
