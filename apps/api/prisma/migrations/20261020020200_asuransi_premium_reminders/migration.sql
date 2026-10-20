-- Asuransi Task 22: premium reminder dedupe (one reminder per policy per due date).
-- CreateTable
CREATE TABLE "insurance_premium_reminders" (
    "id" TEXT NOT NULL,
    "insuranceId" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insurance_premium_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "insurance_premium_reminders_insuranceId_dueDate_key" ON "insurance_premium_reminders"("insuranceId", "dueDate");

-- AddForeignKey
ALTER TABLE "insurance_premium_reminders" ADD CONSTRAINT "insurance_premium_reminders_insuranceId_fkey" FOREIGN KEY ("insuranceId") REFERENCES "insurances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
