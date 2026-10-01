-- Account identity is provider + number, not display name: a family can hold
-- two GoPay wallets (different phone numbers) under the same name.
DROP INDEX IF EXISTS "accounts_familyGroupId_name_key";

CREATE UNIQUE INDEX "accounts_familyGroupId_type_institution_maskedNumber_key"
  ON "accounts"("familyGroupId", "type", "institution", "maskedNumber");
