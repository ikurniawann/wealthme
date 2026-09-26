import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { InheritanceVisibility } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

import { FxInputsProperty, type FxInputDto } from "../../fx/fx-input.dto";

import { CreateHeirDto } from "./create-heir.dto";

export class CreateInheritanceAssetDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  assetType!: string;

  @ApiProperty({ description: "Estimated value in smallest currency unit" })
  @IsInt()
  @Min(0)
  estimatedValue!: number;

  @ApiPropertyOptional({ default: "IDR" })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: InheritanceVisibility })
  @IsOptional()
  @IsEnum(InheritanceVisibility)
  visibility?: InheritanceVisibility;

  // EPIC-021 Group D (#11) — set when picking an existing Asset ("Pilih dari
  // Aset" mode) instead of manual entry. Validated against the family group
  // in the service layer.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assetId?: string;

  @ApiPropertyOptional({ type: [CreateHeirDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateHeirDto)
  heirs?: CreateHeirDto[];

  @FxInputsProperty()
  fxInputs?: FxInputDto[];
}
