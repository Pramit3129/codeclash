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
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  memoryExceeded: boolean;
  outputExceeded: boolean;
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
