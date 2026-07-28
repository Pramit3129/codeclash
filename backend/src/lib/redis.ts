// 
import { Redis } from "ioredis";
import { env } from "../config/env.js";

const url = new URL(env.REDIS_URL);

console.log({
  host: url.hostname,
  port: url.port,
  username: url.username,
  password: url.password,
});

export const redis = new Redis({
  host: url.hostname,
  port: Number(url.port),
  username: url.username,
  password: url.password,
});

await redis.ping();