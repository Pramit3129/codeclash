import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "../utils/errors.js";
import { logger } from "../lib/logger.js";
import { isProd } from "../config/env.js";

// 404 for unmatched routes.
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}

interface ErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

// Central error handler. Must be the last middleware and keep the 4-arg shape.
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  let status = 500;
  let body: ErrorBody = {
    code: "INTERNAL_SERVER_ERROR",
    message: "Something went wrong",
  };

  if (err instanceof AppError) {
    status = err.statusCode;
    body = { code: err.code, message: err.message, details: err.details };
  } else if (err instanceof ZodError) {
    status = 422;
    body = {
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      details: err.flatten().fieldErrors,
    };
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      status = 409;
      const target = (err.meta?.target as string[] | undefined)?.join(", ");
      body = {
        code: "CONFLICT",
        message: target
          ? `A record with this ${target} already exists`
          : "Resource already exists",
      };
    } else if (err.code === "P2025") {
      status = 404;
      body = { code: "NOT_FOUND", message: "Resource not found" };
    } else {
      status = 400;
      body = { code: "DB_ERROR", message: "Database request error" };
    }
  }

  // 5xx are unexpected — log with stack. 4xx are client errors — log lean.
  if (status >= 500) {
    logger.error(
      { err, path: req.path, method: req.method },
      "Unhandled error",
    );
    if (isProd) body.message = "Something went wrong";
  } else {
    logger.warn(
      { code: body.code, path: req.path, method: req.method },
      body.message,
    );
  }

  res.status(status).json({ error: body });
}
