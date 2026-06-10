import { ApiPropertyOptional } from "@nestjs/swagger";
import { InvestmentType } from "@prisma/client";
import {
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

export class UpdateInvestmentDto {
  @ApiPropertyOptional({ example: "BBCA" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[A-Z0-9._-]{1,20}$/i, {
    message: "ticker must be alphanumeric (A-Z, 0-9, ., _, -)",
  })
  ticker?: string;

  @ApiPropertyOptional({ example: "Bank Central Asia" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ enum: InvestmentType })
  @IsOptional()
  @IsEnum(InvestmentType)
  type?: InvestmentType;

  @ApiPropertyOptional({ example: "10.5", description: "Decimal string" })
  @IsOptional()
  @IsNumberString()
  quantity?: string;

  @ApiPropertyOptional({ example: "5000.00", description: "Decimal string" })
  @IsOptional()
  @IsNumberString()
  costBasisPerUnit?: string;

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
}
