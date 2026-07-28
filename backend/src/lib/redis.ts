import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

const parseRedisUrl = (url: string) => {
  let cleaned = url.trim().replace(/^["']|["']$/g, "");
  if (!cleaned.startsWith("redis://") && !cleaned.startsWith("rediss://")) {
    cleaned = `redis://${cleaned}`;
  }
  return cleaned;
};

const createRedisInstance = () => {
  try {
    const formattedUrl = parseRedisUrl(env.REDIS_URL);
    return new Redis(formattedUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  } catch (err) {
    logger.error(
      { err, redisUrl: env.REDIS_URL },
      "Invalid REDIS_URL configuration. Ensure REDIS_URL in environment settings is a valid Redis URL (e.g., redis://redis:6379) and contains no placeholder angle brackets or unencoded special characters."
    );
    throw err;
  }
};

export const redis = createRedisInstance();

redis.on("connect", () => {
  logger.info("Redis connected successfully");
});

redis.on("error", (err) => {
  logger.error({ err }, "Redis connection error");
});

