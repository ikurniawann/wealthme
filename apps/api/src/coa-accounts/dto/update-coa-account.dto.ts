import { ApiPropertyOptional } from "@nestjs/swagger";
import { CoaBudgetType, CoaDirection } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class UpdateCoaAccountDto {
  @ApiPropertyOptional({
    type: String,
    description:
      "EPIC-021 #4 — 5-digit COA code. Editable: referentially safe " +
      "because Category links by coaAccountId (uuid), not code. Must keep " +
      "first digit == groupNum and stay unique per family group.",
    example: "20101",
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 6 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  groupNum?: number;

  @ApiPropertyOptional({ enum: CoaDirection })
  @IsOptional()
  @IsEnum(CoaDirection)
  direction?: CoaDirection;

  @ApiPropertyOptional({ enum: CoaBudgetType, nullable: true })
  @IsOptional()
  @IsEnum(CoaBudgetType)
  budgetType?: CoaBudgetType | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  parentCode?: string | null;
}
