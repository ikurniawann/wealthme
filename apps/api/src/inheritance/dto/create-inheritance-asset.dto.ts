import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { InheritanceVisibility } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

// Hardening audit (validation, MEDIUM/LOW) — matches transactions/budgets.
const MAX_INHERITANCE_VALUE = 999_999_999_999;

import { IsTrimmedNotEmpty } from "../../common/decorators/is-trimmed-not-empty.decorator";
import { FxInputsProperty, type FxInputDto } from "../../fx/fx-input.dto";

import { CreateHeirDto } from "./create-heir.dto";

export class CreateInheritanceAssetDto {
  @ApiProperty()
  @IsString()
  @IsTrimmedNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty()
  @IsString()
  @IsTrimmedNotEmpty()
  @MaxLength(100)
  assetType!: string;

  @ApiProperty({ description: "Estimated value in smallest currency unit" })
  @IsInt()
  @Min(0)
  @Max(MAX_INHERITANCE_VALUE)
  estimatedValue!: number;

  @ApiPropertyOptional({ default: "IDR" })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
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
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreateHeirDto)
  heirs?: CreateHeirDto[];

  @FxInputsProperty()
  fxInputs?: FxInputDto[];
}
