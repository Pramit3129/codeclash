import { Queue } from "bullmq";
import { redis } from "../../../../src/lib/redis.js";

export const JUDGE_QUEUE_NAME = "judge";

export const JUDGE_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 2_000,
  },
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
