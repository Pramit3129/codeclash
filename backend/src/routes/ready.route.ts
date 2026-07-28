import { Router } from "express";
import type { Request, Response } from "express";
import { redis } from "../lib/redis.js";
import { prisma } from "../lib/prisma.js";

export const readyRouter = Router();

readyRouter.get("/", async (_req: Request, res: Response) => {
  let redisOk = false;
  let dbOk = false;

  try {
    const pong = await redis.ping();
    if (pong === "PONG") {
      redisOk = true;
    }
  } catch {
    redisOk = false;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const isReady = redisOk && dbOk;

  if (!isReady) {
    return res.status(503).json({
      status: "error",
      checks: {
        redis: redisOk ? "ok" : "error",
        database: dbOk ? "ok" : "error",
      },
    });
  }

  return res.status(200).json({
    status: "ok",
    checks: {
      redis: "ok",
      database: "ok",
    },
  });
});
