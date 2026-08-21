import { Queue } from "bullmq";
import { redis } from "../../../../src/lib/redis.js";

export const RUN_QUEUE_NAME = "run";

// No retries: the HTTP request is still open, so a retry would only make
// the user wait longer for a failure they need to see now.
export const RUN_JOB_OPTIONS = {
  attempts: 1,
  removeOnComplete: {
    age: 300,
    count: 500,
  },
  removeOnFail: {
    age: 3_600,
    count: 500,
  },
};

export const runQueue = new Queue(RUN_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: RUN_JOB_OPTIONS,
});
