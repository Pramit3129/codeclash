import { Queue } from "bullmq";
import { redis } from "../../../src/lib/redis.js";

export const JUDGE_QUEUE_NAME = "judge";

export const judgeQueue =
  new Queue(JUDGE_QUEUE_NAME, {
    connection: redis,
  });