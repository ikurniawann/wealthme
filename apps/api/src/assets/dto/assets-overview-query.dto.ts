import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  ASSET_CLASSES,
  ASSET_STATUSES,
  FX_CURRENCY_CODES,
} from "@wealthme/contracts";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import type {
  AssetClass,
  AssetStatus,
  AssetsOverviewQuery,
} from "@wealthme/contracts";

const DECIMAL = /^\d{1,20}(\.\d{1,8})?$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
export const OVERVIEW_SORTS = [
  "value_desc",
  "value_asc",
  "name_asc",
  "acquired_desc",
] as const;
export const OVERVIEW_MAX_LIMIT = 100;
export const OVERVIEW_DEFAULT_LIMIT = 25;

/** GET …/assets/overview (Aset Task 17). Money bounds are rupiah strings. */
export class AssetsOverviewQueryDto implements AssetsOverviewQuery {
  @ApiPropertyOptional({ description: "Name, ticker, code or custodian" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: ASSET_CLASSES })
  @IsOptional()
  @IsIn(ASSET_CLASSES)
  class?: AssetClass;

  @ApiPropertyOptional({ description: "Account/investment/asset type" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  subtype?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  ownerUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  platformAccountId?: string;

  @ApiPropertyOptional({ description: "Custodian / location contains" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  custodian?: string;

  @ApiPropertyOptional({ description: "Minimum value, IDR" })
  @IsOptional()
  @Matches(DECIMAL)
  minValue?: string;

  @ApiPropertyOptional({ description: "Maximum value, IDR" })
  @IsOptional()
  @Matches(DECIMAL)
  maxValue?: string;

  @ApiPropertyOptional({ description: "Requires `unit`" })
  @IsOptional()
  @Matches(DECIMAL)
  minQuantity?: string;

  @ApiPropertyOptional({ description: "Requires `unit`" })
  @IsOptional()
  @Matches(DECIMAL)
  maxQuantity?: string;

  @ApiPropertyOptional({ description: "Quantity unit (gram, lembar, unit…)" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  unit?: string;

  @ApiPropertyOptional({ description: "yyyy-mm-dd" })
  @IsOptional()
  @Matches(YMD)
  acquiredFrom?: string;

  @ApiPropertyOptional({ description: "yyyy-mm-dd" })
  @IsOptional()
  @Matches(YMD)
  acquiredTo?: string;

  @ApiPropertyOptional({ enum: ASSET_STATUSES, default: "active" })
  @IsOptional()
  @IsIn(ASSET_STATUSES)
  status?: AssetStatus;

  @ApiPropertyOptional({ enum: ["complete", "incomplete"] })
  @IsOptional()
  @IsIn(["complete", "incomplete"])
  completeness?: "complete" | "incomplete";

  @ApiPropertyOptional({ enum: OVERVIEW_SORTS, default: "value_desc" })
  @IsOptional()
  @IsIn(OVERVIEW_SORTS)
  sort?: (typeof OVERVIEW_SORTS)[number];

  @ApiPropertyOptional({ enum: FX_CURRENCY_CODES, default: "IDR" })
  @IsOptional()
  @IsIn(FX_CURRENCY_CODES as readonly string[])
  displayCurrency?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: OVERVIEW_DEFAULT_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(OVERVIEW_MAX_LIMIT)
  limit?: number;
}
