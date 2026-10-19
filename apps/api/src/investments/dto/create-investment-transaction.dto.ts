import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { InvestmentTxType } from "@prisma/client";
import {
  IsEnum,
  IsISO8601,
  IsNumberString,
  IsOptional,
  IsUUID,
} from "class-validator";

import { FxInputsProperty, type FxInputDto } from "../../fx/fx-input.dto";

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

  @ApiPropertyOptional({
    description:
      "EPIC-033 p28 — settle the trade against this account: a buy debits it " +
      "(transfer out), a sell credits the net proceeds (transfer in). Since the " +
      "Investasi ledger (Task 7) the realised P/L stays on the ledger row.",
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({
    description:
      "Investasi R7 — uuid generated when the form opens; a retry with the same key returns the original row instead of recording the trade twice.",
  })
  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;

  @FxInputsProperty()
  fxInputs?: FxInputDto[];
}
