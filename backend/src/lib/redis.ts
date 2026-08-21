import Redis from "ioredis";
import { env } from "../config/env.ts";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

redis.on("connect", () => {
  console.log("✅ Redis connected");
});

redis.on("ready", () => {
  console.log("✅ Redis ready");
});

redis.on("error", (err) => {
  console.error("❌ Redis error:", err);
});

export async function connectRedis() {
  await redis.ping();
}

export function createSubscriber() {
  return redis.duplicate();
}