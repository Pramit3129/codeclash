import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../../../src/lib/prisma.js";

import type { JudgeResult } from "../types/verdict.types.ts";
import type { SupportedLanguage } from "../types/runner.type.ts";

const languageMap = {
  python: "PYTHON",
  javascript: "JAVASCRIPT",
  js: "JAVASCRIPT",
  java: "JAVA",
  cpp: "CPP",
  "c++": "CPP",
} as const;

const verdictMap = {
  AC: "AC",
  WA: "WA",
  TLE: "TLE",
  MLE: "MLE",
  RE: "RE",
  OLE: "OLE",
  CE: "CE",
} as const;

export class SubmissionRepository {
  constructor(private readonly prisma?: PrismaClient) {}

  private get db(): PrismaClient {
    return this.prisma || defaultPrisma;
  }

  async createQueued({
    userId,
    problemId,
    language,
    sourceCode,
    totalTestCases,
  }: {
    userId: string;
    problemId: string;
    language: SupportedLanguage;
    sourceCode: string;
    totalTestCases: number;
  }) {
    return this.db.submission.create({
      data: {
        userId,
        problemId,
        language: languageMap[language],
        sourceCode,
        verdict: null,
        totalTestCases,
      },
    });
  }

  /**
   * Persists finished judge run results idempotently in a transaction.
   */
  async createResult({
    submissionId,
    result,
  }: {
    submissionId: string;
    result: JudgeResult;
  }) {
    return this.db.$transaction(async (tx) => {
      for (const testResult of result.testResults) {
        const row = {
          verdict: verdictMap[testResult.verdict],
          stdout: testResult.stdout,
          stderr: testResult.stderr,
          exitCode: testResult.exitCode,
          executionTimeMs: testResult.executionTimeMs,
        };

        await tx.submissionTestResult.upsert({
          where: {
            submissionId_testCaseId: {
              submissionId,
              testCaseId: testResult.testCaseId,
            },
          },
          create: {
            submissionId,
            testCaseId: testResult.testCaseId,
            ...row,
          },
          update: row,
        });
      }

      await tx.submissionTestResult.deleteMany({
        where: {
          submissionId,
          testCaseId: {
            notIn: result.testResults.map((t) => t.testCaseId),
          },
        },
      });

      return tx.submission.update({
        where: { id: submissionId },
        data: {
          status: "COMPLETED",
          verdict: verdictMap[result.verdict],
          passedTestCases: result.passedTestCases,
          totalTestCases: result.totalTestCases,
          failedTestCaseId: result.failedTestCaseId,
          executionTimeMs: result.executionTimeMs,
        },
        include: {
          testResults: true,
        },
      });
    });
  }

  async markRunning(submissionId: string) {
    return this.db.submission.update({
      where: { id: submissionId },
      data: { status: "RUNNING" },
    });
  }

  async failStrandedRunning({ olderThanMs }: { olderThanMs: number }) {
    const cutoff = new Date(Date.now() - olderThanMs);
    const result = await this.db.submission.updateMany({
      where: {
        status: "RUNNING",
        createdAt: { lt: cutoff },
      },
      data: {
        status: "FAILED",
        failureReason: "Worker terminated before the submission finished judging",
      },
    });
    return result.count;
  }

  async markFailed({
    submissionId,
    reason,
  }: {
    submissionId: string;
    reason: string;
  }) {
    return this.db.submission.update({
      where: { id: submissionId },
      data: {
        status: "FAILED",
        verdict: null,
        failureReason: reason.slice(0, 500),
      },
    });
  }

  async create({
    userId,
    problemId,
    language,
    sourceCode,
    result,
  }: {
    userId: string;
    problemId: string;
    language: SupportedLanguage;
    sourceCode: string;
    result: JudgeResult;
  }) {
    return this.db.submission.create({
      data: {
        userId,
        problemId,
        language: languageMap[language],
        sourceCode,
        verdict: verdictMap[result.verdict],
        passedTestCases: result.passedTestCases,
        totalTestCases: result.totalTestCases,
        failedTestCaseId: result.failedTestCaseId,
        executionTimeMs: result.executionTimeMs,
        testResults: {
          create: result.testResults.map((testResult) => ({
            testCaseId: testResult.testCaseId,
            verdict: verdictMap[testResult.verdict],
            stdout: testResult.stdout,
            stderr: testResult.stderr,
            exitCode: testResult.exitCode,
            executionTimeMs: testResult.executionTimeMs,
          })),
        },
      },
      include: {
        testResults: true,
      },
    });
  }
}
