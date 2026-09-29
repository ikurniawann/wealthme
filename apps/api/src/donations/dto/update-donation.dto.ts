import { ApiPropertyOptional } from "@nestjs/swagger";
import { DonationType } from "@prisma/client";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from "class-validator";

import { IsTrimmedNotEmpty } from "../../common/decorators/is-trimmed-not-empty.decorator";
import { FxInputsProperty, type FxInputDto } from "../../fx/fx-input.dto";

// Hardening audit (validation, MEDIUM) — mirrors create-donation.dto.ts.
const DONATION_AMOUNT_DIGITS = /^\d{1,15}$/;

export class UpdateDonationDto {
  @ApiPropertyOptional({ enum: DonationType })
  @IsOptional()
  @IsEnum(DonationType)
  type?: DonationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsTrimmedNotEmpty()
  @MaxLength(200)
  recipient?: string;

  @ApiPropertyOptional({ description: "Amount as numeric string" })
  @IsOptional()
  @IsString()
  @Matches(DONATION_AMOUNT_DIGITS, {
    message: "amount must be a numeric string of at most 15 digits",
  })
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

  // Hardening audit (validation, HIGH) — mirrors create-donation.dto.ts:
  // rendered as `<a href>` to every family member, so a non-http(s) scheme
  // would have been stored XSS.
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  @MaxLength(2048)
  receiptUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @FxInputsProperty()
  fxInputs?: FxInputDto[];
}
