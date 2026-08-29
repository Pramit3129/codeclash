export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export type Language = "PYTHON" | "JAVASCRIPT" | "JAVA" | "CPP";

export interface ProblemListItem {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
}

export interface ProblemListResponse {
  success: boolean;
  problems: {
    items: ProblemListItem[];
    nextCursor: string | null;
  };
}

export interface StarterCode {
  PYTHON: string;
  JAVASCRIPT: string;
  JAVA: string;
  CPP: string;
}

export interface SampleTestCase {
  ordinal: number;
  input: string;
  expectedOutput: string;
  isSample?: boolean;
}

export interface ProblemDetails {
  id: string;
  slug: string;
  title: string;
  statementMd: string;
  constraintsMd: string | null;
  difficulty: Difficulty;
  timeLimitMs: number;
  memoryLimitMb: number;
  starterCode: StarterCode;
  testCases: SampleTestCase[];
}

export interface ProblemDetailResponse {
  success: boolean;
  problemDetails: ProblemDetails;
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
};

export const LANGUAGE_LABELS: Record<Language, string> = {
  PYTHON: "Python",
  JAVASCRIPT: "JavaScript",
  JAVA: "Java",
  CPP: "C++",
};

export const MONACO_LANGUAGE_MAP: Record<Language, string> = {
  PYTHON: "python",
  JAVASCRIPT: "javascript",
  JAVA: "java",
  CPP: "cpp",
};

export const ALL_LANGUAGES: Language[] = ["PYTHON", "JAVASCRIPT", "JAVA", "CPP"];

// ─── Submission Types ───────────────────────────────────────────────

export type SubmissionStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED";

export type SubmissionVerdict =
  | "AC"
  | "WA"
  | "TLE"
  | "RE"
  | "CE"
  | "MLE"
  | "SE"
  | null;

/**
 * Mirrors SubmissionTestResult in the backend schema. There is no `passed`
 * column — a test passed when its verdict is "AC".
 */
export interface TestResult {
  testCaseId: string;
  verdict: SubmissionVerdict;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  executionTimeMs: number;
  input?: string;
  expectedOutput?: string;
}

/**
 * Fields marked optional are absent from the 202 response of
 * POST /api/submissions, which returns a freshly queued submission before
 * the judge has run. They are filled in by GET /api/submissions/:id and by
 * the VERDICT event.
 */
export interface Submission {
  id: string;
  problemId?: string;
  language?: Language;
  status: SubmissionStatus;
  verdict: SubmissionVerdict;
  totalTestCases: number;
  passedTestCases: number;
  testResults?: TestResult[];
  createdAt: string;
}

export interface CreateSubmissionResponse {
  success: boolean;
  submission: Submission;
}

export interface GetSubmissionResponse {
  success: boolean;
  submission: Submission;
}

export interface JudgeProgressEvent {
  testCaseId: string;
  passedTestCases: number;
  totalTestCases: number;
  verdict: SubmissionVerdict;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  input?: string;
  expectedOutput?: string;
}

export interface JudgeVerdictEvent {
  verdict: SubmissionVerdict;
  passedTestCases: number;
  totalTestCases: number;
  failedTestCaseId: string | null;
  executionTimeMs: number;
  testResults: TestResult[];
}

// ─── Run Types ───────────────────────────────────────────────────────

export interface RunTestCaseInput {
  ordinal?: number;
  isSample?: boolean;
  input?: string;
}

export interface RunTestCaseResult {
  testCaseId: string;
  isSample: boolean;
  verdict: SubmissionVerdict | null;
  input: string;
  expectedOutput: string | null;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  executionTimeMs: number;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  skipped: boolean;
}

export interface RunOutcome {
  status: "OK" | "CE";
  compileError: string | null;
  passedSampleCases: number;
  totalSampleCases: number;
  executionTimeMs: number;
  budgetExceeded: boolean;
  results: RunTestCaseResult[];
}

export interface RunResponse {
  success: boolean;
  run: RunOutcome;
}

export interface TestCaseItem {
  id: string;
  ordinal?: number;
  isSample: boolean;
  input: string;
  expectedOutput?: string;
}

