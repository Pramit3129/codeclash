import { apiJson } from "@/lib/auth/apiClient";
import type {
  Language,
  RunTestCaseInput,
  RunResponse,
} from "./types";

const LANGUAGE_API_MAP: Record<Language, string> = {
  PYTHON: "python",
  JAVASCRIPT: "javascript",
  JAVA: "java",
  CPP: "cpp",
};

export async function runCode(
  problemId: string,
  language: Language,
  sourceCode: string,
  testCases?: RunTestCaseInput[],
): Promise<RunResponse> {
  return apiJson<RunResponse>("/api/run", {
    method: "POST",
    body: JSON.stringify({
      problemId,
      language: LANGUAGE_API_MAP[language],
      sourceCode,
      testCases,
    }),
  });
}
