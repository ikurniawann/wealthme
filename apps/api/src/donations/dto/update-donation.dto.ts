import { ApiPropertyOptional } from "@nestjs/swagger";
import { DonationType } from "@prisma/client";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

export class UpdateDonationDto {
  @ApiPropertyOptional({ enum: DonationType })
  @IsOptional()
  @IsEnum(DonationType)
  type?: DonationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  recipient?: string;

  @ApiPropertyOptional({ description: "Amount as numeric string" })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: "amount must be a numeric string" })
  amount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ description: "ISO 8601 date string" })
  @IsOptional()
  @IsDateString()
  donatedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isTaxDeductible?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
