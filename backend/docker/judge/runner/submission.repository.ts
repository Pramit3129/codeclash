import { PrismaClient } from "@prisma/client";

import type {
  JudgeResult,
  TestResult,
} from "./verdict.types.ts";

import type {
  SupportedLanguage,
} from "./runner.type.ts";

const languageMap = {
  python: "PYTHON",
  java: "JAVA",
  "c++": "CPP",
  js: "JAVASCRIPT",
} as const;

const verdictMap = {
  AC: "AC",
  WA: "WA",
  TLE: "TLE",
  MLE: "MLE",
  RE: "RE",
  OLE: "OLE",
} as const;

export class SubmissionRepository {
  constructor(
    private readonly prisma: PrismaClient,
  ) {}

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
    return this.prisma.submission.create({
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