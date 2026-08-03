import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CoaBudgetType, CoaDirection } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateCoaAccountDto {
  @ApiPropertyOptional({
    type: String,
    description:
      "EPIC-021 #4 — 5-digit COA code (first digit must equal groupNum, " +
      "e.g. group 2 codes are 2xxxx). Auto-generated as the next free code " +
      "within the group's range when omitted or blank.",
    example: "20101",
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ type: String, description: "Account name" })
  @IsString()
  name!: string;

  @ApiProperty({ type: Number, minimum: 1, maximum: 6 })
  @IsInt()
  @Min(1)
  @Max(6)
  groupNum!: number;

  @ApiProperty({ enum: CoaDirection })
  @IsEnum(CoaDirection)
  direction!: CoaDirection;

  @ApiPropertyOptional({ enum: CoaBudgetType, nullable: true })
  @IsOptional()
  @IsEnum(CoaBudgetType)
  budgetType?: CoaBudgetType | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  parentCode?: string | null;
}
