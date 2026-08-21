import { Queue } from "bullmq";
import { redis } from "../../../../src/lib/redis.js";

export const RUN_QUEUE_NAME = "run";

// No retries: the HTTP request is still open, so a retry would only make
// the user wait longer for a failure they need to see now.
export const RUN_JOB_OPTIONS = {
  attempts: 1,
  // The API deletes its own job once read; these only catch unclaimed ones.
  removeOnComplete: {
    age: 60,
    count: 50,
  },
  removeOnFail: {
    age: 600,
    count: 100,
  },
};

export const runQueue = new Queue(RUN_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: RUN_JOB_OPTIONS,
});
