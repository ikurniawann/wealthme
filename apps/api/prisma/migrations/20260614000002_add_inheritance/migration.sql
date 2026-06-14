-- CreateEnum
CREATE TYPE "InheritanceVisibility" AS ENUM ('private', 'heirs_only', 'all_members');

-- CreateTable
CREATE TABLE "inheritance_assets" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "assetType" VARCHAR(100) NOT NULL,
    "estimatedValue" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IDR',
    "notes" TEXT,
    "visibility" "InheritanceVisibility" NOT NULL DEFAULT 'heirs_only',
    "documentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inheritance_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inheritance_heirs" (
    "id" TEXT NOT NULL,
    "inheritanceAssetId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "relationship" VARCHAR(100) NOT NULL,
    "sharePercent" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inheritance_heirs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inheritance_assets_familyGroupId_idx" ON "inheritance_assets"("familyGroupId");

-- CreateIndex
CREATE INDEX "inheritance_heirs_inheritanceAssetId_idx" ON "inheritance_heirs"("inheritanceAssetId");

-- AddForeignKey
ALTER TABLE "inheritance_assets" ADD CONSTRAINT "inheritance_assets_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inheritance_heirs" ADD CONSTRAINT "inheritance_heirs_inheritanceAssetId_fkey" FOREIGN KEY ("inheritanceAssetId") REFERENCES "inheritance_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
