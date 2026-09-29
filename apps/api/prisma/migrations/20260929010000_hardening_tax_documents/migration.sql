-- Hardening batch G2: real tax document uploads (mirrors asset_attachments).
CREATE TABLE "tax_documents" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tax_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tax_documents_familyGroupId_taxYear_idx" ON "tax_documents"("familyGroupId", "taxYear");
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_familyGroupId_fkey"
  FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
