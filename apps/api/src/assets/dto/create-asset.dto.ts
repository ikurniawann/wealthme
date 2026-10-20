import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  AssetType,
  AssetValuationModel,
  AssetValueChangeMode,
} from "@prisma/client";
import { ASSET_CREATE_VALUATION_SOURCES } from "@wealthme/contracts";
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";

import { IsTrimmedNotEmpty } from "../../common/decorators/is-trimmed-not-empty.decorator";
import { FxInputsProperty, type FxInputDto } from "../../fx/fx-input.dto";

export class CreateAssetDto {
  @ApiProperty()
  @IsString()
  @IsTrimmedNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: AssetType })
  @IsEnum(AssetType)
  type!: AssetType;

  @ApiProperty({
    description: "BigInt value as numeric string, e.g. '200000000'",
  })
  @IsString()
  @Matches(/^\d{1,15}$/, { message: "currentValue must be a numeric string" })
  currentValue!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({
    description:
      "Signed annual value-change rate (%), negative = depreciation, positive = appreciation, e.g. '-5.00'. Must be between -100 and 100.",
  })
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d{1,2})?$/, {
    message: "valueChangeRatePct must be a decimal string, e.g. '-5.00'",
  })
  valueChangeRatePct?: string;

  @ApiPropertyOptional({
    enum: AssetValueChangeMode,
    description:
      "EPIC-024 D2/US-ASSET-6: which projection computeEstimatedValue applies — 'percent' reads valueChangeRatePct (default), 'fixed' reads valueChangeAmount.",
  })
  @IsOptional()
  @IsEnum(AssetValueChangeMode)
  valueChangeMode?: AssetValueChangeMode;

  @ApiPropertyOptional({
    description:
      "EPIC-024 D2/US-ASSET-6: signed BigInt Rp/year delta used only when valueChangeMode is 'fixed', negative = depreciation, positive = appreciation, e.g. '-5000000'.",
  })
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+$/, {
    message:
      "valueChangeAmount must be a signed integer string, e.g. '-5000000'",
  })
  valueChangeAmount?: string;

  @ApiPropertyOptional({
    description:
      "Optional physical-asset category (master data Category), same family group",
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description:
      "Date the asset was acquired (ISO date string), used as the elapsed-time anchor for currentEstimatedValue instead of createdAt. Falls back to createdAt when omitted.",
  })
  @IsOptional()
  @IsDateString()
  acquisitionDate?: string;

  // Aset Task 18 — identity fields used by Update Nilai / Edit informasi.
  // Quantity is owned by the transaction ledger and is not editable here.
  @ApiPropertyOptional({ example: "gram", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  unit?: string | null;

  @ApiPropertyOptional({ enum: AssetValuationModel })
  @IsOptional()
  @IsEnum(AssetValuationModel)
  valuationModel?: AssetValuationModel;

  // Required (> 0) when valuationModel is per_unit: it becomes the opening
  // transaction's quantity. Ignored for total-valued assets.
  @ApiPropertyOptional({ example: "10", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  quantity?: string | null;

  @ApiPropertyOptional({ example: "EMAS-01", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  internalCode?: string | null;

  @ApiPropertyOptional({ example: "Safe deposit box BCA", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  custodian?: string | null;

  // Aset fields (2026-10-20) — Pemilik. A member's userId; null or omitted
  // = Bersama (family). A row-scoped member may only record for themselves
  // (AssetsService resolves and checks it).
  @ApiPropertyOptional({ nullable: true, format: "uuid" })
  @IsOptional()
  @IsUUID()
  ownerUserId?: string | null;

  // Harga perolehan in IDR digits (or fxInputs field "acquisitionCost").
  // Written as the opening transaction's cost basis; never a valuation.
  @ApiPropertyOptional({ example: "1500000000" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,15}$/, {
    message: "acquisitionCost must be a numeric string",
  })
  acquisitionCost?: string;

  // Opening valuation's calendar date (yyyy-mm-dd, floating date-only).
  @ApiPropertyOptional({ example: "2026-10-20" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "valuationDate must be yyyy-mm-dd",
  })
  valuationDate?: string;

  @ApiPropertyOptional({ enum: ASSET_CREATE_VALUATION_SOURCES })
  @IsOptional()
  @IsIn(ASSET_CREATE_VALUATION_SOURCES)
  valuationSource?: (typeof ASSET_CREATE_VALUATION_SOURCES)[number];

  // Per-category specifications; validated against the contracts schema for
  // `type` by AssetsService (unknown keys and bad formats are a 400).
  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  details?: Record<string, unknown> | null;

  @FxInputsProperty()
  fxInputs?: FxInputDto[];
}
