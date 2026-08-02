import crypto from "node:crypto";
import { redis } from "../../../lib/redis.js";
import { randomToken } from "../../../lib/crypto.js";
import { BadRequestError } from "../../../utils/errors.js";

const STATE_TTL_SEC = 10 * 60; // OAuth round-trip must complete within 10 min.

export type OAuthProvider = "google" | "github";
export type OAuthMode = "login" | "link";

export interface OAuthState {
  provider: OAuthProvider;
  mode: OAuthMode;
  codeVerifier: string;
  // When mode === "link", the user we are linking the account to.
  linkUserId?: string;
  // Optional post-login redirect path on the frontend.
  returnTo?: string;
  createdAt: number;
}

function key(state: string): string {
  return `oauth:state:${state}`;
}

// PKCE S256 challenge from a high-entropy verifier.
export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomToken(32);
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, challenge };
}

// Persist state server-side (single-use) and return the opaque state id.
export async function saveState(
  data: Omit<OAuthState, "createdAt">,
): Promise<string> {
  const state = randomToken(24);
  const payload: OAuthState = { ...data, createdAt: Date.now() };
  await redis.set(key(state), JSON.stringify(payload), "EX", STATE_TTL_SEC);
  return state;
}

// Fetch and delete the state atomically to prevent replay.
export async function consumeState(state: string): Promise<OAuthState> {
  if (!state) throw new BadRequestError("Missing OAuth state");
  const raw = await redis.getdel(key(state));
  if (!raw) throw new BadRequestError("Invalid or expired OAuth state");
  return JSON.parse(raw) as OAuthState;
}
