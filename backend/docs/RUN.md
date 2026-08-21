# CodeClash Run (Play) Endpoint

`POST /api/run` executes user code against sample and user-written test
cases and returns the result in the same HTTP response. It is the "Run"
button; `POST /api/submissions` is the "Submit" button.

---

## 1. How it differs from a submission

| | Run | Submit |
|---|---|---|
| Response | `200` with full results | `202` + SSE stream |
| Persistence | none | `Submission` + `SubmissionTestResult` rows |
| Test cases | samples + user-written | every stored case, hidden included |
| Verdict | per sample case only | one overall verdict |
| On first failure | keeps going | stops |
| Retries | none | 3 with backoff |

---

## 2. Architecture

```text
 Client
   │  1. POST /api/run (source + test cases)
   ▼
┌──────────────────────┐
│     Express API      │  2. load problem, re-derive which cases are samples
│                      │  3. per-user in-flight lock + queue depth check
└──────────────────────┘
   │  4. runQueue.add("run-code")
   ▼
[ BullMQ / Redis: "run" queue ]
   │  5. blocking pop
   ▼
┌──────────────────────┐
│      Run Worker      │  6. one sandbox, compile once, execute every case
└──────────────────────┘     (same process as the judge worker)
   │  7. return RunOutcome  ──► BullMQ "completed" event
   ▼
┌──────────────────────┐
│     Express API      │  8. waitUntilFinished resolves, job deleted
└──────────────────────┘     200 { success, run }
```

The API container has no Docker socket: the queue exists to cross that
boundary, not to defer the work. The request stays open the whole time.

---

## 3. The sample trust boundary

`isSample` and `ordinal` arrive from the browser and are treated as claims.
`RunService.resolveTestCases` re-derives sample status from the database. A
case is judged only when it was not marked custom, matches a stored sample
(by ordinal, else by input), and its input is unchanged.

Consequences:

- A hand-written case sent as `isSample: true` is downgraded to custom — no
  verdict, and `expectedOutput: null`, so no stored answer leaks.
- Only *sample* ordinals are in the lookup; hidden test cases are
  unreachable through this endpoint.
- A matched sample is executed with the **stored** input, never the
  client's copy.
- Editing a sample's input makes it custom, which is also correct for the
  honest case: the stored expected output no longer applies.

Covered by `tests/run-test-case-resolution.test.ts`.

---

## 4. Limits

| Limit | Value | Where |
|---|---|---|
| Source code | 64 KB | `run.types.ts` |
| Test cases per run | 10 | `run.types.ts` |
| Input per case | 16 KB | `run.types.ts` |
| Input total | 64 KB | `run.types.ts` |
| Stored output per case | 32 KB, flagged when cut | `run.worker.ts` |
| Wall-clock per run | 15s, remainder skipped | `run.service.ts` (runner) |
| API wait | 30s | `run.service.ts` (API) |
| Queue depth | 6 waiting | `run.service.ts` (API) |
| In-flight per user | 1 | `run.service.ts` (API) |
| Rate limit | 30/min/user | `run.route.ts` |

Per-case CPU and memory come from the problem row (`timeLimitMs`,
`memoryLimitMb`) and are enforced by the sandbox, as for submissions.

---

## 5. Environment variables

| Variable | Default | Notes |
|---|---|---|
| `RUN_CONCURRENCY` | `1` | Sandboxes the run worker executes at once |
| `RUN_MAX_QUEUE_DEPTH` | `6` | Waiting jobs before new runs get `503` |
| `RUN_WALL_BUDGET_MS` | `15000` | Wall-clock budget for one run |

### Tuning for the 2 vCPU / 8 GB box

Every sandbox is capped at `--cpus 0.5`. The API, the worker, Redis and the
Docker daemon share what is left, so the sandbox budget is what matters:

- `JUDGE_CONCURRENCY=1` + `RUN_CONCURRENCY=1` → 1.0 vCPU of sandboxes,
  1.0 vCPU for everything else. **This is the recommended setting.**
- `RUN_CONCURRENCY=2` → 1.5 vCPU of sandboxes, 0.5 left for the API,
  Redis and the daemon. Only worth it if runs visibly queue *and* the
  judge is mostly idle.

Memory is not the binding constraint: a run holds one sandbox at
`memoryLimitMb` (typically 256 MB) plus a same-sized tmpfs.

---

## 6. Response

```jsonc
{
  "success": true,
  "run": {
    "status": "OK",              // "CE" when compilation failed
    "compileError": null,        // compiler output when status is "CE"
    "passedSampleCases": 1,
    "totalSampleCases": 2,
    "executionTimeMs": 676.1,
    "budgetExceeded": false,     // true if cases were skipped
    "results": [
      {
        "testCaseId": "cmssl…",  // stored id, or "custom-<index>"
        "isSample": true,        // server-derived: render verdicts off this
        "verdict": "AC",         // null for every custom case
        "input": "2 3\n",
        "expectedOutput": "5\n", // null for every custom case
        "stdout": "5\n",
        "stderr": "",
        "exitCode": 0,
        "executionTimeMs": 97.1,
        "stdoutTruncated": false, // true -> show a "output truncated" marker
        "stderrTruncated": false,
        "skipped": false          // true -> never executed, budget ran out
      }
    ]
  }
}
```

Verdicts are `AC`, `WA`, `TLE`, `MLE`, `OLE`, `RE` — and only ever on
sample cases. A custom case is always `verdict: null`, including when it
times out or crashes; its `exitCode` and `stderr` tell that story instead.

---

## 7. Errors

| Status | Code | Meaning |
|---|---|---|
| 400 | `BAD_REQUEST` | Validation failed (size caps, unknown language) |
| 404 | `NOT_FOUND` | No such problem |
| 409 | `CONFLICT` | That user already has a run in flight |
| 429 | `TOO_MANY_REQUESTS` | Rate limit |
| 503 | `RUN_BUSY` | Queue saturated — retry shortly |
| 504 | `RUN_TIMEOUT` | No result within the wait budget |
| 500 | `RUN_FAILED` | The job itself failed |

`503` and `409` are the healthy back-pressure path: they return in
milliseconds and should be surfaced as "try again", not as an error state.

---

## 8. Operational notes

- The run worker ships **inside** `dist/judge-worker.js` — same image, same
  Swarm service as the judge worker. Deploying it is the normal worker
  deploy. `/api/run` lives in the API image, which must be deployed too.
- Startup log line: `judge worker ready  concurrency: 1  runConcurrency: 1`.
  A missing `runConcurrency` means the image predates the run worker.
- Per run the worker logs `run job started` → `run job completed`.
- Completed jobs are deleted by the API as soon as the result is read;
  `RUN_JOB_OPTIONS` is only a backstop for unclaimed jobs.
- Sandboxes are destroyed in a `finally`, and the startup reaper cleans up
  anything a crash left behind — shared with the judge path.
