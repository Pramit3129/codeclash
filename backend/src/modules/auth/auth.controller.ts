import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
} from "./auth.schema.js";
import * as authService from "./auth.service.js";
import * as sessionService from "./session.service.js";
import { toPublicUser } from "./user.helpers.js";
import {
  setRefreshCookie,
  clearRefreshCookie,
  readRefreshCookie,
} from "../../utils/cookies.js";
import { getClientIp, getUserAgent } from "../../utils/http.js";
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from "../../utils/errors.js";
import {
  saveState,
  consumeState,
  createPkcePair,
  type OAuthProvider,
} from "./oauth/state.js";
import { buildGoogleAuthUrl, getGoogleProfile } from "./oauth/google.js";
import { buildGithubAuthUrl, getGithubProfile } from "./oauth/github.js";

function deviceFrom(req: Request): sessionService.DeviceInfo {
  return { ipAddress: getClientIp(req), userAgent: getUserAgent(req) };
}

// Issue a fresh session and write the refresh cookie. Returns the JSON body.
async function issueAndRespond(
  req: Request,
  res: Response,
  user: Parameters<typeof toPublicUser>[0],
  status = 200,
) {
  const tokens = await sessionService.createSession(user, deviceFrom(req));
  setRefreshCookie(res, tokens.refreshToken);
  return res.status(status).json({
    user: toPublicUser(user),
    accessToken: tokens.accessToken,
    expiresIn: tokens.accessTokenExpiresIn,
    tokenType: "Bearer",
  });
}

// ---------------- Local ----------------

export async function register(req: Request, res: Response) {
  const input = registerSchema.safeParse(req.body);
  if (!input.success) {
    throw new BadRequestError("Invalid request body", {
      details: input.error.flatten().fieldErrors,
    });
  }
  const user = await authService.registerLocal(input.data);
  return issueAndRespond(req, res, user, 201);
}

export async function login(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);
  const user = await authService.loginLocal(email, password);
  return issueAndRespond(req, res, user, 200);
}

// ---------------- Session lifecycle ----------------

export async function refresh(req: Request, res: Response) {
  const token = readRefreshCookie(req) ?? req.body?.refreshToken;
  if (!token) throw new UnauthorizedError("Missing refresh token");

  const tokens = await sessionService.rotateRefreshToken(token, deviceFrom(req));
  setRefreshCookie(res, tokens.refreshToken);

  return res.status(200).json({
    accessToken: tokens.accessToken,
    expiresIn: tokens.accessTokenExpiresIn,
    tokenType: "Bearer",
  });
}

export async function logout(req: Request, res: Response) {
  const token = readRefreshCookie(req) ?? req.body?.refreshToken;
  if (token) {
    const sessionId = token.split(".")[0];
    if (sessionId) await sessionService.revokeSession(sessionId);
  }
  clearRefreshCookie(res);
  return res.status(200).json({ success: true });
}

// Requires auth. Revokes every session for the user.
export async function logoutAll(req: Request, res: Response) {
  const userId = req.auth!.userId;
  const count = await sessionService.revokeAllSessions(userId);
  clearRefreshCookie(res);
  return res.status(200).json({ success: true, revoked: count });
}

// ---------------- Profile / sessions ----------------

export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
  });
  if (!user) throw new NotFoundError("User not found");
  const accounts = await authService.listLinkedAccounts(user.id);
  return res.status(200).json({
    user: toPublicUser(user),
    accounts: accounts.map((a) => ({
      provider: a.provider,
      email: a.email,
      emailVerified: a.emailVerified,
      scopes: a.scopes,
    })),
  });
}

export async function listSessions(req: Request, res: Response) {
  const sessions = await sessionService.listActiveSessions(
    req.auth!.userId,
    req.auth!.sessionId,
  );
  return res.status(200).json({ sessions });
}

export async function revokeSession(req: Request, res: Response) {
  const sessionId = String(req.params.id ?? "");
  if (!sessionId) throw new BadRequestError("Session id required");
  // Ensure the session belongs to the caller before revoking.
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });
  if (!session || session.userId !== req.auth!.userId) {
    throw new NotFoundError("Session not found");
  }
  await sessionService.revokeSession(sessionId);
  return res.status(200).json({ success: true });
}

