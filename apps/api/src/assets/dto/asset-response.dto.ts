import { ApiProperty } from "@nestjs/swagger";
import { AssetValueChangeMode } from "@prisma/client";

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
    enum: AssetValueChangeMode,
    description:
      "EPIC-024 D2/US-ASSET-6: which projection computeEstimatedValue applies — 'percent' reads valueChangeRatePct, 'fixed' reads valueChangeAmount.",
  })
  valueChangeMode!: AssetValueChangeMode;
  @ApiProperty({
    nullable: true,
    description:
      "EPIC-024 D2/US-ASSET-6: signed BigInt Rp/year delta, used only when valueChangeMode is 'fixed'",
  })
  valueChangeAmount!: string | null;
  @ApiProperty({
    nullable: true,
    description: "Physical-asset category (master data), same family group",
  })
  categoryId!: string | null;
  @ApiProperty({
    nullable: true,
    description:
      "Date the asset was acquired (ISO string). Null when not set, in which case createdAt is used as the elapsed-time anchor.",
  })
  acquisitionDate!: string | null;
  @ApiProperty({
    description:
      "Compute-on-read pro-rata estimate of currentValue given valueChangeRatePct and elapsed time since acquisitionDate (or createdAt when acquisitionDate is null)",
  })
  currentEstimatedValue!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class AssetAttachmentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() assetId!: string;
  @ApiProperty() mimeType!: string;
  @ApiProperty() size!: number;
  @ApiProperty() createdAt!: string;
}

export class AssetHistoryResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() assetId!: string;
  @ApiProperty() value!: string;
  @ApiProperty() recordedAt!: string;
  /** EPIC-033 group 3 — change vs the previous entry, percent with 2 decimals; null on the first entry. */
  @ApiProperty({ nullable: true }) changePercent!: string | null;
  @ApiProperty({ nullable: true }) recordedByName!: string | null;
  @ApiProperty({ nullable: true }) note!: string | null;
}
