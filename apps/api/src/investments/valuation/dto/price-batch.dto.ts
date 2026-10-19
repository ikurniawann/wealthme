import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { FX_CURRENCY_CODES, MANUAL_PRICE_SOURCES } from "@wealthme/contracts";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";

import type {
  InvestmentPriceBatchInput,
  InvestmentPriceBatchRowInput,
  ManualPriceSource,
} from "@wealthme/contracts";

/** Max rows per preview/bulk request. */
export const PRICE_BATCH_MAX_ROWS = 500;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * One manual price row. `price` is validated in the service so an empty or
 * malformed price becomes a per-row skipped/failed status in the preview
 * instead of rejecting the whole batch.
 */
export class PriceBatchRowDto implements InvestmentPriceBatchRowInput {
  @ApiProperty()
  @IsUUID()
  investmentId!: string;

  @ApiPropertyOptional({
    nullable: true,
    example: "9525.5",
    description: "Empty or null = skipped (the previous price stays)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  price?: string | null;

  @ApiProperty({ enum: FX_CURRENCY_CODES })
  @IsIn(FX_CURRENCY_CODES as readonly string[])
  currency!: string;

  @ApiPropertyOptional({ nullable: true, example: "per lembar" })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  unitLabel?: string | null;

  @ApiProperty({ example: "2026-10-17" })
  @Matches(DATE)
  asOfDate!: string;

  @ApiPropertyOptional({ nullable: true, example: "16:00" })
  @IsOptional()
  @Matches(TIME)
  asOfTime?: string | null;

  @ApiPropertyOptional({ nullable: true, example: "Asia/Jakarta" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timeZone?: string | null;

  @ApiProperty({ enum: MANUAL_PRICE_SOURCES })
  @IsIn(MANUAL_PRICE_SOURCES as readonly string[])
  source!: ManualPriceSource;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reference?: string | null;
}

export class PriceBatchDto implements InvestmentPriceBatchInput {
  @ApiProperty({ type: [PriceBatchRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(PRICE_BATCH_MAX_ROWS)
  @ValidateNested({ each: true })
  @Type(() => PriceBatchRowDto)
  rows!: PriceBatchRowDto[];
}
