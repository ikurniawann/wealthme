-- Investasi rollback safety (release-2 staging rehearsal finding).
--
-- The pre-rebuild API image (staging 754d2187) records a buy/sell with
--   investmentTransaction.create({ investmentId, type, quantity,
--     pricePerUnit, occurredAt, realizedPnl })
-- and never sends the columns 20261019200000_investasi_foundation made
-- NOT NULL without a default (familyGroupId, kind, effectiveDate,
-- grossAmount, netAmount, updatedAt). After an image-retag rollback that
-- insert failed with a null-constraint 500. This BEFORE INSERT trigger fills
-- them with exactly the foundation backfill's rules, so an old-image row is
-- indistinguishable from a backfilled legacy row. New code always sets every
-- column, so the trigger only fires for older images. Additive: no existing
-- row, column or constraint changes.
--
-- effectiveDate uses the same Asia/Jakarta rule as the foundation backfill
-- (the investment ledger stores real instants, see ledgerInstant): the old
-- web's date-only values arrive as UTC midnight and stay on their own date;
-- the old service's default "now" lands on the Jakarta calendar day.
-- effectiveTime stays NULL (date-only), as for every backfilled legacy row.

CREATE OR REPLACE FUNCTION "investment_transactions_fill_legacy"() RETURNS trigger AS $$
BEGIN
  IF NEW."familyGroupId" IS NULL THEN
    SELECT i."familyGroupId" INTO NEW."familyGroupId"
    FROM "investments" i WHERE i."id" = NEW."investmentId";
  END IF;
  IF NEW."kind" IS NULL AND NEW."type" IS NOT NULL THEN
    NEW."kind" := (NEW."type"::text)::"InvestmentTxKind";
  END IF;
  IF NEW."occurredAt" IS NULL THEN
    NEW."occurredAt" := CURRENT_TIMESTAMP;
  END IF;
  IF NEW."effectiveDate" IS NULL THEN
    NEW."effectiveDate" := ((NEW."occurredAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta')::date;
  END IF;
  IF NEW."grossAmount" IS NULL THEN
    NEW."grossAmount" := ROUND(NEW."quantity" * NEW."pricePerUnit", 2);
  END IF;
  IF NEW."netAmount" IS NULL THEN
    NEW."netAmount" := ROUND(NEW."quantity" * NEW."pricePerUnit", 2);
  END IF;
  IF NEW."createdAt" IS NULL THEN
    NEW."createdAt" := CURRENT_TIMESTAMP;
  END IF;
  IF NEW."updatedAt" IS NULL THEN
    NEW."updatedAt" := NEW."createdAt";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "investment_transactions_fill_legacy" ON "investment_transactions";
CREATE TRIGGER "investment_transactions_fill_legacy"
  BEFORE INSERT ON "investment_transactions"
  FOR EACH ROW EXECUTE FUNCTION "investment_transactions_fill_legacy"();
