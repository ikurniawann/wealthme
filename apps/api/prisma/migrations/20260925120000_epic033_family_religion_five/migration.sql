-- EPIC-033 R1: five family religions. Katolik shares the tithe calculator
-- with Kristen; Hindu and Buddha record general donations only.
ALTER TYPE "FamilyReligion" ADD VALUE IF NOT EXISTS 'katolik';
ALTER TYPE "FamilyReligion" ADD VALUE IF NOT EXISTS 'hindu';
ALTER TYPE "FamilyReligion" ADD VALUE IF NOT EXISTS 'buddha';
