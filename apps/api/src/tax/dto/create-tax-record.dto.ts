import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
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

export class CreateTaxRecordDto {
  @ApiProperty({ description: "Tax year e.g. 2024" })
  @IsInt()
  @Min(2000)
  @Max(2100)
  taxYear!: number;

  @ApiProperty({ description: "Gross income as numeric string" })
  @IsString()
  @Matches(/^\d+$/, { message: "grossIncome must be a numeric string" })
  grossIncome!: string;

  @ApiProperty({ description: "PTKP amount as numeric string" })
  @IsString()
  @Matches(/^\d+$/, { message: "ptkp must be a numeric string" })
  ptkp!: string;

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
