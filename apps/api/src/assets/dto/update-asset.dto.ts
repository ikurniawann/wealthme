import { ApiPropertyOptional } from "@nestjs/swagger";
import { AssetType } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";

export class UpdateAssetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: AssetType })
  @IsOptional()
  @IsEnum(AssetType)
  type?: AssetType;

  @ApiPropertyOptional({ description: "BigInt value as numeric string" })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: "currentValue must be a numeric string" })
  currentValue?: string;

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
    description:
      "Optional physical-asset category (master data Category), same family group",
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description:
      "Date the asset was acquired (ISO date string), used as the elapsed-time anchor for currentEstimatedValue instead of createdAt.",
  })
  @IsOptional()
  @IsDateString()
  acquisitionDate?: string;
}
