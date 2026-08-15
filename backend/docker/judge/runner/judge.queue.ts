import { Queue } from "bullmq";
import { redis } from "../../../src/lib/redis.js";

export const JUDGE_QUEUE_NAME = "judge";

/**
 * Retry policy.
 *
 * Retries exist ONLY for infrastructure faults (Docker unreachable,
 * database blip, worker killed mid-run). A judge verdict — WA, CE, RE,
 * TLE, MLE, OLE — is a successful job outcome: the worker returns
 * normally and persists it, so no verdict can ever trigger a retry.
 *
 * The worker throws UnrecoverableError for faults retrying cannot fix
 * (unknown language, problem with no test cases); BullMQ skips the
 * remaining attempts in that case.
 *
 * Re-running a judge job is safe because SubmissionRepository.createResult
 * is idempotent.
 */
export const JUDGE_JOB_OPTIONS = {
  attempts: 3,

  backoff: {
    type: "exponential" as const,
    delay: 2_000,
  },

  /*
   * Job payloads carry source code, so completed jobs are not kept
   * indefinitely in Redis. Failures are retained longer for triage.
   */
  removeOnComplete: {
    age: 3_600,
    count: 1_000,
  },

  removeOnFail: {
    age: 24 * 3_600,
    count: 5_000,
  },
};

export const judgeQueue = new Queue(JUDGE_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: JUDGE_JOB_OPTIONS,
});
