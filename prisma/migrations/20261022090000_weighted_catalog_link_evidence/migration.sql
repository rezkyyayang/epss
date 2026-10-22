-- DropForeignKey
ALTER TABLE "Aspect" DROP CONSTRAINT "Aspect_domainId_fkey";

-- DropForeignKey
ALTER TABLE "Indicator" DROP CONSTRAINT "Indicator_aspectId_fkey";

-- DropForeignKey
ALTER TABLE "Evidence" DROP CONSTRAINT "Evidence_uploadedById_fkey";

-- DropIndex
DROP INDEX "Indicator_aspectId_position_idx";

-- DropIndex
DROP INDEX "Indicator_aspectId_code_key";

-- DropIndex
DROP INDEX "Evidence_storageKey_key";

-- AlterTable
ALTER TABLE "Domain" ADD COLUMN     "weight" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Indicator" DROP COLUMN "aspectId",
ADD COLUMN     "domainId" TEXT NOT NULL,
ADD COLUMN     "weight" INTEGER NOT NULL,
ALTER COLUMN "criterion" SET DEFAULT '';

-- AlterTable
ALTER TABLE "MaturityLevel" DROP COLUMN "name";

-- AlterTable
ALTER TABLE "Evidence" DROP COLUMN "contentType",
DROP COLUMN "originalName",
DROP COLUMN "scanStatus",
DROP COLUMN "scannedAt",
DROP COLUMN "sha256",
DROP COLUMN "sizeBytes",
DROP COLUMN "storageKey",
DROP COLUMN "uploadedById",
ADD COLUMN     "addedById" TEXT NOT NULL,
ADD COLUMN     "url" TEXT NOT NULL;

-- DropTable
DROP TABLE "Aspect";

-- DropTable
DROP TABLE "EvidencePolicy";

-- DropEnum
DROP TYPE "EvidenceScanStatus";

-- CreateIndex
CREATE INDEX "Indicator_domainId_position_idx" ON "Indicator"("domainId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Indicator_domainId_code_key" ON "Indicator"("domainId", "code");

-- AddForeignKey
ALTER TABLE "Indicator" ADD CONSTRAINT "Indicator_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
