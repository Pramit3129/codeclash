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