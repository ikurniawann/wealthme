import { ApiProperty } from "@nestjs/swagger";

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
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class LiabilitySummaryResponseDto {
  @ApiProperty() totalRemainingBalance!: string;
  @ApiProperty() totalDebt!: string;
  @ApiProperty() currency!: string;
}
