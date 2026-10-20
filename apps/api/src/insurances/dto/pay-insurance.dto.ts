import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from "class-validator";

import { FxInputsProperty, type FxInputDto } from "../../fx/fx-input.dto";

// EPIC-023 E1 — mirrors liabilities/dto/pay-liability.dto.ts's shape.
// `amount` is OPTIONAL here (unlike PayLiabilityDto, where the payer chooses
// how much of a variable balance to pay): the acceptance criterion is "the
// head presses Bayar and selects a source account" — no amount typed — so an
// omitted amount defaults to the policy's fixed `premiumAmount`
// (InsurancesService.pay()). Passing an explicit amount still overrides it,
// e.g. a partial or top-up premium payment.
export class PayInsuranceDto {
  @ApiProperty({
    description: "Account the premium payment is debited from",
  })
  @IsUUID()
  sourceAccountId!: string;

  @ApiPropertyOptional({
    description:
      "Payment amount as a numeric string (whole rupiah). Defaults to the policy's premiumAmount when omitted.",
  })
  @IsString()
  @Matches(/^\d{1,15}$/, { message: "amount must be a numeric string" })
  @IsOptional()
  amount?: string;

  @ApiPropertyOptional({
    description:
      "S7 — client-generated key (8–64 chars). A retry with the same key returns the original payment instead of paying twice. The Idempotency-Key header is accepted too.",
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_.:-]{8,64}$/, {
    message: "idempotencyKey must be 8-64 chars of [A-Za-z0-9_.:-]",
  })
  idempotencyKey?: string;

  @ApiPropertyOptional({
    description:
      "The scheduled due (YYYY-MM-DD) this payment settles. Defaults to the policy's nextPremiumDueDate.",
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @FxInputsProperty()
  fxInputs?: FxInputDto[];
}
