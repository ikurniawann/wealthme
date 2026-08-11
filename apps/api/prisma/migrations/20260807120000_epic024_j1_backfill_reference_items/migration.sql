-- EPIC-024 Task J (D14, US-MD-1) — backfill.
--
-- The new `reference_items` table (previous migration) is only ever seeded
-- for family groups going forward (`auth.service.ts` register() and the web
-- Better-Auth `user.create.after` hook, both updated in this task). Every
-- family group created BEFORE this task has no rows here at all — its
-- `/masterdata` page would render seven empty groups the owner cannot use
-- since seeded defaults are what makes "system" items exist in the first
-- place. This backfill inserts the same `REFERENCE_ITEM_DEFAULTS` seed
-- (`@wealthme/contracts`) for every existing family group, exactly once.
--
-- Additive + idempotent: `ON CONFLICT ("familyGroupId", "group", "label") DO
-- NOTHING` makes this safe to run more than once and safe to run against a
-- family group a concurrent registration has already seeded — no rows are
-- ever deleted or overwritten. `sortOrder` mirrors the array index order in
-- `REFERENCE_ITEM_DEFAULTS`; keep the two in sync if the defaults change.
INSERT INTO "reference_items" ("id", "familyGroupId", "group", "label", "sortOrder", "isSystem", "createdAt")
SELECT gen_random_uuid(), fg."id", defaults."group"::"ReferenceItemGroup", defaults."label", defaults."sortOrder", true, CURRENT_TIMESTAMP
FROM "family_groups" fg
CROSS JOIN (
  VALUES
    ('bank', 'BCA', 0),
    ('bank', 'Mandiri', 1),
    ('bank', 'BNI', 2),
    ('bank', 'BRI', 3),
    ('bank', 'CIMB Niaga', 4),
    ('bank', 'Permata', 5),
    ('ewallet', 'GoPay', 0),
    ('ewallet', 'OVO', 1),
    ('ewallet', 'DANA', 2),
    ('ewallet', 'LinkAja', 3),
    ('ewallet', 'ShopeePay', 4),
    ('txntype', 'Pemasukan', 0),
    ('txntype', 'Pengeluaran', 1),
    ('txntype', 'Transfer', 2),
    ('txntype', 'Kartu Kredit', 3),
    ('invtype', 'Saham', 0),
    ('invtype', 'Reksa Dana', 1),
    ('invtype', 'Obligasi', 2),
    ('invtype', 'Emas', 3),
    ('invtype', 'Crypto', 4),
    ('lembaga', 'BAZNAS', 0),
    ('lembaga', 'Dompet Dhuafa', 1),
    ('lembaga', 'Gereja / Paroki', 2),
    ('lembaga', 'Pura / Vihara', 3),
    ('asettype', 'Properti', 0),
    ('asettype', 'Kendaraan', 1),
    ('asettype', 'Elektronik', 2),
    ('asettype', 'Perhiasan', 3),
    ('instype', 'Jiwa', 0),
    ('instype', 'Kesehatan', 1),
    ('instype', 'Kendaraan', 2),
    ('instype', 'Properti', 3)
) AS defaults("group", "label", "sortOrder")
ON CONFLICT ("familyGroupId", "group", "label") DO NOTHING;
