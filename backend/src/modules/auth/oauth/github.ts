import { env } from "../../../config/env.js";
import { logger } from "../../../lib/logger.js";
import { BadRequestError } from "../../../utils/errors.js";
import type { OAuthProfile } from "./types.js";

const AUTH_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const USER_URL = "https://api.github.com/user";
const EMAILS_URL = "https://api.github.com/user/emails";

// Scopes we must always request, whatever GITHUB_SCOPES is configured to.
// `user:email` is required to read the (often private) primary email that
// account-linking depends on — a misconfigured env must not be able to drop it.
const REQUIRED_SCOPES = ["read:user", "user:email"];

function githubScopes(): string {
  const configured = env.GITHUB_SCOPES.split(/[\s,]+/).filter(Boolean);
  const merged = new Set([...configured, ...REQUIRED_SCOPES]);
  return Array.from(merged).join(" ");
}

// GitHub does not implement PKCE, so the `state` (single-use, server-stored) is
// the CSRF defense. We accept a challenge param for signature symmetry, unused.
export function buildGithubAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: env.GITHUB_REDIRECT_URI,
    scope: githubScopes(),
    state,
    allow_signup: "true",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

interface GithubTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface GithubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
  email: string | null;
}

interface GithubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
}

async function exchangeCode(code: string): Promise<GithubTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: env.GITHUB_REDIRECT_URI,
    }),
  });
  if (!res.ok) {
    throw new BadRequestError("Failed to exchange GitHub authorization code");
  }
  const data = (await res.json()) as GithubTokenResponse;
  if (data.error || !data.access_token) {
    throw new BadRequestError(
      data.error_description || "GitHub token exchange failed",
    );
  }
  return data;
}

function ghHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "codeclash-api",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function fetchUser(accessToken: string): Promise<GithubUser> {
  const res = await fetch(USER_URL, { headers: ghHeaders(accessToken) });
  if (!res.ok) throw new BadRequestError("Failed to fetch GitHub user profile");
  return (await res.json()) as GithubUser;
}

// The public profile may not expose an email, so resolve the primary verified
// address explicitly (requires the `user:email` scope).
async function fetchPrimaryEmail(
  accessToken: string,
): Promise<{ email: string | null; verified: boolean }> {
  const res = await fetch(EMAILS_URL, { headers: ghHeaders(accessToken) });
  if (!res.ok) return { email: null, verified: false };
  const emails = (await res.json()) as GithubEmail[];
  const primary =
    emails.find((e) => e.primary && e.verified) ??
    emails.find((e) => e.verified) ??
    emails[0];
  return primary
    ? { email: primary.email.toLowerCase(), verified: primary.verified }
    : { email: null, verified: false };
}

export async function getGithubProfile(code: string): Promise<OAuthProfile> {
  const tokens = await exchangeCode(code);
  const accessToken = tokens.access_token!;
  const user = await fetchUser(accessToken);

  let email = user.email?.toLowerCase() ?? null;
  let emailVerified = false;
  if (!email) {
    const primary = await fetchPrimaryEmail(accessToken);
    email = primary.email;
    emailVerified = primary.verified;
  } else {
    emailVerified = true;
  }

  // No email means the account can't be linked to any other login method — the
  // usual cause is a token granted without `user:email` (a stale authorization
  // from before the scope was requested). Log the granted scopes to diagnose.
  if (!email) {
    logger.warn(
      { githubUserId: user.id, grantedScopes: tokens.scope ?? "" },
      "GitHub OAuth returned no email — account linking will not work. " +
        "Ensure the `user:email` scope is granted (re-authorize the app).",
    );
  }

  return {
    provider: "GITHUB",
    providerUserId: String(user.id),
    email,
    emailVerified,
    displayName: user.name || user.login,
    username: user.login,
    avatar: user.avatar_url,
    accessToken,
    refreshToken: tokens.refresh_token ?? null,
    scopes: tokens.scope ? tokens.scope.split(",").filter(Boolean) : [],
    expiresAt: tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null,
  };
}
