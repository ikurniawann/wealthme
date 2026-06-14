import { ApiPropertyOptional } from "@nestjs/swagger";
import { SptStatus } from "@prisma/client";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from "class-validator";

export class UpdateTaxRecordDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  taxYear?: number;

  @ApiPropertyOptional({ description: "Gross income as numeric string" })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: "grossIncome must be a numeric string" })
  grossIncome?: string;

  @ApiPropertyOptional({ description: "PTKP amount as numeric string" })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: "ptkp must be a numeric string" })
  ptkp?: string;

  @ApiPropertyOptional({ description: "Net tax as numeric string" })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: "netTax must be a numeric string" })
  netTax?: string;

  @ApiPropertyOptional({ enum: SptStatus })
  @IsOptional()
  @IsEnum(SptStatus)
  sptStatus?: SptStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  documentUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