export async function setPassword(req: Request, res: Response) {
  const { newPassword, currentPassword, email } = changePasswordSchema.parse(
    req.body,
  );
  await authService.setLocalPassword(
    req.auth!.userId,
    newPassword,
    currentPassword,
    email,
  );
  // Password change invalidates other sessions for safety.
  await sessionService.revokeAllSessions(req.auth!.userId, req.auth!.sessionId);
  return res.status(200).json({ success: true });
}

// Permanently delete the authenticated user; clears the refresh cookie.
export async function deleteAccount(req: Request, res: Response) {
  await authService.deleteUserAccount(req.auth!.userId);
  clearRefreshCookie(res);
  return res.status(200).json({ success: true });
}

export async function unlink(req: Request, res: Response) {
  const provider = String(req.params.provider ?? "").toUpperCase();
  if (!provider || !["LOCAL", "GOOGLE", "GITHUB"].includes(provider)) {
    throw new BadRequestError("Invalid provider");
  }
  await authService.unlinkAccount(
    req.auth!.userId,
    provider as "LOCAL" | "GOOGLE" | "GITHUB",
  );
  return res.status(200).json({ success: true });
}

// ---------------- OAuth ----------------

// Kick off an OAuth flow. `link` mode (authenticated) attaches the provider to
// the current user instead of logging in.
function startOAuth(provider: OAuthProvider) {
  return async (req: Request, res: Response) => {
    // Bearer identity, or the refresh cookie (a redirect can't send a header).
    let linkUserId = req.auth?.userId;
    if (!linkUserId) {
      const rt = readRefreshCookie(req);
      if (rt) {
        const resolved = await sessionService.resolveSessionUser(rt);
        linkUserId = resolved?.userId;
      }
    }

    const mode = linkUserId ? "link" : "login";
    const { verifier, challenge } = createPkcePair();
    const returnTo =
      typeof req.query.returnTo === "string" ? req.query.returnTo : undefined;

    const state = await saveState({
      provider,
      mode,
      codeVerifier: verifier,
      linkUserId,
      returnTo,
    });

    const url =
      provider === "google"
        ? buildGoogleAuthUrl(state, challenge)
        : buildGithubAuthUrl(state);

    return res.redirect(url);
  };
}

export const googleStart = startOAuth("google");
export const githubStart = startOAuth("github");

function frontendRedirect(returnTo: string | undefined, ok: boolean): string {
  const base = env.FRONTEND_URL.replace(/\/$/, "");
  const path = returnTo && returnTo.startsWith("/") ? returnTo : "/auth/callback";
  const sep = path.includes("?") ? "&" : "?";
  return `${base}${path}${sep}status=${ok ? "success" : "error"}`;
}

function handleOAuthCallback(provider: OAuthProvider) {
  return async (req: Request, res: Response) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const stateParam =
      typeof req.query.state === "string" ? req.query.state : "";
    const oauthError =
      typeof req.query.error === "string" ? req.query.error : "";

    // Consume state first so it can never be replayed, even on provider error.
    const state = await consumeState(stateParam);
    if (state.provider !== provider) {
      throw new BadRequestError("OAuth provider mismatch");
    }
    if (oauthError || !code) {
      return res.redirect(frontendRedirect(state.returnTo, false));
    }

    const profile =
      provider === "google"
        ? await getGoogleProfile(code, state.codeVerifier)
        : await getGithubProfile(code);

    if (state.mode === "link" && state.linkUserId) {
      try {
        await authService.linkOAuthAccount(state.linkUserId, profile);
      } catch {
        // e.g. already linked to another user — redirect, don't return JSON.
        return res.redirect(frontendRedirect(state.returnTo, false));
      }
      return res.redirect(frontendRedirect(state.returnTo, true));
    }

    const { user } = await authService.resolveOAuthLogin(profile);
    const tokens = await sessionService.createSession(user, deviceFrom(req));
    setRefreshCookie(res, tokens.refreshToken);

    // Refresh token is delivered via httpOnly cookie; the frontend calls
    // /auth/refresh on load to obtain an access token — no token in the URL.
    return res.redirect(frontendRedirect(state.returnTo, true));
  };
}

export const googleCallback = handleOAuthCallback("google");
export const githubCallback = handleOAuthCallback("github");
