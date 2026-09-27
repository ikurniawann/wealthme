import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CategoryKind } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

import { IsTrimmedNotEmpty } from "../../common/decorators/is-trimmed-not-empty.decorator";

export class CreateCategoryDto {
  @ApiProperty({ type: String, description: "Category name", maxLength: 100 })
  @IsString()
  @IsTrimmedNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: CategoryKind, description: "Category kind" })
  @IsEnum(CategoryKind)
  kind!: CategoryKind;

  @ApiPropertyOptional({
    type: String,
    format: "uuid",
    description:
      "COA account (same family group) this category maps to. If omitted, the " +
      "server assigns a sensible default account matching the category kind " +
      "(EPIC-017: every category is COA-linked).",
  })
  @IsOptional()
  @IsUUID()
  coaAccountId?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Hex color",
  })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Icon identifier",
  })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description:
      "Hide this category (and its transactions) from `member` viewers in shared family views",
  })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}
