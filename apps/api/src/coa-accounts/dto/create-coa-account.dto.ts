import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CoaBudgetType, CoaDirection } from "@prisma/client";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";

export class CreateCoaAccountDto {
  @ApiProperty({
    type: String,
    description: "5-digit COA code",
    example: "20101",
  })
  @IsString()
  @Length(5, 5)
  code!: string;

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
