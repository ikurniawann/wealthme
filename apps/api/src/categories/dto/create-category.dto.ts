import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CategoryKind } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateCategoryDto {
  @ApiProperty({ type: String, description: "Category name", maxLength: 100 })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: CategoryKind, description: "Category kind" })
  @IsEnum(CategoryKind)
  kind!: CategoryKind;

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
