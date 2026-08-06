import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SplitParticipantResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() splitBillId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() amountOwed!: string;
  @ApiProperty() status!: string;
  // EPIC-023 F3 (D21) — this participant's own share link identifier, only
  // ever exposed here (the AUTHENTICATED owner view) — never on the public
  // participant DTO, and never any other participant's token.
  @ApiProperty() shareToken!: string;
  @ApiPropertyOptional() claimedAt!: string | null;
  @ApiPropertyOptional() paidAt!: string | null;
  @ApiProperty() createdAt!: string;
}

export class SplitBillResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() familyGroupId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() totalAmount!: string;
  @ApiProperty() currency!: string;
  @ApiProperty() status!: string;
  @ApiPropertyOptional() notes!: string | null;
  @ApiPropertyOptional() payoutAccountId!: string | null;
  @ApiPropertyOptional() payoutInstructions!: string | null;
  @ApiPropertyOptional() revokedAt!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
  @ApiProperty({ type: [SplitParticipantResponseDto] })
  participants!: SplitParticipantResponseDto[];
}
