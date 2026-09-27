import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsISO8601, IsNumberString, IsOptional } from "class-validator";

import { FxInputsProperty, type FxInputDto } from "../../fx/fx-input.dto";

/**
 * EPIC-023 G1 (D15) — manual price entry for the manual-only instrument
 * types (reksa_dana, obligasi, emas, lainnya). `asOf` defaults to "now" when
 * omitted; it is always shown on screen as "diinput manual, per <date>" —
 * never presented as a live quote.
 */
export class SetManualPriceDto {
  @ApiProperty({ example: "15250.00", description: "Decimal string" })
  @IsNumberString()
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
