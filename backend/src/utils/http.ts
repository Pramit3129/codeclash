import type { Request, RequestHandler } from "express";

// Wraps async handlers so rejected promises reach the error middleware.
// (Express 5 forwards them automatically, but this keeps intent explicit and
// works uniformly across middleware too.)
export function asyncHandler(
  fn: (...args: Parameters<RequestHandler>) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Best-effort client IP, honoring the first entry of X-Forwarded-For when a
// trusted proxy is configured (app.set('trust proxy', ...)).
export function getClientIp(req: Request): string | undefined {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    return fwd.split(",")[0]?.trim();
  }
  return req.ip ?? req.socket?.remoteAddress ?? undefined;
}

export function getUserAgent(req: Request): string | undefined {
  const ua = req.headers["user-agent"];
  return typeof ua === "string" ? ua.slice(0, 512) : undefined;
}
