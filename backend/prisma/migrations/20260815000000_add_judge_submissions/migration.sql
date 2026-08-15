-- CreateEnum
CREATE TYPE "SubmissionLanguage" AS ENUM ('PYTHON', 'JAVA', 'CPP', 'JAVASCRIPT');

-- CreateEnum
CREATE TYPE "SubmissionVerdict" AS ENUM ('AC', 'WA', 'TLE', 'MLE', 'RE', 'OLE');

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "language" "SubmissionLanguage" NOT NULL,
    "sourceCode" TEXT NOT NULL,
    "verdict" "SubmissionVerdict",
    "passedTestCases" INTEGER NOT NULL DEFAULT 0,
    "totalTestCases" INTEGER NOT NULL DEFAULT 0,
    "failedTestCaseId" TEXT,
    "executionTimeMs" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionTestResult" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "verdict" "SubmissionVerdict" NOT NULL,
    "stdout" TEXT NOT NULL DEFAULT '',
    "stderr" TEXT NOT NULL DEFAULT '',
    "exitCode" INTEGER,
    "executionTimeMs" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SubmissionTestResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestCase_problemId_idx" ON "TestCase"("problemId");

-- CreateIndex
CREATE INDEX "Submission_userId_createdAt_idx" ON "Submission"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Submission_problemId_createdAt_idx" ON "Submission"("problemId", "createdAt");

-- CreateIndex
CREATE INDEX "Submission_verdict_idx" ON "Submission"("verdict");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionTestResult_submissionId_testCaseId_key" ON "SubmissionTestResult"("submissionId", "testCaseId");

-- CreateIndex
CREATE INDEX "SubmissionTestResult_submissionId_idx" ON "SubmissionTestResult"("submissionId");

-- CreateIndex
CREATE INDEX "SubmissionTestResult_testCaseId_idx" ON "SubmissionTestResult"("testCaseId");

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionTestResult" ADD CONSTRAINT "SubmissionTestResult_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionTestResult" ADD CONSTRAINT "SubmissionTestResult_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
