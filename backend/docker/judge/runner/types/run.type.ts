import type { SupportedLanguage } from "./runner.type.ts";
import type { Verdict } from "./verdict.types.ts";

/**
 * One test case executed by a Run. `expectedOutput` is present only for
 * sample cases pulled from the database.
 */
export interface RunTestCase {
  id: string;
  stdin: string;
  expectedOutput?: string;
  isSample: boolean;
}

export interface RunTestCaseResult {
  testCaseId: string;
  isSample: boolean;
  /** Set for sample cases only; always null for custom ones. */
  verdict: Verdict | null;
  input: string;
  expectedOutput: string | null;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  executionTimeMs: number;
}

export interface RunOutcome {
  /** A run has no overall verdict; each sample case carries its own. */
  status: "OK" | "CE";
  compileError: string | null;
  passedSampleCases: number;
  totalSampleCases: number;
  executionTimeMs: number;
  results: RunTestCaseResult[];
}

export interface RunJobData {
  runId: string;
  userId: string;
  problemId: string;
  language: SupportedLanguage;
  sourceCode: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  testCases: RunTestCase[];
}
