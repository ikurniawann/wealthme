import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AssetType } from "@prisma/client";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";

export class CreateAssetDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: AssetType })
  @IsEnum(AssetType)
  type!: AssetType;

  @ApiProperty({
    description: "BigInt value as numeric string, e.g. '200000000'",
  })
  @IsString()
  @Matches(/^\d+$/, { message: "currentValue must be a numeric string" })
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
    description:
      "Optional physical-asset category (master data Category), same family group",
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
