import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { DonationType } from "@prisma/client";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

export class CreateDonationDto {
  @ApiProperty({ enum: DonationType })
  @IsEnum(DonationType)
  type!: DonationType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  recipient!: string;

  @ApiProperty({ description: "Amount as numeric string" })
  @IsString()
  @Matches(/^\d+$/, { message: "amount must be a numeric string" })
  amount!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiProperty({ description: "ISO 8601 date string" })
  @IsDateString()
  donatedAt!: string;

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
