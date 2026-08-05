import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";

export class ApproveAllowanceRequestDto {
  // EPIC-023 Task D (D3/D9) — required only for `kind: "funding"` (the
  // owner picks which account funds the transfer); a `held_expense`
  // request already carries its own account (the one the deferred expense
  // debits) and needs no choice at approval time. Optionality is enforced
  // in AllowanceRequestsService.approve, per `kind`.
  @ApiPropertyOptional({
    type: String,
    description:
      "Owner-chosen source account (e.g. the family master account) to debit — required for a funding request, ignored/omitted for a held expense",
  })
  @IsOptional()
  @IsUUID()
  fromAccountId?: string;
}
