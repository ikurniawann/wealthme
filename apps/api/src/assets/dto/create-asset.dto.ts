import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AssetType } from "@prisma/client";
import {
  IsEnum,
  IsOptional,
  IsString,
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
}
