import type { Session, User } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { randomToken, sha256, safeEqual } from "../../lib/crypto.js";
import { signAccessToken } from "../../lib/jwt.js";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { UnauthorizedError } from "../../utils/errors.js";

export interface DeviceInfo {
  ipAddress?: string;
  userAgent?: string;
  deviceName?: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: string;
  session: Session;
}

const REFRESH_TTL_MS = env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000;

// A client can legitimately present the token it just had rotated away: two
// tabs bootstrapping together, a reload landing mid-refresh, React's duplicated
// dev-mode effects. Inside this window that replay is treated as a benign race
// and re-rotated; outside it, it is theft and the session is revoked.
const REUSE_GRACE_MS = 15_000;

// Bounded retries for the compare-and-swap below. Each loss means a concurrent
// request rotated first, so re-reading and re-classifying is enough.
const ROTATE_MAX_ATTEMPTS = 3;

// The refresh token wire format is `${sessionId}.${secret}`. Only the SHA-256
// of `secret` is persisted, letting us look the session up by id then compare
// the secret in constant time.
function buildRefreshToken(sessionId: string, secret: string): string {
  return `${sessionId}.${secret}`;
}

function parseRefreshToken(
  token: string,
): { sessionId: string; secret: string } | null {
  const idx = token.indexOf(".");
  if (idx <= 0 || idx === token.length - 1) return null;
  return {
    sessionId: token.slice(0, idx),
    secret: token.slice(idx + 1),
  };
}

function issueAccessToken(user: Pick<User, "id" | "role">, session: Session) {
  return signAccessToken({
    sub: user.id,
    sid: session.id,
    role: user.role,
    tv: session.tokenVersion,
  });
}

// Create a brand-new session (login / signup / oauth).
export async function createSession(
  user: Pick<User, "id" | "role">,
  device: DeviceInfo = {},
): Promise<IssuedTokens> {
  const secret = randomToken();
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: sha256(secret),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      ipAddress: device.ipAddress,
      userAgent: device.userAgent,
      deviceName: device.deviceName,
    },
  });

  return {
    accessToken: issueAccessToken(user, session),
    refreshToken: buildRefreshToken(session.id, secret),
    accessTokenExpiresIn: env.ACCESS_TOKEN_EXPIRES_IN,
    session,
  };
}

// Rotate a refresh token. Detects reuse (a previously-rotated token being
// replayed) and revokes the session — a strong signal of token theft — unless
// the replay lands inside REUSE_GRACE_MS, which marks it as a client-side race
// rather than theft.
//
// The write is a compare-and-swap on the current hash, so two rotations racing
// from the same token cannot both succeed and leave the stored hash disagreeing
// with the cookie the client ended up holding.
export async function rotateRefreshToken(
  rawToken: string,
  device: DeviceInfo = {},
): Promise<IssuedTokens> {
  const parsed = parseRefreshToken(rawToken);
  if (!parsed) throw new UnauthorizedError("Invalid refresh token");

  for (let attempt = 0; attempt < ROTATE_MAX_ATTEMPTS; attempt++) {
    const session = await prisma.session.findUnique({
      where: { id: parsed.sessionId },
      include: { user: true },
    });

    if (!session) throw new UnauthorizedError("Invalid refresh token");

    const incomingHash = sha256(parsed.secret);
    const matchesCurrent = safeEqual(incomingHash, session.refreshTokenHash);
    const matchesPrevious =
      !!session.previousRefreshTokenHash &&
      safeEqual(incomingHash, session.previousRefreshTokenHash);

    if (matchesPrevious && !matchesCurrent) {
      const rotatedAgoMs = session.rotatedAt
        ? Date.now() - session.rotatedAt.getTime()
        : Number.POSITIVE_INFINITY;

      // Outside the grace window this is a replay of a long-dead token.
      if (rotatedAgoMs > REUSE_GRACE_MS) {
        logger.warn(
          { sessionId: session.id, userId: session.userId, rotatedAgoMs },
          "Refresh token reuse detected — revoking session",
        );
        await prisma.session.update({
          where: { id: session.id },
          data: { isRevoked: true },
        });
        throw new UnauthorizedError("Refresh token reuse detected", {
          reason: "reuse",
        });
      }

      // Inside it, fall through and rotate from the session's current state so
      // the racing client still receives a usable token.
      logger.debug(
        { sessionId: session.id, userId: session.userId, rotatedAgoMs },
        "Refresh token replayed within grace window — re-rotating",
      );
    } else if (!matchesCurrent) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    if (session.isRevoked) {
      throw new UnauthorizedError("Session has been revoked");
    }
    if (session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError("Session has expired");
    }

    // Compare-and-swap: only rotates if nobody else has since we read.
    const newSecret = randomToken();
    const now = new Date();
    const swap = await prisma.session.updateMany({
      where: {
        id: session.id,
        refreshTokenHash: session.refreshTokenHash,
        isRevoked: false,
      },
      data: {
        refreshTokenHash: sha256(newSecret),
        previousRefreshTokenHash: session.refreshTokenHash,
        tokenVersion: { increment: 1 },
        rotatedAt: now,
        lastUsedAt: now,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        ipAddress: device.ipAddress ?? session.ipAddress,
        userAgent: device.userAgent ?? session.userAgent,
      },
    });

    // Lost the race — re-read and classify against the new state.
    if (swap.count === 0) continue;

    const updated: Session = {
      ...session,
      refreshTokenHash: sha256(newSecret),
      previousRefreshTokenHash: session.refreshTokenHash,
      tokenVersion: session.tokenVersion + 1,
      rotatedAt: now,
      lastUsedAt: now,
    };

    return {
      accessToken: issueAccessToken(session.user, updated),
      refreshToken: buildRefreshToken(updated.id, newSecret),
      accessTokenExpiresIn: env.ACCESS_TOKEN_EXPIRES_IN,
      session: updated,
    };
  }

  // Contended past the retry budget; the client can safely try again.
  throw new UnauthorizedError("Refresh token rotation contended");
}

// Resolve the owning user of a refresh token without rotating it (used for
// OAuth link mode). Null on any invalid/revoked/expired/mismatched token.
export async function resolveSessionUser(
  rawToken: string,
): Promise<{ userId: string; sessionId: string } | null> {
  const parsed = parseRefreshToken(rawToken);
  if (!parsed) return null;

  const session = await prisma.session.findUnique({
    where: { id: parsed.sessionId },
  });
  if (!session || session.isRevoked) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  if (!safeEqual(sha256(parsed.secret), session.refreshTokenHash)) return null;

  return { userId: session.userId, sessionId: session.id };
}

// Revoke a single session (logout). Idempotent.
export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { id: sessionId, isRevoked: false },
    data: { isRevoked: true },
  });
}

// Revoke every session for a user (logout everywhere / password change).
export async function revokeAllSessions(
  userId: string,
  exceptSessionId?: string,
): Promise<number> {
  const result = await prisma.session.updateMany({
    where: {
      userId,
      isRevoked: false,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { isRevoked: true },
  });
  return result.count;
}

export async function listActiveSessions(
  userId: string,
  currentSessionId?: string,
) {
  const sessions = await prisma.session.findMany({
    where: { userId, isRevoked: false, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: "desc" },
    select: {
      id: true,
      ipAddress: true,
      userAgent: true,
      deviceName: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });
  return sessions.map((s) => ({
    ...s,
    current: s.id === currentSessionId,
  }));
}
