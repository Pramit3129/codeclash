import { logger } from "../../../../src/lib/logger.ts";
import { redis } from "../../../../src/lib/redis.js";
import type { JudgeResult } from "../verdict.types.ts";

const CHANNEL = "submission";

export const publishVerdict = (submissionId: string, result: JudgeResult) => {
  logger.info({ submissionId, result }, "Publishing verdict for submission");
  const publishResult = redis.publish(CHANNEL, JSON.stringify({ submissionId, result }));
  logger.info(`Published verdict for submission ${submissionId}: ${publishResult}`);
};