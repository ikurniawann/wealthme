import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class InsuranceBeneficiaryResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() insuranceId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() relationship!: string;
  @ApiProperty() sharePercent!: string;
  @ApiPropertyOptional() memberUserId!: string | null;
  @ApiProperty() createdAt!: string;
}

export class InsuranceResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() familyGroupId!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() provider!: string | null;
  @ApiProperty() type!: string;
  @ApiProperty() status!: string;
  @ApiPropertyOptional() coverageAmount!: string | null;
  @ApiProperty() premiumAmount!: string;
  @ApiProperty() premiumPeriod!: string;
  @ApiPropertyOptional() renewalDate!: string | null;
  @ApiProperty() autoRenewDate!: boolean;
  @ApiPropertyOptional() policyNumber!: string | null;
  @ApiProperty() daysUntilRenewal!: number | null;
  @ApiPropertyOptional() notes!: string | null;
  @ApiProperty() currency!: string;
  @ApiProperty({ type: [InsuranceBeneficiaryResponseDto] })
  beneficiaries!: InsuranceBeneficiaryResponseDto[];
  @ApiProperty({
    description:
      "EPIC-023 E2 — true when a payment transaction linked to this policy landed within the current calendar-month period",
  })
  paidThisPeriod!: boolean;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class InsuranceSummaryResponseDto {
  @ApiProperty() activePolicies!: number;
  @ApiProperty() totalMonthlyPremium!: string;
  @ApiProperty() currency!: string;
}
