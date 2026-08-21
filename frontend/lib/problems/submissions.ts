import { apiFetch, apiJson } from "@/lib/auth/apiClient";
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

export interface JudgeStreamCallbacks {
  onProgress: (event: JudgeProgressEvent) => void;
  onVerdict: (event: JudgeVerdictEvent) => void;
  onError: (error: unknown) => void;
  onOpen: () => void;
}

/**
 * Opens the judge stream and returns a cleanup function.
 *
 * Read over `fetch` rather than `EventSource`: the backend authenticates
 * from the `Authorization` header only (see middleware/authenticate.ts), and
 * `EventSource` cannot set request headers. Going through `apiFetch` also
 * keeps the access token out of the URL and reuses the 401 refresh-and-retry
 * path, so a token that expires mid-judge doesn't kill the stream.
 */
export function connectJudgeStream(
  submissionId: string,
  callbacks: JudgeStreamCallbacks,
): () => void {
  const controller = new AbortController();
  let sawVerdict = false;

  /**
   * The backend sends every event as a data-only frame with the name carried
   * inside the JSON envelope (`{ event, data }`) rather than as an SSE
   * `event:` field, so dispatch on the envelope. A real `event:` field wins
   * when present, in case the wire format gains one later.
   */
  const dispatch = (raw: string, namedEvent: string | null) => {
    try {
      const payload = JSON.parse(raw);
      const name = namedEvent ?? payload.event;
      const data = payload.data ?? payload.result ?? payload;

      if (name === "PROGRESS") {
        callbacks.onProgress(data);
      } else if (name === "VERDICT") {
        sawVerdict = true;
        callbacks.onVerdict(data);
      }
    } catch {
      // Malformed event data — ignore
    }
  };

  // One SSE frame: `event:`/`data:` fields, `:` comment lines (heartbeats)
  // ignored, multiple `data:` lines joined with newlines per the spec.
  const handleFrame = (frame: string) => {
    let name: string | null = null;
    const data: string[] = [];

    for (const line of frame.split("\n")) {
      if (!line || line.startsWith(":")) continue;

      const colon = line.indexOf(":");
      const field = colon === -1 ? line : line.slice(0, colon);
      const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");

      if (field === "event") name = value;
      else if (field === "data") data.push(value);
    }

    if (data.length > 0) dispatch(data.join("\n"), name);
  };

  const run = async () => {
    const res = await apiFetch(`/api/submissions/${submissionId}/judgeStream`, {
      method: "GET",
      headers: { Accept: "text/event-stream" },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      throw new Error(`Judge stream failed with status ${res.status}`);
    }

    callbacks.onOpen();

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer = (buffer + value).replace(/\r\n/g, "\n");

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        handleFrame(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
      }
    }

    if (buffer.trim()) handleFrame(buffer);

    // The backend closes the stream after the verdict. Ending without one
    // means the connection dropped early — surface it so the caller can
    // fall back to polling.
    if (!sawVerdict) {
      throw new Error("Judge stream closed before a verdict arrived");
    }
  };

  run().catch((error) => {
    if (controller.signal.aborted) return;
    callbacks.onError(error);
  });

  return () => {
    controller.abort();
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
