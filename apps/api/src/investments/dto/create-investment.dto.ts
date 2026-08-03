import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { InvestmentType } from "@prisma/client";
import {
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

export class CreateInvestmentDto {
  @ApiProperty({ example: "BBCA" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[A-Z0-9._-]{1,20}$/i, {
    message: "ticker must be alphanumeric (A-Z, 0-9, ., _, -)",
  })
  ticker!: string;

  @ApiProperty({ example: "Bank Central Asia" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ enum: InvestmentType })
  @IsEnum(InvestmentType)
  type!: InvestmentType;

  @ApiProperty({ example: "10.5", description: "Decimal string" })
  @IsNumberString()
  quantity!: string;

  @ApiProperty({ example: "5000.00", description: "Decimal string" })
  @IsNumberString()
  costBasisPerUnit!: string;

  @ApiPropertyOptional({ example: "IDR" })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({
    example: "6.50",
    description:
      "Annual interest rate (%) for interest-bearing instruments (obligasi, deposito). Must be between 0 and 100.",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: "interestRatePct must be a decimal string, e.g. '6.50'",
  })
  interestRatePct?: string;
}
