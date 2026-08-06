-- EPIC-023 Group F fix round (MEDIUM 9) — "not yet chosen" was not
-- representable: F2's `religion FamilyReligion @default(islam)` asserted a
-- faith on every pre-existing family with no state distinguishing "the
-- owner explicitly chose islam" from "this family never touched the
-- setting". This migration makes the column nullable so the missing fourth
-- state ("unconfirmed") is representable, and backfills every row that
-- currently sits on the unconditional default back to that honest state.
-- Sorts after 20260806160000_epic023_f3_split_bill_confirm_and_payout.
--
-- No DROP TYPE, no DELETE, no TRUNCATE — additive/widening only.
--
-- Known limitation (documented, not silently swept under the rug): an
-- owner who explicitly re-selected 'islam' via PATCH .../religion in the
-- few hours between F2 shipping and this fix is, in the data available,
-- indistinguishable from a family that never touched the setting — both
-- currently read 'islam'. Given F2 landed only hours before this fix in
-- the same epic (no real family has had the setting long enough for an
-- explicit re-confirmation to be a meaningful signal we'd be discarding),
-- collapsing both to "unconfirmed" here is preferred over leaving the
-- fabricated default in place indefinitely.

ALTER TABLE "family_groups" ALTER COLUMN "religion" DROP DEFAULT;
ALTER TABLE "family_groups" ALTER COLUMN "religion" DROP NOT NULL;

UPDATE "family_groups" SET "religion" = NULL WHERE "religion" = 'islam';
