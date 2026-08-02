import type { Response, Request } from "express";
import type { CookieOptions } from "express";
import { env, isProd } from "../config/env.js";

const REFRESH_MAX_AGE_MS = env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000;

// httpOnly cookie carrying the opaque refresh token. Never readable by JS.
function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
    path: "/",
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(env.COOKIE_NAME, token, {
    ...baseCookieOptions(),
    maxAge: REFRESH_MAX_AGE_MS,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(env.COOKIE_NAME, baseCookieOptions());
}

export function readRefreshCookie(req: Request): string | undefined {
  const cookies = (req as Request & { cookies?: Record<string, string> })
    .cookies;
  return cookies?.[env.COOKIE_NAME];
}



