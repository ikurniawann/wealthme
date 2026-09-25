-- EPIC-033 p14: documents attached to a physical asset.
CREATE TABLE "asset_attachments" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asset_attachments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "asset_attachments_assetId_familyGroupId_idx" ON "asset_attachments"("assetId", "familyGroupId");
ALTER TABLE "asset_attachments" ADD CONSTRAINT "asset_attachments_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
