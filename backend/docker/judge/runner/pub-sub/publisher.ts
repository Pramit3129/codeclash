import { logger } from "../../../../src/lib/logger.ts";
import { redis } from "../../../../src/lib/redis.js";
import type { JudgeResult } from "../verdict.types.ts";

export const publishVerdict = async (
  submissionId: string,
  result: JudgeResult
) => {
  const channel = `submission:${submissionId}`;

  logger.info(
    { submissionId, result },
    "Publishing verdict for submission"
  );

  const subscriberCount = await redis.publish(
    channel,
    JSON.stringify({ submissionId, result })
  );

  logger.info(
    { submissionId, channel, subscriberCount },
    "Published verdict for submission"
  );
};