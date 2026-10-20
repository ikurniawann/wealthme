import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import type {
  InsuranceBenefitDto,
  InsuranceBenefitGroupDto,
  InsuranceFundDto,
  InsuranceInsuredDto,
  InsurancePaymentDto,
  InsuranceValuationDto,
  InsuranceSummaryDto,
  InsuranceDto,
} from "@wealthme/contracts";

export class InsuranceBeneficiaryResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() insuranceId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() relationship!: string;
  @ApiProperty() sharePercent!: string;
  @ApiPropertyOptional() memberUserId!: string | null;
  @ApiProperty() createdAt!: string;
}

/**
 * Swagger shape of a policy. The authoritative TS shape is the contracts
 * `InsuranceDto`; dates in the S1 block are YYYY-MM-DD.
 */
export class InsuranceResponseDto implements InsuranceDto {
  @ApiProperty() id!: string;
  @ApiProperty() familyGroupId!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() provider!: string | null;
  @ApiProperty() type!: InsuranceDto["type"];
  @ApiProperty() status!: InsuranceDto["status"];
  @ApiPropertyOptional({ description: "LEGACY — mirrors the primary benefit" })
  coverageAmount!: string | null;
  @ApiProperty() premiumAmount!: string;
  @ApiProperty() premiumPeriod!: InsuranceDto["premiumPeriod"];
  @ApiPropertyOptional({ description: "LEGACY overloaded date (S1)" })
  renewalDate!: string | null;
  @ApiProperty() autoRenewDate!: boolean;
  @ApiPropertyOptional() policyNumber!: string | null;
  @ApiProperty({ description: "LEGACY — days until renewalDate" })
  daysUntilRenewal!: number | null;
  @ApiPropertyOptional() notes!: string | null;
  @ApiProperty() currency!: string;
  @ApiProperty({ type: [InsuranceBeneficiaryResponseDto] })
  beneficiaries!: InsuranceBeneficiaryResponseDto[];
  @ApiProperty({
    description:
      "A premium payment covers the current due/period (see premiumDueStatus for the next due)",
  })
  paidThisPeriod!: boolean;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
  @ApiPropertyOptional() policyType!: InsuranceDto["policyType"];
  @ApiPropertyOptional() nextPremiumDueDate!: string | null;
  @ApiPropertyOptional() policyRenewalDate!: string | null;
  @ApiPropertyOptional() premiumPaymentEndDate!: string | null;
  @ApiPropertyOptional() coverageStartDate!: string | null;
  @ApiPropertyOptional() coverageEndDate!: string | null;
  @ApiPropertyOptional({
    description: "Days until nextPremiumDueDate (Asia/Jakarta)",
  })
  daysUntilNextPremium!: number | null;
  @ApiPropertyOptional({ enum: ["scheduled", "overdue"] })
  premiumDueStatus!: InsuranceDto["premiumDueStatus"];
  @ApiPropertyOptional({
    description: "Monthly-equivalent premium — a normalization, not a bill",
  })
  monthlyEquivalentPremium!: string | null;
  @ApiPropertyOptional() holderUserId!: string | null;
  @ApiPropertyOptional() holderName!: string | null;
  @ApiPropertyOptional() payerUserId!: string | null;
  @ApiPropertyOptional() payerName!: string | null;
  @ApiPropertyOptional() insured!: InsuranceInsuredDto[];
  @ApiPropertyOptional() paymentAccountId!: string | null;
  @ApiPropertyOptional() benefits!: InsuranceBenefitDto[];
  @ApiPropertyOptional() funds!: InsuranceFundDto[];
  @ApiPropertyOptional() includeInNetWorth!: boolean;
  @ApiPropertyOptional() sharedWithUserIds!: string[];
}

export class InsurancePayResponseDto extends InsuranceResponseDto {
  @ApiProperty() payment!: InsurancePaymentDto;
  @ApiProperty({
    description:
      "true when an earlier request with the same idempotency key already paid",
  })
  replayed!: boolean;
}

export class InsuranceSummaryResponseDto implements InsuranceSummaryDto {
  @ApiProperty() activePolicies!: number;
  @ApiProperty({
    description:
      "LEGACY — IDR policies' monthly-equivalent premium, rounded once (normalization)",
  })
  totalMonthlyPremium!: string;
  @ApiProperty() currency!: string;
  @ApiPropertyOptional() benefitGroups!: InsuranceBenefitGroupDto[];
  @ApiPropertyOptional() period!: InsuranceSummaryDto["period"];
  @ApiPropertyOptional() timeZone!: string;
  @ApiPropertyOptional() premiumDue!: InsuranceSummaryDto["premiumDue"];
  @ApiPropertyOptional() overdue!: InsuranceSummaryDto["overdue"];
  @ApiPropertyOptional()
  monthlyPremiumNormalized!: InsuranceSummaryDto["monthlyPremiumNormalized"];
  @ApiPropertyOptional()
  confirmedValues!: InsuranceSummaryDto["confirmedValues"];
  @ApiPropertyOptional() netWorthValueIdr!: string;
}

export type { InsuranceValuationDto, InsurancePaymentDto };
