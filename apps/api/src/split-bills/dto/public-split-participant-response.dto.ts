import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * EPIC-023 F3 (D21) — the payment destination shown on a recipient's own
 * public share link. Every field here is already non-sensitive display
 * data (an account's name/institution/masked number, or the owner's
 * free-text instructions) — never an account id or balance.
 */
export class SplitBillPayoutResponseDto {
  @ApiPropertyOptional() accountName!: string | null;
  @ApiPropertyOptional() accountInstitution!: string | null;
  @ApiPropertyOptional() accountMaskedNumber!: string | null;
  @ApiPropertyOptional() instructions!: string | null;
}

/**
 * EPIC-023 F3 (D21) — the PUBLIC, unauthenticated view of exactly ONE
 * participant's own share. Deliberately excludes `familyGroupId`, the
 * split bill's own id, and every other participant's name/amount/status —
 * see SplitBillsService.getPublicParticipant / claimParticipant.
 */
export class PublicSplitParticipantResponseDto {
  @ApiProperty() billTitle!: string;
  @ApiProperty() participantName!: string;
  @ApiProperty() amountOwed!: string;
  @ApiProperty() currency!: string;
  @ApiProperty() status!: string;
  @ApiPropertyOptional() claimedAt!: string | null;
  @ApiPropertyOptional() paidAt!: string | null;
  @ApiProperty({ type: SplitBillPayoutResponseDto })
  payout!: SplitBillPayoutResponseDto;
}
