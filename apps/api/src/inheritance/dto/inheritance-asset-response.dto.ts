import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class InheritanceHeirResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() inheritanceAssetId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() relationship!: string;
  @ApiProperty() sharePercent!: string;
  @ApiPropertyOptional() memberUserId!: string | null;
  @ApiProperty() createdAt!: string;
}

export class InheritanceAssetResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() familyGroupId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() assetType!: string;
  @ApiProperty() estimatedValue!: string;
  @ApiProperty() currency!: string;
  @ApiPropertyOptional() notes!: string | null;
  @ApiProperty() visibility!: string;
  @ApiPropertyOptional() documentUrl!: string | null;
  @ApiPropertyOptional() assetId!: string | null;
  @ApiProperty({ type: [InheritanceHeirResponseDto] })
  heirs!: InheritanceHeirResponseDto[];
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}
