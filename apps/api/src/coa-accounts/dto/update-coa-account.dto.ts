import { ApiPropertyOptional } from "@nestjs/swagger";
import { CoaBudgetType, CoaDirection } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class UpdateCoaAccountDto {
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
