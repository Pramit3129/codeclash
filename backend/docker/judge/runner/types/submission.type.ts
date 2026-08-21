import type { SupportedLanguage } from "./runner.type.ts";
import type { JudgeResult } from "./verdict.types.ts";

export interface Submission {
  id: string;
  userId: string;
  problemId: string;
  language: SupportedLanguage;
  sourceCode: string;
  result: JudgeResult;
  createdAt: Date;
}
