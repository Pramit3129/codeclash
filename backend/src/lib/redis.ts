import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

export const redis = new Redis(env.REDIS_URL.trim(), {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

redis.on("connect", () => {
  logger.info("Redis connected successfully");
});

redis.on("error", (err) => {
  logger.error({ err }, "Redis connection error");
});

