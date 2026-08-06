-- EPIC-023 F3 (D21, US-SPLIT-5/6) — shared split-bill link shows the
-- recipient's OWN share + payment destination, accepts a "saya sudah
-- transfer" claim, and only the owner's confirmation posts real income.
-- Sorts after 20260806150000 (Group F2).

-- 1. ParticipantStatus gains 'claimed' between 'pending' and 'paid' — the
--    claim state. Not referenced anywhere else in this same migration
--    file, so this is safe inside a single transaction (PG12+; see the
--    identical pattern in 20260805010000 / 20260806150000).
ALTER TYPE "ParticipantStatus" ADD VALUE 'claimed' AFTER 'pending';

-- 2. Recipients are now identified by their OWN link, not the bill-wide
--    `SplitBill.shareToken` — a single token cannot distinguish which
--    participant is asking, and the old `GET split-bills/share/:token`
--    returned the WHOLE bill (familyGroupId + every other participant's
--    name/amount) through it. Drop the bill-wide token; it has no other
--    use in this schema (verified: grep shows only split-bills.service.ts
--    and the two split-bill pages referenced it, all replaced by this
--    migration + its follow-up code changes).
DROP INDEX "split_bills_shareToken_idx";
DROP INDEX "split_bills_shareToken_key";
ALTER TABLE "split_bills" DROP COLUMN "shareToken";

-- 3. Give every SplitParticipant their own unguessable token instead.
--    gen_random_uuid() (pgcrypto, already enabled by an earlier migration —
--    see 20260805000000) backfills existing rows; the column then drops
--    its DB-level default so future inserts keep going through Prisma's
--    own uuid() default (application-side), matching every other token
--    column in this schema (Invitation.token, SplitBill.id, etc., none of
--    which carry a DB-level DEFAULT either).
ALTER TABLE "split_participants" ADD COLUMN "shareToken" TEXT NOT NULL DEFAULT gen_random_uuid()::text;
ALTER TABLE "split_participants" ALTER COLUMN "shareToken" DROP DEFAULT;
CREATE UNIQUE INDEX "split_participants_shareToken_key" ON "split_participants"("shareToken");

-- 4. The "saya sudah transfer" claim timestamp, and the unenforced link to
--    the real Transaction a confirm() posts (same convention as
--    Donation.transactionId — no Prisma relation, validated in the
--    service layer).
ALTER TABLE "split_participants" ADD COLUMN "claimedAt" TIMESTAMP(3);
ALTER TABLE "split_participants" ADD COLUMN "settlementTransactionId" TEXT;
CREATE UNIQUE INDEX "split_participants_settlementTransactionId_key" ON "split_participants"("settlementTransactionId");

-- 5. Bill-level payout destination (the account/instructions the owner
--    nominates for recipients to pay into) + bill-wide revocation flag.
--    Unenforced FK to Account, same convention as Donation.accountId.
ALTER TABLE "split_bills" ADD COLUMN "payoutAccountId" TEXT;
ALTER TABLE "split_bills" ADD COLUMN "payoutInstructions" VARCHAR(300);
ALTER TABLE "split_bills" ADD COLUMN "revokedAt" TIMESTAMP(3);
