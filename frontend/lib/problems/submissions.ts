import { apiJson } from "@/lib/auth/apiClient";
import { API_URL } from "@/lib/auth/config";
import { tokenStore } from "@/lib/auth/tokenStore";
import type {
  Language,
  Submission,
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
 * Opens an SSE connection to the judge stream on the backend.
 * Returns a cleanup function to close the connection.
 *
 * EventSource cannot set an Authorization header, so the access token is
 * passed as a query parameter. The backend sends CORS headers for this
 * origin, so the connection is made directly instead of through a proxy.
 */
export function connectJudgeStream(
  submissionId: string,
  callbacks: JudgeStreamCallbacks,
): () => void {
  const token = tokenStore.get();

  const params = new URLSearchParams();
  if (token) params.set("token", token);

  const url = `${API_URL}/api/submissions/${submissionId}/judgeStream?${params.toString()}`;

  const eventSource = new EventSource(url, { withCredentials: true });
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

/**
 * Fallback for when the SSE stream is unavailable: polls the durable
 * submission record until it reaches a terminal state (or the attempt
 * budget runs out). Returns a cancel function.
 */
export function pollSubmission(
  submissionId: string,
  onUpdate: (submission: Submission) => void,
  {
    intervalMs = 1500,
    maxAttempts = 40,
    onExhausted,
  }: {
    intervalMs?: number;
    maxAttempts?: number;
    onExhausted?: () => void;
  } = {},
): () => void {
  let cancelled = false;
  let attempts = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = async () => {
    if (cancelled) return;
    attempts++;

    try {
      const res = await getSubmission(submissionId);
      if (cancelled) return;
      if (res.success) {
        onUpdate(res.submission);
        if (
          res.submission.status === "COMPLETED" ||
          res.submission.status === "FAILED"
        ) {
          return;
        }
      }
    } catch {
      // Transient failure — keep polling until the budget is spent
    }

    if (cancelled) return;

    if (attempts < maxAttempts) {
      timer = setTimeout(tick, intervalMs);
    } else {
      onExhausted?.();
    }
  };

  void tick();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}
