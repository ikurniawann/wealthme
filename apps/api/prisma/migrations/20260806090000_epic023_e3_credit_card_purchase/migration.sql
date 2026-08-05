-- EPIC-023 Task E3 (D12, US-LIAB-5) — a credit-card purchase touches no
-- bank/cash account (it raises the card's own debt instead, via
-- Liability.remainingBalance/totalDebt — see LiabilitiesService.purchase()).
-- `Transaction.accountId` was NOT NULL, so a card purchase had nowhere
-- honest to point. Made nullable: a card-purchase Transaction now carries
-- `accountId = NULL` + `liabilityId` set (E1's existing column); every
-- pre-existing/normal transaction keeps a non-null accountId, unchanged.
-- No DROP, no DELETE, no TRUNCATE — purely relaxing a NOT NULL constraint.
ALTER TABLE "transactions" ALTER COLUMN "accountId" DROP NOT NULL;
