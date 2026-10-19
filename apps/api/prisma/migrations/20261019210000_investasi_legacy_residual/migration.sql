-- Investasi R5 (controller ruling) — residual opening for legacy holdings.
--
-- The old create() wrote a holding's starting quantity straight onto
-- `investments` with no ledger row, so a holding that later got buys/sells
-- holds more than its ledger explains. This records exactly that residual:
--   stored quantity − (Σ opening + Σ buy − Σ sell) over its active rows
-- as ONE `opening` at the holding's current average cost, dated the earliest
-- existing effective date and created 1 second before the earliest row so
-- R6's tie-break (effectiveDate, effectiveTime NULLS FIRST, createdAt, id)
-- replays it first.
--
-- note = 'legacy-residual' is a stable marker (LEGACY_RESIDUAL_NOTE in
-- @wealthme/contracts); the UI shows it as "Dari data lama — lengkapi
-- riwayat". It never debits cash (no cashAccountId).
--
-- Openings already in the ledger (the foundation migration's no-history
-- backfill, or create() since then) count toward the explained quantity, so
-- those holdings have residual 0 and get nothing. A negative residual inserts
-- nothing either: the replay reports it as a conflict.
INSERT INTO "investment_transactions" (
  "id", "investmentId", "familyGroupId", "type", "kind", "quantity",
  "pricePerUnit", "occurredAt", "realizedPnl", "effectiveDate",
  "grossAmount", "netAmount", "currency", "status", "note",
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text, i."id", i."familyGroupId", 'buy', 'opening',
  i."quantity" - agg."explainedQty", i."costBasisPerUnit",
  agg."firstOccurredAt", NULL, agg."firstEffectiveDate",
  ROUND((i."quantity" - agg."explainedQty") * i."costBasisPerUnit", 2),
  ROUND((i."quantity" - agg."explainedQty") * i."costBasisPerUnit", 2),
  'IDR', 'active', 'legacy-residual',
  agg."firstCreatedAt" - INTERVAL '1 second', CURRENT_TIMESTAMP
FROM "investments" i
JOIN (
  SELECT
    t."investmentId",
    SUM(CASE WHEN t."kind" = 'sell' THEN -t."quantity" ELSE t."quantity" END) AS "explainedQty",
    MIN(t."effectiveDate") AS "firstEffectiveDate",
    MIN(t."occurredAt") AS "firstOccurredAt",
    MIN(t."createdAt") AS "firstCreatedAt"
  FROM "investment_transactions" t
  WHERE t."status" = 'active' AND t."kind" IN ('opening', 'buy', 'sell')
  GROUP BY t."investmentId"
) agg ON agg."investmentId" = i."id"
WHERE i."quantity" - agg."explainedQty" > 0;
