import { apiFetch, apiJson, ApiError } from "@/lib/auth/apiClient";
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

// ─── SSE Judge Stream ───────────────────────────────────────────────

/**
 * How long to keep draining after VERDICT before giving up on the server
 * closing the response itself.
 */
const VERDICT_GRACE_MS = 3000;

export interface JudgeStreamCallbacks {
  onProgress: (event: JudgeProgressEvent) => void;
  onVerdict: (event: JudgeVerdictEvent) => void;
  onError: (error: unknown) => void;
  onOpen?: () => void;
}

/**
 * Opens the judge stream and returns a cleanup function.
 *
 * Read over `fetch` rather than `EventSource`: the backend authenticates
 * from the `Authorization` header only (see middleware/authenticate.ts), and
 * `EventSource` cannot set request headers. Going through `apiFetch` also
 * keeps the access token out of the URL and reuses the 401 refresh-and-retry
 * path, so a token that expires mid-judge doesn't kill the stream.
 *
 * The caller must leave the stream open until VERDICT arrives. The judge
 * publishes a PROGRESS event for the failing test case and only *then* the
 * terminal VERDICT, so closing early on the first non-AC result aborts the
 * response mid-write and loses the final result.
 */
export function connectJudgeStream(
  submissionId: string,
  callbacks: JudgeStreamCallbacks,
): () => void {
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let graceTimer: ReturnType<typeof setTimeout> | null = null;
  let sawVerdict = false;
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;

    if (graceTimer) {
      clearTimeout(graceTimer);
      graceTimer = null;
    }

    // Cancelling the body is the graceful stop once we're reading; aborting
    // the request mid-read leaves the browser to reject the in-flight
    // `read()` with an uncaught "network error" TypeError. Abort is only
    // right before the body exists, i.e. while still awaiting headers.
    if (reader) {
      void reader.cancel().catch(() => {});
      reader = null;
    } else {
      controller.abort();
    }
  };

  /**
   * One SSE frame: `data:` lines carry the payload, `:` lines are comments
   * (the backend's 15s heartbeat) and carry nothing.
   */
  const handleFrame = (frame: string) => {
    const data = frame
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trimStart())
      .join("\n");

    if (!data) return;

    let payload: { event?: string; data?: unknown; result?: unknown };
    try {
      payload = JSON.parse(data);
    } catch {
      return;
    }

    // The service wraps the published payload as { event, data }; the
    // publisher's own envelope calls it `result`. Accept either.
    const body = (payload.data ?? payload.result ?? payload) as never;

    if (payload.event === "PROGRESS") {
      callbacks.onProgress(body);
    } else if (payload.event === "VERDICT") {
      sawVerdict = true;
      callbacks.onVerdict(body);

      // Deliberately keep reading. The backend ends the response itself
      // after VERDICT, but only once its async Redis cleanup resolves —
      // hanging up first means the chunked terminator never arrives and the
      // browser logs ERR_INCOMPLETE_CHUNKED_ENCODING. Draining to `done`
      // lets the response complete normally. The timer is just a safety net
      // for a server that never closes.
      graceTimer = setTimeout(close, VERDICT_GRACE_MS);
    }
  };

  void (async () => {
    try {
      const res = await apiFetch(
        `/api/submissions/${submissionId}/judgeStream`,
        {
          method: "GET",
          headers: { Accept: "text/event-stream" },
          cache: "no-store",
          signal: controller.signal,
        },
      );

      if (!res.ok || !res.body) {
        throw new ApiError(res.status, {
          message: `Judge stream failed (${res.status})`,
        });
      }

      callbacks.onOpen?.();

      reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!closed && reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Frames are separated by a blank line. Anything after the last
        // separator is a partial frame — hold it until its terminator lands.
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          handleFrame(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
          if (closed) return;
          boundary = buffer.indexOf("\n\n");
        }
      }

      // Server-side end of stream: nothing left to cancel.
      const closedByCaller = closed;
      closed = true;
      reader = null;
      if (graceTimer) {
        clearTimeout(graceTimer);
        graceTimer = null;
      }

      if (!sawVerdict && !closedByCaller) {
        callbacks.onError(
          new Error("Judge stream closed before a verdict arrived"),
        );
      }
    } catch (error) {
      // An abort we initiated after VERDICT is a normal shutdown, not a fault.
      if (sawVerdict || closed) return;
      callbacks.onError(error);
    }
  })();

  return close;
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
