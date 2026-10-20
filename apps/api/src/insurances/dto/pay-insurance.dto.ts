import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
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

  @ApiPropertyOptional({
    description:
      "Task 24 — the day the premium was paid (YYYY-MM-DD, Asia/Jakarta). Never in the future. Defaults to today.",
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "paidDate must be YYYY-MM-DD" })
  @IsDateString()
  paidDate?: string;

  @ApiPropertyOptional({
    description:
      "Task 24 — wall-clock time of the payment (HH:MM, Asia/Jakarta). Only with paidDate.",
  })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "paidTime must be HH:MM" })
  paidTime?: string;

  @FxInputsProperty()
  fxInputs?: FxInputDto[];
}

/** Task 25 — "Batalkan pembayaran": optional reason kept in the audit row. */
export class VoidInsurancePaymentDto {
  @ApiPropertyOptional({ description: "Why the payment is voided (audit)" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
