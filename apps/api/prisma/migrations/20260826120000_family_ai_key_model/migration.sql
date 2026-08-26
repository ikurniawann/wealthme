-- Lets a family pick WHICH model of their provider WealthMe uses.
--
-- Nullable on purpose: every existing row keeps working and keeps whatever the
-- code defaults to. Choosing a model is opt-in, and clearing it returns the
-- family to the default rather than breaking their AI features.
ALTER TABLE "family_ai_keys" ADD COLUMN "model" TEXT;
