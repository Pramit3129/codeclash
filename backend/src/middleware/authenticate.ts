import type { Request, Response, NextFunction, RequestHandler } from "express";
import { verifyAccessToken } from "../lib/jwt.js";
import { UnauthorizedError } from "../utils/errors.js";

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    if (token.length > 0) return token;
  }
  const queryToken = req.query.token as string | undefined;
  if (queryToken && queryToken.trim().length > 0) {
    return queryToken.trim();
  }
  return null;
}

// Requires a valid access token. Populates req.auth or throws 401.
export const authenticate: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const token = extractBearer(req);
  if (!token) {
    throw new UnauthorizedError("Missing access token");
  }
  const payload = verifyAccessToken(token);
  req.auth = {
    userId: payload.sub,
    sessionId: payload.sid,
    role: payload.role,
    tokenVersion: payload.tv,
  };
  next();
};

// Populates req.auth if a valid token is present, but never rejects.
export const optionalAuthenticate: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const token = extractBearer(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    req.auth = {
      userId: payload.sub,
      sessionId: payload.sid,
      role: payload.role,
      tokenVersion: payload.tv,
    };
  } catch {
    // Ignore invalid tokens in optional mode.
  }
  next();
};
