import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { LiabilityType } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

export class CreateLiabilityDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  institution?: string;

  @ApiProperty({ enum: LiabilityType })
  @IsEnum(LiabilityType)
  type!: LiabilityType;

  @ApiProperty({
    description: "Total original debt or credit limit as numeric string",
  })
  @IsString()
  @Matches(/^\d+$/, { message: "totalDebt must be a numeric string" })
  totalDebt!: string;

  @ApiProperty({ description: "Current remaining balance as numeric string" })
  @IsString()
  @Matches(/^\d+$/, { message: "remainingBalance must be a numeric string" })
  remainingBalance!: string;

  @ApiPropertyOptional({
    description: "Minimum monthly payment as numeric string",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: "minimumPayment must be a numeric string" })
  minimumPayment?: string;

  @ApiPropertyOptional({
    description: "Annual interest rate as decimal string, e.g. '2.25'",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: "interestRate must be a decimal string",
  })
  interestRate?: string;

  @ApiPropertyOptional({ description: "Next due date as ISO 8601 string" })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;
}
