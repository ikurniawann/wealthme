import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class DonationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() familyGroupId!: string;
  @ApiProperty() type!: string;
  @ApiProperty() recipient!: string;
  @ApiProperty() amount!: string;
  @ApiProperty() currency!: string;
  @ApiProperty() donatedAt!: string;
  @ApiProperty() isTaxDeductible!: boolean;
  @ApiPropertyOptional() accountId!: string | null;
  @ApiPropertyOptional() transactionId!: string | null;
  @ApiPropertyOptional() receiptUrl!: string | null;
  @ApiPropertyOptional() notes!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}
