import { ApiProperty } from "@nestjs/swagger";

export class AssetResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() familyGroupId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() type!: string;
  @ApiProperty() currentValue!: string;
  @ApiProperty() currency!: string;
  @ApiProperty({ nullable: true }) notes!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class AssetHistoryResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() assetId!: string;
  @ApiProperty() value!: string;
  @ApiProperty() recordedAt!: string;
}
