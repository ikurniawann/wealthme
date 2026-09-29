import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { DonationType } from "@prisma/client";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";

import { IsTrimmedNotEmpty } from "../../common/decorators/is-trimmed-not-empty.decorator";
import { FxInputsProperty, type FxInputDto } from "../../fx/fx-input.dto";

// Hardening audit (validation, MEDIUM) — same bounded pattern as
// `tax/dto/tax-preview.dto.ts`'s `TAX_DIGITS`; an unbounded `/^\d+$/` can
// overflow the BigInt column.
const DONATION_AMOUNT_DIGITS = /^\d{1,15}$/;

export class CreateDonationDto {
  @ApiProperty({ enum: DonationType })
  @IsEnum(DonationType)
  type!: DonationType;

  @ApiProperty()
  @IsString()
  @IsTrimmedNotEmpty()
  @MaxLength(200)
  recipient!: string;

  @ApiProperty({ description: "Amount as numeric string" })
  @IsString()
  @Matches(DONATION_AMOUNT_DIGITS, {
    message: "amount must be a numeric string of at most 15 digits",
  })
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

  @ApiPropertyOptional({
    description:
      "Source account to deduct the donation from — creates a linked expense transaction",
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  // Hardening audit (validation, HIGH) — this used to be `@IsString()`
  // only, and is rendered as `<a href>` to every family member
  // (apps/web/.../donation/page.tsx). A `javascript:` URL would have become
  // stored XSS. Restricted to http(s) links only.
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
