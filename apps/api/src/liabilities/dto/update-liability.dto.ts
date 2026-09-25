import { ApiPropertyOptional } from "@nestjs/swagger";
import { InterestMethod, LiabilityType } from "@prisma/client";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateLiabilityDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  institution?: string;

  @ApiPropertyOptional({ enum: LiabilityType })
  @IsOptional()
  @IsEnum(LiabilityType)
  type?: LiabilityType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: "totalDebt must be a numeric string" })
  totalDebt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: "remainingBalance must be a numeric string" })
  remainingBalance?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: "minimumPayment must be a numeric string" })
  minimumPayment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: "interestRate must be a decimal string",
  })
  interestRate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
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

  @ApiPropertyOptional({ enum: InterestMethod })
  @IsOptional()
  @IsEnum(InterestMethod)
  interestMethod?: InterestMethod;

  @ApiPropertyOptional({ minimum: 1, maximum: 600 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  tenorMonths?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: "installmentAmount must be a numeric string" })
  installmentAmount?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 600 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  fixedRateMonths?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: "floatingRate must be a decimal string",
  })
  floatingRate?: string;
}
