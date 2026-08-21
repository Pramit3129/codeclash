import { logger } from "../../../../src/lib/logger.ts";
import { redis } from "../../../../src/lib/redis.js";
import type { JudgeResult } from "../verdict.types.ts";
import type { RunProgress } from "../runner.type.ts";

export const publishEvent = async (
  eventType: 1 | 2,
  submissionId: string,
  result: JudgeResult | RunProgress
) => {
  const event = eventType === 1 ? "VERDICT" : "PROGRESS";
  const channel = `submission:${submissionId}`;

  console.log(
    { event, submissionId, result },
    "Publishing event for submission"
  );

  const subscriberCount = await redis.publish(
    channel,
    JSON.stringify({ event, result })
  );

  console.log(
    { submissionId, channel, subscriberCount },
    `Published ${event} for submission`
  );
};