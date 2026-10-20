import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  OmitType,
} from "@nestjs/swagger";
import {
  ASSET_TRANSACTION_KINDS,
  FX_CURRENCY_CODES,
} from "@wealthme/contracts";
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";

import type {
  AssetTransactionKind,
  AssetValuationInput,
  CreateAssetTransactionInput,
  UpdateAssetTransactionInput,
  UpdateAssetValuationInput,
  VoidAssetEventInput,
} from "@wealthme/contracts";

/** Non-negative decimal, ≤ 16 integer digits and ≤ 8 decimals (Decimal(24,8)). */
const DECIMAL = /^\d{1,16}(\.\d{1,8})?$/;
const RATE = /^\d{1,17}(\.\d{1,8})?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** POST .../assets/:id/transactions — buy / sell / opening (A5). */
export class CreateAssetTransactionDto implements CreateAssetTransactionInput {
  @ApiProperty({ enum: ASSET_TRANSACTION_KINDS })
  @IsIn(ASSET_TRANSACTION_KINDS)
  kind!: AssetTransactionKind;

  @ApiProperty({ description: "uuid generated when the form opens (R7)" })
  @IsUUID()
  idempotencyKey!: string;

  @ApiProperty({ example: "10", description: "In the asset's unit" })
  @Matches(DECIMAL)
  quantity!: string;

  @ApiPropertyOptional({ example: "1000000" })
  @IsOptional()
  @Matches(DECIMAL)
  pricePerUnit?: string;

  @ApiPropertyOptional({ description: "Default quantity × pricePerUnit" })
  @IsOptional()
  @Matches(DECIMAL)
  grossAmount?: string;

  @ApiPropertyOptional({ example: "0" })
  @IsOptional()
  @Matches(DECIMAL)
  fee?: string;

  @ApiPropertyOptional({ example: "0" })
  @IsOptional()
  @Matches(DECIMAL)
  tax?: string;

  @ApiProperty({ enum: FX_CURRENCY_CODES, example: "IDR" })
  @IsIn(FX_CURRENCY_CODES)
  currency!: string;

  @ApiPropertyOptional({
    description: "IDR per 1 unit of currency",
    nullable: true,
  })
  @IsOptional()
  @Matches(RATE)
  fxRate?: string | null;

  @ApiPropertyOptional({
    description: "Opening only: false when the cost is unknown",
  })
  @IsOptional()
  @IsBoolean()
  costBasisKnown?: boolean;

  @ApiProperty({ example: "2026-10-20" })
  @Matches(DATE)
  effectiveDate!: string;

  @ApiPropertyOptional({ example: "09:30", nullable: true })
  @IsOptional()
  @Matches(TIME)
  effectiveTime?: string | null;

  @ApiPropertyOptional({ example: "Asia/Jakarta", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timeZone?: string | null;

  @ApiPropertyOptional({
    description: "Paying (buy) / receiving (sell) account; none for opening",
    nullable: true,
  })
  @IsOptional()
  @IsString()
  cashAccountId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

export class UpdateAssetTransactionDto
  extends PartialType(
    OmitType(CreateAssetTransactionDto, ["kind", "idempotencyKey"] as const),
  )
  implements UpdateAssetTransactionInput
{
  @ApiPropertyOptional({ description: "Why it was corrected (audit)" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}

/** POST .../assets/:id/valuations (and /preview) — Update Nilai (§11). */
export class AssetValuationDto implements AssetValuationInput {
  @ApiPropertyOptional({
    description: "uuid per form open (R7); required on save",
  })
  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;

  @ApiPropertyOptional({ example: "1100000", description: "per_unit model" })
  @IsOptional()
  @Matches(DECIMAL)
  pricePerUnit?: string;

  @ApiPropertyOptional({ example: "3250000000", description: "total model" })
  @IsOptional()
  @Matches(DECIMAL)
  value?: string;

  @ApiProperty({ enum: FX_CURRENCY_CODES, example: "IDR" })
  @IsIn(FX_CURRENCY_CODES)
  currency!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Matches(RATE)
  fxRate?: string | null;

  @ApiProperty({ example: "2026-10-20" })
  @Matches(DATE)
  effectiveDate!: string;

  @ApiPropertyOptional({ example: "14:05", nullable: true })
  @IsOptional()
  @Matches(TIME)
  effectiveTime?: string | null;

  @ApiPropertyOptional({ example: "Asia/Jakarta", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timeZone?: string | null;

  @ApiProperty({
    example: "Harga Antam",
    description: "Who/what supplied the value",
  })
  @IsString()
  @MaxLength(100)
  source!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reference?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

export class UpdateAssetValuationDto
  extends PartialType(OmitType(AssetValuationDto, ["idempotencyKey"] as const))
  implements UpdateAssetValuationInput
{
  @ApiPropertyOptional({ description: "Why it was corrected (audit)" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}

export class VoidAssetEventDto implements VoidAssetEventInput {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}
