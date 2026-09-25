import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { InterestMethod, LiabilityType } from "@prisma/client";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
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

  @ApiPropertyOptional({
    description: "Automatically advance dueDate by 1 month once it's passed",
  })
  @IsOptional()
  @IsBoolean()
  autoAdvanceDueDate?: boolean;

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

  @ApiPropertyOptional({
    enum: InterestMethod,
    description:
      "Defaults per type on create: kpr→anuitas, kendaraan/pinjaman_pribadi→flat, otherwise efektif",
  })
  @IsOptional()
  @IsEnum(InterestMethod)
  interestMethod?: InterestMethod;

  @ApiPropertyOptional({ minimum: 1, maximum: 600 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  tenorMonths?: number;

  @ApiPropertyOptional({ description: "Loan start (akad) date, ISO 8601" })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description:
      "Monthly installment override as numeric string; computed for flat/anuitas when omitted",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: "installmentAmount must be a numeric string" })
  installmentAmount?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 600,
    description: "KPR fixed-rate period in months",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  fixedRateMonths?: number;

  @ApiPropertyOptional({
    description: "Annual rate after the fixed period, e.g. '11.00'",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: "floatingRate must be a decimal string",
  })
  floatingRate?: string;
}
