export type SplitStatus = "open" | "settled";
// EPIC-023 F3 (D21) — "claimed" is the "saya sudah transfer" state: the
// recipient says they sent the money but NO income has posted yet. Only
// the owner's confirm action moves a participant to "paid", which is the
// ONLY transition that posts a real Transaction.
export type ParticipantStatus = "pending" | "claimed" | "paid";

export interface SplitParticipantDto {
  id: string;
  splitBillId: string;
  name: string;
  amountOwed: string;
  status: ParticipantStatus;
  // This participant's own unguessable link identifier — the public share
  // page and its API key off this, not the (now removed) bill-wide token.
  shareToken: string;
  claimedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface SplitBillDto {
  id: string;
  familyGroupId: string;
  title: string;
  totalAmount: string;
  currency: string;
  status: SplitStatus;
  notes: string | null;
  payoutAccountId: string | null;
  payoutInstructions: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  participants: SplitParticipantDto[];
}

export interface CreateSplitParticipantDto {
  name: string;
  amountOwed: number;
}

export interface CreateSplitBillDto {
  title: string;
  totalAmount: number;
  notes?: string;
  // The account (in the SAME family group) that receives transfers for
  // this bill — shown to every recipient via their own share link, and
  // credited for real once the owner confirms a participant's claim.
  payoutAccountId: string;
  payoutInstructions?: string;
  participants: CreateSplitParticipantDto[];
}

// EPIC-023 F3 — the payment destination rendered on a recipient's own
// public share link ("how to pay"). All fields are already non-sensitive
// display data (an account's name/institution/masked number, or the
// owner's free-text instructions) — no account id, no balance.
export interface SplitBillPayoutDto {
  accountName: string | null;
  accountInstitution: string | null;
  accountMaskedNumber: string | null;
  instructions: string | null;
  // EPIC-023 Group F fix round (HIGH 5) — true once the owner has ever
  // nominated a payout account for this bill (`SplitBill.payoutAccountId`
  // is set), independent of whether that account can still be resolved.
  // Lets the recipient's page tell "the owner never configured payment
  // details" (`configured: false`) apart from "it WAS configured but the
  // account is currently unavailable" (`configured: true`, `accountName:
  // null`) — deleting the payout account must not read to a recipient as
  // if the owner never set it up.
  configured: boolean;
}

// EPIC-023 F3 (D21) — the PUBLIC, unauthenticated view of exactly ONE
// participant's own share. Deliberately excludes familyGroupId, the split
// bill's id, and every other participant's name/amount/status — see
// split-bills.controller.ts's getPublicParticipant / claimParticipant.
export interface PublicSplitParticipantDto {
  billTitle: string;
  participantName: string;
  amountOwed: string;
  currency: string;
  status: ParticipantStatus;
  claimedAt: string | null;
  paidAt: string | null;
  payout: SplitBillPayoutDto;
}
