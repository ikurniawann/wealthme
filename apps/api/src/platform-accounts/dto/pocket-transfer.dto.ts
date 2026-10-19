import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { FX_CURRENCY_CODES } from "@wealthme/contracts";
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

const AMOUNT = /^\d{1,13}(\.\d{1,2})?$/;
const RATE = /^\d{1,12}(\.\d{1,6})?$/;

/**
 * Investasi §4 — top-up (bank → pocket) and withdrawal (pocket → bank) are
 * transfers, never income. See PocketTransferInput in packages/contracts
 * for the amount semantics.
 */
export class PocketTransferDto {
  @ApiProperty({
    description:
      "The bank / e-wallet / cash account on the other side of the transfer",
  })
  @IsString()
  @MinLength(1)
  counterAccountId!: string;

  @ApiProperty({ example: "1502500", description: "Total leaving the source" })
  @Matches(AMOUNT)
  sourceAmount!: string;

  @ApiProperty({ enum: FX_CURRENCY_CODES })
  @IsIn(FX_CURRENCY_CODES)
  sourceCurrency!: string;

  @ApiPropertyOptional({
    example: "100.00",
    description:
      "Net landing in the destination after the fee. Required cross-currency; same-currency defaults to sourceAmount − fee.",
  })
  @IsOptional()
  @Matches(AMOUNT)
  destAmount?: string;

  @ApiProperty({ enum: FX_CURRENCY_CODES })
  @IsIn(FX_CURRENCY_CODES)
  destCurrency!: string;

  @ApiPropertyOptional({
    example: "16250.5",
    description:
      "Actual rate, IDR per 1 unit of the foreign currency. Required cross-currency.",
  })
  @IsOptional()
  @Matches(RATE)
  fxRate?: string;

  @ApiPropertyOptional({
    example: "2500",
    description: "Booked as a separate expense on the destination.",
  })
  @IsOptional()
  @Matches(AMOUNT)
  fee?: string;

  @ApiPropertyOptional({
    enum: FX_CURRENCY_CODES,
    description: "Default sourceCurrency",
  })
  @IsOptional()
  @IsIn(FX_CURRENCY_CODES)
  feeCurrency?: string;

  @ApiProperty({ example: "2026-10-19T09:30:00.000Z" })
  @IsISO8601()
  occurredAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiProperty({
    description:
      "uuid generated when the form opens (R7). A replay returns the original result with HTTP 200.",
  })
  @IsUUID()
  idempotencyKey!: string;
}
