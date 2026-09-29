import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsISO8601, IsOptional, Matches } from "class-validator";

import { FxInputsProperty, type FxInputDto } from "../../fx/fx-input.dto";

// Hardening audit (validation, HIGH) — `@IsNumberString()` alone accepted
// "-15250" (a negative price, checked separately in the service) AND an
// unbounded number of digits. Bounded like `tax/dto/tax-preview.dto.ts`'s
// `TAX_DIGITS`, but allowing up to 6 decimal places since a unit price is
// not always a whole Rupiah amount.
const MANUAL_PRICE_PATTERN = /^\d{1,15}(\.\d{1,6})?$/;

/**
 * EPIC-023 G1 (D15) — manual price entry for the manual-only instrument
 * types (reksa_dana, obligasi, emas, lainnya). `asOf` defaults to "now" when
 * omitted; it is always shown on screen as "diinput manual, per <date>" —
 * never presented as a live quote.
 */
export class SetManualPriceDto {
  @ApiProperty({ example: "15250.00", description: "Decimal string" })
  @Matches(MANUAL_PRICE_PATTERN, {
    message: 'price must be a positive decimal string, e.g. "15250.00"',
  })
  price!: string;

  @ApiPropertyOptional({
    example: "2026-08-05T00:00:00.000Z",
    description: "Defaults to now when omitted",
  })
  @IsOptional()
  @IsISO8601()
  asOf?: string;

  @FxInputsProperty()
  fxInputs?: FxInputDto[];
}
