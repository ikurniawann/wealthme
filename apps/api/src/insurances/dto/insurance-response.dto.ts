import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

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
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class InsuranceSummaryResponseDto {
  @ApiProperty() activePolicies!: number;
  @ApiProperty() totalMonthlyPremium!: string;
  @ApiProperty() currency!: string;
}
