import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, Matches } from "class-validator";

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
  @Matches(/^\d+$/, { message: "amount must be a numeric string" })
  @IsOptional()
  amount?: string;
}
