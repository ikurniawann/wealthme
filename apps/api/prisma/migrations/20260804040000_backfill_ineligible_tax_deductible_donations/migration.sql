-- EPIC-022 Group E (E5) — corrective backfill, not a schema change.
--
-- Before this epic, `isTaxDeductible` was a free checkbox: any donation
-- type (infaq/sedekah/wakaf/lainnya), not only zakat, could be flagged as
-- tax deductible and would then silently understate a family's net tax in
-- `TaxService.computeNetTax` on every read (via
-- `DonationsService.getTotalDeductibleAmount`). Server-side validation now
-- blocks new writes from doing this (`donations.service.ts`), and the read
-- path itself filters to the eligible types as defense in depth — but any
-- row written by the old, unvalidated code before this epic keeps
-- understating tax forever unless it is corrected here.
--
-- Additive + reversible: this only flips `isTaxDeductible` to `false` on
-- rows whose `type` cannot legally carry it (PP 60/2010 — only zakat paid
-- to an approved amil qualifies). No rows are deleted, no columns are
-- added or dropped, and the previous value is recoverable from any point-
-- in-time backup/WAL if this ever needs to be undone.
UPDATE "donations"
SET "isTaxDeductible" = false
WHERE "isTaxDeductible" = true
  AND "type" NOT IN ('zakat_maal'::"DonationType", 'zakat_fitrah'::"DonationType");
