-- EPIC-032 R1: istri = Co-Master (spouse), never a second owner.
-- Only members flagged relationship = istri are touched; the head never is.
UPDATE "members" SET "role" = 'spouse'
WHERE "relationship" = 'istri' AND "role" = 'owner';
