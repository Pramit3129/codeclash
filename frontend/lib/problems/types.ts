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

export interface TestResult {
  testCaseId: string;
  passed: boolean;
  verdict: SubmissionVerdict;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
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
}

export interface JudgeVerdictEvent {
  verdict: SubmissionVerdict;
  passedTestCases: number;
  totalTestCases: number;
  failedTestCaseId: string | null;
  executionTimeMs: number;
  testResults: TestResult[];
}
