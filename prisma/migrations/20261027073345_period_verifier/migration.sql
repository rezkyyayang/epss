-- AlterTable
ALTER TABLE "PeriodAssignment" ADD COLUMN     "verifierId" TEXT;

-- CreateIndex
CREATE INDEX "PeriodAssignment_verifierId_periodId_idx" ON "PeriodAssignment"("verifierId", "periodId");

-- AddForeignKey
ALTER TABLE "PeriodAssignment" ADD CONSTRAINT "PeriodAssignment_verifierId_fkey" FOREIGN KEY ("verifierId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
