export type Verdict =
  | "AC"
  | "WA"
  | "TLE"
  | "MLE"
  | "RE"
  | "OLE"
  | "CE";

export interface TestResult {
  testCaseId: string;
  verdict: Verdict;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  executionTimeMs: number;
}

export interface JudgeResult {
  verdict: Verdict;
  passedTestCases: number;
  totalTestCases: number;
  failedTestCaseId: string | null;
  executionTimeMs: number;
  testResults: TestResult[];
}
