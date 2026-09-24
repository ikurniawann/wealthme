-- EPIC-033 group 5 (p27/p29): the day of month an auto-debit runs.
ALTER TABLE "goals" ADD COLUMN "autoDebitDay" INTEGER;
ALTER TABLE "budgets" ADD COLUMN "autoDebitDay" INTEGER;
