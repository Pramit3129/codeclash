import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../../src/lib/prisma.js";

import type {
  JudgeResult,
  TestResult,
} from "./verdict.types.ts";

import type {
  SupportedLanguage,
} from "./runner.type.ts";

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
  constructor(
    private readonly prisma?: PrismaClient,
  ) {}

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
   * Persists a finished judge run.
   *
   * IDEMPOTENT: a BullMQ job can be retried or replayed after a stall,
   * so this may run more than once for the same submission. Nested
   * `create` would violate @@unique([submissionId, testCaseId]) on the
   * second run and fail the job permanently, so per-test rows are
   * upserted and the whole write is wrapped in one transaction — a
   * submission never ends up with a verdict but partial test rows.
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

      /*
       * A replay can produce fewer test rows than a previous attempt
       * (judging stops at the first failure). Drop stale rows so the
       * persisted results always match this run.
       */
      await tx.submissionTestResult.deleteMany({
        where: {
          submissionId,

          testCaseId: {
            notIn: result.testResults.map(
              (testResult) => testResult.testCaseId,
            ),
          },
        },
      });

      return tx.submission.update({
        where: {
          id: submissionId,
        },

        data: {
          status: "COMPLETED",

          verdict: verdictMap[result.verdict],

          passedTestCases:
            result.passedTestCases,

          totalTestCases:
            result.totalTestCases,

          failedTestCaseId:
            result.failedTestCaseId,

          executionTimeMs:
            result.executionTimeMs,
        },

        include: {
          testResults: true,
        },
      });
    });
  }

  /**
   * Marks a submission as picked up by a worker. Distinguishes QUEUED
   * from RUNNING so a submission stuck because its worker died is
   * identifiable rather than looking like it is still waiting.
   */
  async markRunning(submissionId: string) {
    return this.db.submission.update({
      where: { id: submissionId },
      data: { status: "RUNNING" },
    });
  }

  /**
   * Safety net for submissions stranded in RUNNING by a worker that
   * died between markRunning() and createResult().
   *
   * BullMQ normally redelivers such a job through stalled-job recovery,
   * which re-runs it and reaches a terminal state on its own. This
   * covers only the case where the job is gone from Redis entirely
   * (flushed, evicted, or lost), which nothing else would ever resolve.
   *
   * `olderThanMs` must comfortably exceed the longest legitimate judge
   * run so an in-flight submission is never stolen from a live worker.
   */
  async failStrandedRunning({
    olderThanMs,
  }: {
    olderThanMs: number;
  }) {
    const cutoff = new Date(Date.now() - olderThanMs);

    const result = await this.db.submission.updateMany({
      where: {
        status: "RUNNING",
        createdAt: { lt: cutoff },
      },

      data: {
        status: "FAILED",
        failureReason:
          "Worker terminated before the submission finished judging",
      },
    });

    return result.count;
  }

  /**
   * Terminal state for an INFRASTRUCTURE failure (Docker unavailable,
   * database error, misconfiguration) — explicitly not a judge verdict.
   *
   * Recording FAILED rather than a verdict keeps infrastructure faults
   * from being reported to users as WA/RE, and stops submissions from
   * sitting at verdict = null forever.
   */
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

        /*
         * Truncated: this string is surfaced through the API and must
         * stay bounded regardless of the underlying error.
         */
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

        passedTestCases:
          result.passedTestCases,

        totalTestCases:
          result.totalTestCases,

        failedTestCaseId:
          result.failedTestCaseId,

        executionTimeMs:
          result.executionTimeMs,

        testResults: {
          create: result.testResults.map(
            (testResult) => ({
              testCaseId:
                testResult.testCaseId,

              verdict:
                verdictMap[
                  testResult.verdict
                ],

              stdout:
                testResult.stdout,

              stderr:
                testResult.stderr,

              exitCode:
                testResult.exitCode,

              executionTimeMs:
                testResult.executionTimeMs,
            }),
          ),
        },
      },

      include: {
        testResults: true,
      },
    });
  }
}