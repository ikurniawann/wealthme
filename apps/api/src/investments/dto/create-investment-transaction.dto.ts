import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { InvestmentTxType } from "@prisma/client";
import { IsEnum, IsISO8601, IsNumberString, IsOptional } from "class-validator";

/**
 * EPIC-022 D2 — record a buy or sell against an existing holding instead of
 * silently overwriting quantity/costBasisPerUnit via the generic edit form.
 * `occurredAt` defaults to "now" when omitted, mirroring SetManualPriceDto's
 * `asOf`.
 */
export class CreateInvestmentTransactionDto {
  @ApiProperty({ enum: ["buy", "sell"] })
  @IsEnum(InvestmentTxType)
  type!: InvestmentTxType;

  @ApiProperty({ example: "10", description: "Decimal string, must be > 0" })
  @IsNumberString()
  quantity!: string;

  @ApiProperty({ example: "10500.00", description: "Decimal string, >= 0" })
  @IsNumberString()
  pricePerUnit!: string;

  @ApiPropertyOptional({
    example: "2026-08-05T00:00:00.000Z",
    description: "Defaults to now when omitted",
  })
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}
