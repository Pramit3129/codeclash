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
