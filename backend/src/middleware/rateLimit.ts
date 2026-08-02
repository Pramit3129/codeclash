import type { Request, Response, NextFunction, RequestHandler } from "express";
import { redis } from "../lib/redis.js";
import { getClientIp } from "../utils/http.js";
import { TooManyRequestsError } from "../utils/errors.js";
import { logger } from "../lib/logger.js";

interface RateLimitOptions {
  // Sliding window length in seconds.
  windowSec: number;
  // Max requests allowed per key within the window.
  max: number;
  // Namespace to isolate different limiters.
  prefix: string;
  // Derive the throttle key. Defaults to client IP.
  keyFn?: (req: Request) => string;
}

// Fixed-window rate limiter backed by Redis INCR + EXPIRE. Fails open if Redis
// is unavailable so an outage never locks users out of auth.
export function rateLimit(opts: RateLimitOptions): RequestHandler {
  const { windowSec, max, prefix, keyFn } = opts;

  return async (req: Request, res: Response, next: NextFunction) => {
    const id = keyFn ? keyFn(req) : (getClientIp(req) ?? "unknown");
    const key = `ratelimit:${prefix}:${id}`;

    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSec);
      }

      const remaining = Math.max(0, max - count);
      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", String(remaining));

      if (count > max) {
        const ttl = await redis.ttl(key);
        res.setHeader("Retry-After", String(ttl > 0 ? ttl : windowSec));
        throw new TooManyRequestsError(
          "Too many requests, please try again later",
        );
      }
      next();
    } catch (err) {
      if (err instanceof TooManyRequestsError) return next(err);
      logger.warn({ err }, "Rate limiter unavailable, allowing request");
      next();
    }
  };
}
