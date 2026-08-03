import { ApiProperty } from "@nestjs/swagger";

export class AssetResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() familyGroupId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() type!: string;
  @ApiProperty() currentValue!: string;
  @ApiProperty() currency!: string;
  @ApiProperty({ nullable: true }) notes!: string | null;
  @ApiProperty({
    nullable: true,
    description:
      "Signed annual value-change rate (%), negative = depreciation, positive = appreciation",
  })
  valueChangeRatePct!: string | null;
  @ApiProperty({
    nullable: true,
    description: "Physical-asset category (master data), same family group",
  })
  categoryId!: string | null;
  @ApiProperty({
    description:
      "Compute-on-read pro-rata estimate of currentValue given valueChangeRatePct and elapsed time since createdAt",
  })
  currentEstimatedValue!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class AssetHistoryResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() assetId!: string;
  @ApiProperty() value!: string;
  @ApiProperty() recordedAt!: string;
}
