import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import type { UserRole } from "@prisma/client";
import { UnauthorizedError } from "../utils/errors.js";

// Stateless access-token claims. Kept small and verifiable without a DB hit.
export interface AccessTokenPayload {
  sub: string; // userId
  sid: string; // sessionId
  role: UserRole;
  tv: number; // session tokenVersion
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as SignOptions["expiresIn"],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
    return decoded as AccessTokenPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError("Access token expired", { reason: "expired" });
    }
    throw new UnauthorizedError("Invalid access token");
  }
}
