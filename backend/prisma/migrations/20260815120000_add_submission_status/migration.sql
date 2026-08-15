-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Submission"
    ADD COLUMN "status" "SubmissionStatus" NOT NULL DEFAULT 'QUEUED',
    ADD COLUMN "failureReason" TEXT;

-- Backfill: existing rows that already carry a verdict are finished runs.
-- Rows without a verdict predate status tracking and cannot be resumed, so
-- they are marked FAILED rather than left indistinguishable from new work.
UPDATE "Submission" SET "status" = 'COMPLETED' WHERE "verdict" IS NOT NULL;
UPDATE "Submission"
   SET "status" = 'FAILED',
       "failureReason" = 'Predates status tracking; outcome unknown'
 WHERE "verdict" IS NULL;

-- CreateIndex
CREATE INDEX "Submission_status_createdAt_idx" ON "Submission"("status", "createdAt");
