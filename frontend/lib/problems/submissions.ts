import { apiJson } from "@/lib/auth/apiClient";
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
 * Opens an SSE connection to the judge stream via the Next.js proxy route.
 * Returns a cleanup function to close the connection.
 *
 * Uses a same-origin proxy to avoid CORS issues with cross-origin EventSource.
 */
export function connectJudgeStream(
  submissionId: string,
  callbacks: JudgeStreamCallbacks,
): () => void {
  const token = tokenStore.get();

  const params = new URLSearchParams();
  if (token) params.set("token", token);

  // Route through the Next.js proxy to avoid cross-origin EventSource issues
  const url = `/api/submissions/${submissionId}/judgeStream?${params.toString()}`;

  const eventSource = new EventSource(url);
  let errored = false;

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
    if (errored) return;
    errored = true;
    eventSource.close();
    callbacks.onError(error);
  };

  return () => {
    eventSource.close();
  };
}
