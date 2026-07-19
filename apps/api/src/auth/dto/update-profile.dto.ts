import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

const GENDER_OPTIONS = ["Laki-laki", "Perempuan"] as const;
const CURRENCY_OPTIONS = ["IDR", "USD", "SGD", "EUR", "JPY"] as const;

export class UpdateProfileDto {
  @ApiPropertyOptional({ type: String, description: "Display name" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    type: String,
    description: "Two-letter avatar initials",
  })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  avatarInitials?: string;

  @ApiPropertyOptional({ type: String, description: "Phone number" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({
    type: String,
    description: "Birth date (ISO date string, e.g. 1990-05-15)",
  })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({
    type: String,
    enum: GENDER_OPTIONS,
    description: "Gender",
  })
  @IsOptional()
  @IsIn(GENDER_OPTIONS)
  gender?: string;

  @ApiPropertyOptional({ type: String, description: "Job title" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobTitle?: string;

  @ApiPropertyOptional({
    type: String,
    description:
      "Monthly income (formatted display string, e.g. Rp 25.000.000)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  monthlyIncome?: string;

  @ApiPropertyOptional({
    type: String,
    enum: CURRENCY_OPTIONS,
    description: "Display currency preference (ISO 4217 code)",
  })
  @IsOptional()
  @IsIn(CURRENCY_OPTIONS)
  currency?: string;
}
