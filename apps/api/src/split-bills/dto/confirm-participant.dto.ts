import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional } from "class-validator";

/**
 * EPIC-023 F3 (D21) — renamed from `SettleParticipantDto`/"settle" to match
 * what this endpoint now actually does: `SplitBillsService.confirmParticipant`
 * posts a real `Transaction` crediting the bill's payout account, not just a
 * status flip (the old `settleParticipant` created no Transaction at all —
 * see the service's header comment history). `paidAt` is honored now (it
 * used to be accepted and silently discarded by the controller).
 */
export class ConfirmParticipantDto {
  @ApiPropertyOptional({ description: "Override paid-at timestamp (ISO 8601)" })
  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
