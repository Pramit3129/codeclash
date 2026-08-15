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

  async createResult({
    submissionId,
    result,
  }: {
    submissionId: string;
    result: JudgeResult;
  }) {
    return this.db.submission.update({
      where: {
        id: submissionId,
      },

      data: {
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