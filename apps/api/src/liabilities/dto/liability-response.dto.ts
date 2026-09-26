import { ApiProperty } from "@nestjs/swagger";

export class LiabilityRatePeriodResponseDto {
  @ApiProperty({ enum: ["fixed", "floating"] }) kind!: "fixed" | "floating";
  @ApiProperty({ nullable: true, type: Number }) months!: number | null;
  @ApiProperty() ratePercent!: string;
}

export class LiabilityResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() familyGroupId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) institution!: string | null;
  @ApiProperty() type!: string;
  @ApiProperty() totalDebt!: string;
  @ApiProperty() remainingBalance!: string;
  @ApiProperty() minimumPayment!: string;
  @ApiProperty() interestRate!: string;
  @ApiProperty({ nullable: true }) dueDate!: string | null;
  @ApiProperty() autoAdvanceDueDate!: boolean;
  @ApiProperty() paymentRatio!: number;
  @ApiProperty({
    description:
      "EPIC-023 E2 — true when a payment transaction linked to this liability landed within the current calendar-month period",
  })
  paidThisPeriod!: boolean;
  @ApiProperty({ nullable: true }) notes!: string | null;
  @ApiProperty() currency!: string;
  @ApiProperty({ enum: ["efektif", "flat", "anuitas"] })
  interestMethod!: string;
  @ApiProperty({ nullable: true, type: Number }) tenorMonths!: number | null;
  @ApiProperty({ nullable: true, type: String }) startDate!: string | null;
  @ApiProperty({ nullable: true, type: String })
  installmentAmount!: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description:
      "Installment due now; past a KPR's fixed period it is re-amortised at the floating rate",
  })
  currentInstallmentAmount!: string | null;
  @ApiProperty({ nullable: true, type: Number })
  fixedRateMonths!: number | null;
  @ApiProperty({ nullable: true, type: String }) floatingRate!: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    enum: [
      "konvensional",
      "berjenjang",
      "flpp",
      "syariah_murabahah",
      "syariah_mmq",
    ],
  })
  kprScheme!: string | null;
  @ApiProperty({ type: [LiabilityRatePeriodResponseDto] })
  ratePeriods!: LiabilityRatePeriodResponseDto[];
  @ApiProperty({ description: "Annual rate the next installment accrues at" })
  currentRatePercent!: string;
  @ApiProperty({
    description:
      "The installment now due is past its due day (inside the 5-day grace window) or the loan is past maturity",
  })
  currentInstallmentLate!: boolean;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class LiabilitySummaryResponseDto {
  @ApiProperty() totalRemainingBalance!: string;
  @ApiProperty() totalDebt!: string;
  @ApiProperty() currency!: string;
}

export class LiabilityScheduleRowDto {
  @ApiProperty() period!: number;
  @ApiProperty() installment!: string;
  @ApiProperty() interest!: string;
  @ApiProperty() principal!: string;
  @ApiProperty() remaining!: string;
}

export class LiabilityRateBandDto {
  @ApiProperty() fromPeriod!: number;
  @ApiProperty() toPeriod!: number;
  @ApiProperty() ratePercent!: string;
  @ApiProperty({ enum: ["fixed", "floating"] }) kind!: "fixed" | "floating";
}

export class LiabilityScheduleResponseDto {
  @ApiProperty() liabilityId!: string;
  @ApiProperty({ enum: ["efektif", "flat", "anuitas"] })
  interestMethod!: string;
  @ApiProperty({ nullable: true, type: String })
  installmentAmount!: string | null;
  @ApiProperty({ type: [LiabilityScheduleRowDto] })
  rows!: LiabilityScheduleRowDto[];
  @ApiProperty({
    type: [LiabilityRateBandDto],
    description:
      "Consecutive rows sharing one rate; floating bands are estimates",
  })
  rateBands!: LiabilityRateBandDto[];
  @ApiProperty() hasFloatingPeriod!: boolean;
}

export class LiabilityPaymentPreviewResponseDto {
  @ApiProperty() liabilityId!: string;
  @ApiProperty() amount!: string;
  @ApiProperty() interest!: string;
  @ApiProperty() principal!: string;
  @ApiProperty() remainingAfter!: string;
}

export class LiabilityFloatingRateResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ description: "YYYY-MM-DD" }) effectiveDate!: string;
  @ApiProperty() ratePercent!: string;
  @ApiProperty({
    nullable: true,
    type: Number,
    description: "First installment accruing at this rate",
  })
  effectivePeriod!: number | null;
  @ApiProperty({ nullable: true, type: String }) note!: string | null;
  @ApiProperty() createdAt!: string;
}

export class LiabilityPrepaymentPreviewResponseDto {
  @ApiProperty() liabilityId!: string;
  @ApiProperty({ enum: ["full", "reduce_tenor", "reduce_installment"] })
  mode!: "full" | "reduce_tenor" | "reduce_installment";
  @ApiProperty() prepaidPrincipal!: string;
  @ApiProperty() penaltyPercent!: string;
  @ApiProperty() penalty!: string;
  @ApiProperty() cashOutNow!: string;
  @ApiProperty({ nullable: true, type: String })
  installmentBefore!: string | null;
  @ApiProperty({ nullable: true, type: String })
  installmentAfter!: string | null;
  @ApiProperty() remainingMonthsBefore!: number;
  @ApiProperty() remainingMonthsAfter!: number;
  @ApiProperty() totalInterestBefore!: string;
  @ApiProperty() totalInterestAfter!: string;
  @ApiProperty() interestSaved!: string;
  @ApiProperty({
    description: "May be negative (penalty above interest saved)",
  })
  netSaving!: string;
  @ApiProperty({
    description:
      "True when the projection runs into a floating period (today's floating rate assumed to persist)",
  })
  assumesCurrentFloatingRate!: boolean;
}
