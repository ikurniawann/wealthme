import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SplitParticipantResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() splitBillId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() amountOwed!: string;
  @ApiProperty() status!: string;
  @ApiPropertyOptional() paidAt!: string | null;
  @ApiProperty() createdAt!: string;
}

export class SplitBillResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() familyGroupId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() totalAmount!: string;
  @ApiProperty() currency!: string;
  @ApiProperty() shareToken!: string;
  @ApiProperty() status!: string;
  @ApiPropertyOptional() notes!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
  @ApiProperty({ type: [SplitParticipantResponseDto] })
  participants!: SplitParticipantResponseDto[];
}
