import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class TaxRecordResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() familyGroupId!: string;
  @ApiProperty() taxYear!: number;
  @ApiProperty() grossIncome!: string;
  @ApiProperty() ptkp!: string;
  @ApiProperty() zakatDeduction!: string;
  @ApiProperty() netTax!: string;
  @ApiProperty() sptStatus!: string;
  @ApiPropertyOptional() documentUrl!: string | null;
  @ApiPropertyOptional() notes!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}
