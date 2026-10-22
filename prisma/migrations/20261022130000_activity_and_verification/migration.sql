-- AlterEnum
BEGIN;
CREATE TYPE "AssessmentStatus_new" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'VERIFIED');
ALTER TABLE "Assessment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Assessment" ALTER COLUMN "status" TYPE "AssessmentStatus_new" USING ("status"::text::"AssessmentStatus_new");
ALTER TABLE "StatusEvent" ALTER COLUMN "fromStatus" TYPE "AssessmentStatus_new" USING ("fromStatus"::text::"AssessmentStatus_new");
ALTER TABLE "StatusEvent" ALTER COLUMN "toStatus" TYPE "AssessmentStatus_new" USING ("toStatus"::text::"AssessmentStatus_new");
ALTER TYPE "AssessmentStatus" RENAME TO "AssessmentStatus_old";
ALTER TYPE "AssessmentStatus_new" RENAME TO "AssessmentStatus";
DROP TYPE "AssessmentStatus_old";
ALTER TABLE "Assessment" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- DropForeignKey
ALTER TABLE "ReviewDecision" DROP CONSTRAINT "ReviewDecision_responseId_fkey";

-- DropForeignKey
ALTER TABLE "ReviewDecision" DROP CONSTRAINT "ReviewDecision_reviewerId_fkey";

-- DropIndex
DROP INDEX "AssessmentResponse_assessmentId_status_idx";

-- AlterTable
ALTER TABLE "Assessment" DROP COLUMN "approvedAt",
ADD COLUMN     "activityName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "activityYear" INTEGER,
ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AssessmentResponse" DROP COLUMN "status";

-- DropTable
DROP TABLE "ReviewDecision";

-- DropEnum
DROP TYPE "ResponseStatus";

-- DropEnum
DROP TYPE "ReviewOutcome";

-- CreateTable
CREATE TABLE "ResponseVerification" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "maturityLevelId" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "verifierId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResponseVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResponseVerification_responseId_key" ON "ResponseVerification"("responseId");

-- CreateIndex
CREATE INDEX "ResponseVerification_verifierId_updatedAt_idx" ON "ResponseVerification"("verifierId", "updatedAt");

-- AddForeignKey
ALTER TABLE "ResponseVerification" ADD CONSTRAINT "ResponseVerification_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "AssessmentResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseVerification" ADD CONSTRAINT "ResponseVerification_maturityLevelId_fkey" FOREIGN KEY ("maturityLevelId") REFERENCES "MaturityLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseVerification" ADD CONSTRAINT "ResponseVerification_verifierId_fkey" FOREIGN KEY ("verifierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

