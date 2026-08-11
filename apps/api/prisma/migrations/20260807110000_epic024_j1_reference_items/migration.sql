-- EPIC-024 Task J (D14, US-MD-1) — real per-family-group master data for the
-- seven reference lists that used to be hardcoded arrays in
-- `masterdata/page.tsx` ("Master data is a client-side illusion" — Evidence).
-- Additive only: no DROP, no DELETE, no TRUNCATE.

-- CreateEnum
CREATE TYPE "ReferenceItemGroup" AS ENUM ('bank', 'ewallet', 'txntype', 'invtype', 'lembaga', 'asettype', 'instype');

-- CreateTable
CREATE TABLE "reference_items" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "group" "ReferenceItemGroup" NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reference_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reference_items_familyGroupId_group_idx" ON "reference_items"("familyGroupId", "group");

-- CreateIndex
CREATE UNIQUE INDEX "reference_items_familyGroupId_group_label_key" ON "reference_items"("familyGroupId", "group", "label");

-- AddForeignKey
ALTER TABLE "reference_items" ADD CONSTRAINT "reference_items_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
