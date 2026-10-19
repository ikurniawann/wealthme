-- Kas & E-Wallet: storage location, net-worth opt-out, last balance check.
ALTER TABLE "accounts" ADD COLUMN "storageLocation" VARCHAR(120),
ADD COLUMN "includeInNetWorth" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "lastReconciledAt" TIMESTAMP(3);
