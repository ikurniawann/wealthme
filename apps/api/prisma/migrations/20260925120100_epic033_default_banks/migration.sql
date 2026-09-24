-- EPIC-033 p4: default bank list is BCA, Mandiri, BRI, BNI, CIMB, OCBC.
-- Rename the seeded rows in place so existing families match the new
-- defaults; owner-added rows (isSystem = false) are left alone. A family
-- that already added its own "CIMB"/"OCBC" would collide on the unique
-- (familyGroupId, group, label) index, so those are skipped.
UPDATE "reference_items" r
SET "label" = 'CIMB'
WHERE r."group" = 'bank' AND r."isSystem" = true AND r."label" = 'CIMB Niaga'
  AND NOT EXISTS (
    SELECT 1 FROM "reference_items" x
    WHERE x."familyGroupId" = r."familyGroupId" AND x."group" = 'bank' AND x."label" = 'CIMB'
  );

UPDATE "reference_items" r
SET "label" = 'OCBC'
WHERE r."group" = 'bank' AND r."isSystem" = true AND r."label" = 'Permata'
  AND NOT EXISTS (
    SELECT 1 FROM "reference_items" x
    WHERE x."familyGroupId" = r."familyGroupId" AND x."group" = 'bank' AND x."label" = 'OCBC'
  );
