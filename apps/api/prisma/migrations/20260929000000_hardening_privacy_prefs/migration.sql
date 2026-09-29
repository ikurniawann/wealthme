-- Hardening batch G1: add users.privacyPrefs (additive, nullable JSON).
ALTER TABLE "users" ADD COLUMN "privacyPrefs" JSONB;
