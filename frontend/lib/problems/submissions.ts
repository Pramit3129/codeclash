import { apiJson } from "@/lib/auth/apiClient";
import { API_URL } from "@/lib/auth/config";
import { tokenStore } from "@/lib/auth/tokenStore";
import type {
  Language,
  CreateSubmissionResponse,
  GetSubmissionResponse,
  JudgeProgressEvent,
  JudgeVerdictEvent,
} from "./types";

const LANGUAGE_API_MAP: Record<Language, string> = {
  PYTHON: "python",
  JAVASCRIPT: "javascript",
  JAVA: "java",
  CPP: "cpp",
};

// ─── REST API ───────────────────────────────────────────────────────

export async function createSubmission(
  problemId: string,
  language: Language,
  sourceCode: string,
): Promise<CreateSubmissionResponse> {
  return apiJson<CreateSubmissionResponse>("/api/submissions", {
    method: "POST",
    body: JSON.stringify({
      problemId,
      language: LANGUAGE_API_MAP[language],
      sourceCode,
    }),
  });
}

export async function getSubmission(
  submissionId: string,
): Promise<GetSubmissionResponse> {
  return apiJson<GetSubmissionResponse>(
    `/api/submissions/${submissionId}`,
  );
}

// ─── SSE Event Source ───────────────────────────────────────────────

export interface JudgeStreamCallbacks {
  onProgress: (event: JudgeProgressEvent) => void;
  onVerdict: (event: JudgeVerdictEvent) => void;
  onError: (error: Event) => void;
  onOpen: () => void;
}

/**
 * Opens an SSE connection to the judge stream.
 * Returns a cleanup function to close the connection.
 *
 * Uses EventSource with the auth token appended as a query param
 * (EventSource doesn't support custom headers).
 */
export function connectJudgeStream(
  submissionId: string,
  callbacks: JudgeStreamCallbacks,
): () => void {
  const token = tokenStore.get();

  const params = new URLSearchParams();
  if (token) params.set("token", token);

  const url = `${API_URL}/api/submissions/${submissionId}/judgeStream?${params.toString()}`;

  const eventSource = new EventSource(url);

  eventSource.onopen = () => {
    callbacks.onOpen();
  };

  eventSource.addEventListener("PROGRESS", ((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      callbacks.onProgress(data.result ?? data);
    } catch {
      // Malformed event data — ignore
    }
  }) as EventListener);

  eventSource.addEventListener("VERDICT", ((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      callbacks.onVerdict(data.result ?? data);
    } catch {
      // Malformed event data — ignore
    }
  }) as EventListener);

  eventSource.onerror = (error) => {
    callbacks.onError(error);
  };

  return () => {
    eventSource.close();
  };
}
