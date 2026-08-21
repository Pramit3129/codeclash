import type { Verdict } from "./verdict.types.ts";

export type SupportedLanguage =
  | "python"
  | "javascript"
  | "java"
  | "cpp";

export interface RunRequest {
  language: SupportedLanguage;
  sourceCode: string;
  stdin: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  /** Bytes of stdout/stderr kept per test case. Defaults to 4 KB. */
  maxStoredOutputBytes?: number;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  memoryExceeded: boolean;
  outputExceeded: boolean;
  /** Output was longer than the stored preview — what you have is cut short. */
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
}

export interface RunProgress {
  totalTestCases: number;
  verdict: Verdict;
  testCaseId: string;
  passedTestCases: number;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  executionTimeMs: number;
  input?: string;
  expectedOutput?: string;
}
