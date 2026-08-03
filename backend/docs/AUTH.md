# Authentication & Authorization

Production auth for CodeClash: email/password + Google & GitHub OAuth, JWT access
tokens, rotating refresh tokens with theft detection, and role-based access.

- Base path: `/api/auth`
- Content type: `application/json`
- All timestamps are ISO-8601 UTC.

---

## 1. Concepts

### Model

```
User 1───* AuthAccount        (LOCAL | GOOGLE | GITHUB, one per provider per user)
User 1───* Session            (refresh sessions, hashed tokens)
```

### Tokens

| Token | Lifetime | Transport | Storage |
| --- | --- | --- | --- |
| **Access** | `ACCESS_TOKEN_EXPIRES_IN` (15m) | `Authorization: Bearer <jwt>` header | client memory |
| **Refresh** | `REFRESH_TOKEN_EXPIRES_DAYS` (30d) | httpOnly `Secure` `SameSite` cookie (`COOKIE_NAME`, default `cc_rt`) | only `sha256` persisted |

- **Access token** is a stateless JWT. Decoded claims:

  ```json
  {
    "sub": "cms8jgdt20000qgrnhduqry8s",  // userId
    "sid": "cms8jge6s0003qgrns2ktg7fb",  // sessionId
    "role": "USER",                       // USER | ADMIN
    "tv": 1,                              // session tokenVersion
    "iat": 1785477922,
    "exp": 1785478822,
    "aud": "codeclash-client",
    "iss": "codeclash"
  }
  ```

- **Refresh token** is opaque, formatted `${sessionId}.${secret}`. Only
  `sha256(secret)` is stored. It is **rotated on every `/refresh`**; replaying a
  rotated token is treated as theft and revokes the whole session.
- **Provider tokens**: GitHub access/refresh tokens are encrypted at rest with
  AES-256-GCM (`ENCRYPTION_KEY`). Google tokens are not persisted.

### Standard response envelopes

Success bodies are endpoint-specific (below). Errors are always:

```json
{ "error": { "code": "UNAUTHORIZED", "message": "Invalid email or password" } }
```

Some errors add `details` (e.g. validation field errors, or `{ "reason": "expired" }`
on an expired access token, `{ "reason": "reuse" }` on refresh-token reuse).

| Status | `code` | When |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | malformed request / bad OAuth state |
| 401 | `UNAUTHORIZED` | missing/invalid/expired token, bad credentials |
| 403 | `FORBIDDEN` | authenticated but not allowed (role / last login method) |
| 404 | `NOT_FOUND` | unknown route or resource |
| 409 | `CONFLICT` | email/username already in use |
| 422 | `VALIDATION_ERROR` | body failed schema validation |
| 429 | `TOO_MANY_REQUESTS` | rate limit exceeded (`Retry-After` header) |

---

## 2. Endpoint reference

| Method | Path | Auth | Rate limit |
| --- | --- | --- | --- |
| POST | `/register` | – | 10 / hour / IP |
| POST | `/login` | – | 20 / 15m / IP |
| POST | `/refresh` | refresh cookie | 60 / min / IP |
| POST | `/logout` | refresh cookie | – |
| POST | `/logout-all` | Bearer | – |
| GET | `/me` | Bearer | – |
| GET | `/sessions` | Bearer | – |
| DELETE | `/sessions/:id` | Bearer | – |
| POST | `/password` | Bearer | – |
| DELETE | `/accounts/:provider` | Bearer | – |
| GET | `/google`, `/github` | optional | 30 / 5m / IP |
| GET | `/google/callback`, `/github/callback` | – | – |

---

### POST `/register`

Create a LOCAL account. `username`/`displayName` are optional — a unique
username is derived from the email local-part when omitted.

**Request**

```json
{
  "email": "alice@example.com",
  "password": "Password123",
  "username": "alice",          // optional, 3–30 chars [a-zA-Z0-9_]
  "displayName": "Alice"        // optional, 1–80 chars
}
```

Password policy: 8–72 chars, at least one lowercase, one uppercase, one digit.

**Response `201`** (sets `cc_rt` refresh cookie)

```json
{
  "user": {
    "id": "cms8jgdt20000qgrnhduqry8s",
    "username": "alice",
    "displayName": "Alice",
    "avatar": null,
    "role": "USER",
    "createdAt": "2026-07-31T06:05:22.023Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "15m",
  "tokenType": "Bearer"
}
```

Errors: `409` email already in use / username taken, `422` validation.

```bash
curl -i -c cookies.txt -X POST http://localhost:8000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"Password123","displayName":"Alice"}'
```

---

### POST `/login`

**Request**

```json
{ "email": "alice@example.com", "password": "Password123" }
```

**Response `200`** — identical body to `/register` (user + access token, sets
refresh cookie).

Errors: `401 UNAUTHORIZED` (`"Invalid email or password"` — generic, no user
enumeration).

---

### POST `/refresh`

Rotates the refresh session and issues a new access token. The refresh token is
read from the `cc_rt` cookie (or `{"refreshToken":"..."}` body for non-browser
clients).

**Request** — no body needed when using the cookie.

**Response `200`** (sets a new `cc_rt` cookie, old one invalidated)

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "15m",
  "tokenType": "Bearer"
}
```

Errors:
- `401` `"Missing refresh token"`, `"Invalid refresh token"`, `"Session has been revoked"`, `"Session has expired"`.
- `401` `"Refresh token reuse detected"` with `details: { "reason": "reuse" }` —
  a rotated token was replayed; the session is now revoked. Force a fresh login.

```bash
curl -b cookies.txt -c cookies.txt -X POST http://localhost:8000/api/auth/refresh
```

---

### POST `/logout`

Revokes the current session and clears the cookie. Idempotent.

**Response `200`** → `{ "success": true }`

---

### POST `/logout-all`  · Bearer

Revokes **every** session for the user (all devices).

**Response `200`** → `{ "success": true, "revoked": 3 }`

---

### GET `/me`  · Bearer

**Response `200`**

```json
{
  "user": {
    "id": "cms8jgdt20000qgrnhduqry8s",
    "username": "alice",
    "displayName": "Alice",
    "avatar": null,
    "role": "USER",
    "createdAt": "2026-07-31T06:05:22.023Z"
  },
  "accounts": [
    { "provider": "LOCAL",  "email": "alice@example.com", "emailVerified": false, "scopes": [] },
    { "provider": "GITHUB", "email": "alice@users.noreply.github.com", "emailVerified": true, "scopes": ["read:user","user:email","repo"] }
  ]
}
```

---

### GET `/sessions`  · Bearer

**Response `200`**

```json
{
  "sessions": [
    {
      "id": "cms8jh1750007qgrny1rlvowk",
      "ipAddress": "203.0.113.7",
      "userAgent": "Mozilla/5.0 ...",
      "deviceName": null,
      "lastUsedAt": "2026-07-31T06:10:02.500Z",
      "createdAt": "2026-07-31T06:05:22.100Z",
      "current": true
    }
  ]
}
```

### DELETE `/sessions/:id`  · Bearer

Revoke a specific session (must belong to the caller). `200 { "success": true }`;
`404` if not found / not owned.

---

### POST `/password`  · Bearer

Set a password for the first time (OAuth-only users) or change an existing one.
On success **all other sessions are revoked**.

**Request**

```json
{ "newPassword": "NewPass123", "currentPassword": "OldPass123" }
```

`currentPassword` is required only when a LOCAL password already exists.

**Response `200`** → `{ "success": true }`. Errors: `400` current password
required, `401` current password incorrect, `422` validation.

---

### DELETE `/accounts/:provider`  · Bearer

Unlink `LOCAL`, `GOOGLE`, or `GITHUB`. Refuses to remove the user's **only**
login method.

`200 { "success": true }`; `403 "Cannot unlink your only login method"`;
`404 "No such linked account"`.

---

## 3. OAuth flow (Google & GitHub)

Both providers share the same shape:

```
Client ── GET /api/auth/github ─────────────▶ 302 to github.com   (state + PKCE saved in Redis, 10m)
User authorizes on provider
Provider ── GET /api/auth/github/callback?code&state ──▶ backend
backend: consume state → exchange code → fetch profile
         → find/create AuthAccount → find/create/link User → create Session
         → set cc_rt cookie → 302 to FRONTEND_URL
Client ── POST /api/auth/refresh ────────────▶ access token
```

Key points:
- **`state` is single-use** (stored in Redis, deleted on callback) → replay-safe.
- **Google uses PKCE (S256)**; GitHub relies on `state` for CSRF.
- If the caller is **already authenticated** when hitting `/github`, the flow
  runs in **link mode** and attaches GitHub to the current user instead of
  logging in / creating a user.
- Accounts sharing a **verified** email auto-link to a single user.
- The refresh token is delivered only via the httpOnly cookie — **no token ever
  appears in a URL**.

#### Account linking rules

Google and GitHub are trusted providers: any email they return is stored with
`emailVerified: true`. Linking is driven by email equality:

- **OAuth login, email already on a user** (LOCAL or another provider) → the new
  provider is attached to that existing user (`resolveOAuthLogin` step 2). The
  existing account no longer has to be pre-verified — the incoming OAuth email is
  the proof of ownership.
- **`register` (email + password) where that email already belongs to a trusted
  OAuth user** → a `LOCAL` account is attached to that same user (they get a
  password login), rather than creating a duplicate account.

> ⚠️ **Account-takeover caveat.** Because this project has **no email-verification
> step for LOCAL signups**, `register` trusts whoever submits the password. Someone
> who knows a GitHub/Google user's email can register a password and thereby gain
> access to that account. This is an accepted trade-off for now; before production,
> gate the register-into-existing-OAuth-user path behind a verification email (send
> a confirm link instead of immediately attaching + issuing a session).

### Start

```
GET /api/auth/github            # login mode
GET /api/auth/github?returnTo=/dashboard
GET /api/auth/github            # with a valid Bearer token → link mode
```

**Response `302`**

```
Location: https://github.com/login/oauth/authorize
  ?client_id=Iv1.abc123
  &redirect_uri=http%3A%2F%2Flocalhost%3A8000%2Fapi%2Fauth%2Fgithub%2Fcallback
  &scope=read%3Auser+user%3Aemail+repo
  &state=NXJg9IJ9jnpMNScfjBOSmVFMwaatkHcK
  &allow_signup=true
```

Scopes come from `GITHUB_SCOPES` (default `read:user user:email repo`).

### Callback

`GET /api/auth/github/callback?code=<code>&state=<state>` — called by GitHub, not
by you. The backend:

1. Consumes the `state` from Redis (rejects if missing/expired → `400`).
2. Exchanges `code` at `https://github.com/login/oauth/access_token`.
3. `GET https://api.github.com/user` and, since the profile email may be private,
   `GET https://api.github.com/user/emails` to resolve the primary **verified**
   address (needs `user:email`).
4. Normalizes to an internal profile, encrypts the GitHub tokens, and persists.

**Example — GitHub `/user` response the backend consumes**

```json
{
  "id": 1478473,
  "login": "octoalice",
  "name": "Alice Octo",
  "avatar_url": "https://avatars.githubusercontent.com/u/1478473?v=4",
  "email": null
}
```

**Example — GitHub `/user/emails` response**

```json
[
  { "email": "alice@example.com", "primary": true,  "verified": true,  "visibility": "private" },
  { "email": "octoalice@users.noreply.github.com", "primary": false, "verified": true, "visibility": null }
]
```

→ backend picks the primary verified email and creates:

```
User        { username: "octoalice", displayName: "Alice Octo", avatar: "https://…" }
AuthAccount { provider: GITHUB, providerUserId: "1478473", email: "alice@example.com",
              emailVerified: true, scopes: ["read:user","user:email","repo"],
              encryptedAccessToken: "…", encryptedRefreshToken: null }
Session     { … refresh token issued … }
```

**Response `302`** (sets `cc_rt` cookie)

```
Location: http://localhost:5173/auth/callback?status=success
```

On provider error or denied consent:

```
Location: http://localhost:5173/auth/callback?status=error
```

(If `returnTo` was an absolute path like `/dashboard`, it replaces `/auth/callback`.)

### Finishing on the frontend

```js
// After landing on /auth/callback?status=success
const res = await fetch("http://localhost:8000/api/auth/refresh", {
  method: "POST",
  credentials: "include",           // send the httpOnly cc_rt cookie
});
const { accessToken } = await res.json();
// keep accessToken in memory; attach as `Authorization: Bearer <accessToken>`
```

---

## 4. Middleware & authorization

- `authenticate` — requires a valid Bearer token, populates `req.auth`
  (`{ userId, sessionId, role, tokenVersion }`).
- `optionalAuthenticate` — attaches `req.auth` if present, never rejects (used by
  the OAuth-start routes to enter link mode).
- `authorize(...roles)` — role gate, run after `authenticate`.
- `rateLimit(...)` — Redis fixed-window limiter (fails open if Redis is down).

```ts
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";

router.get("/admin/stats", authenticate, authorize("ADMIN"), handler);
```

An access token whose `tv` no longer matches its session is rejected on the next
`/refresh`, so revocation (logout-all, password change) takes effect within one
access-token lifetime (≤ 15m).

---

## 5. Client integration checklist

- Call the API with `credentials: "include"` so the refresh cookie flows; set
  `CORS_ORIGINS` to your frontend origin(s).
- Store the access token in memory only. On `401` with
  `details.reason === "expired"`, call `/refresh` once and retry the request.
- On `401` with `details.reason === "reuse"`, clear client state and send the
  user to log in again — the session was revoked for suspected theft.
- Run `prisma migrate deploy` on release to apply migrations.

---

## 6. Frontend integration guide (step by step)

A complete recipe for wiring a browser SPA to this API. Examples are React +
TypeScript (Vite), but the flow is identical for Vue/Svelte/Angular — only the
component syntax changes. Follow the steps in order.

### The mental model (read this first)

- **Access token** lives in **JS memory only** (a module variable / context).
  Never put it in `localStorage` (XSS-exfiltratable) — it is short-lived (15m)
  and re-obtained via refresh.
- **Refresh token** is an **httpOnly cookie** you never see or touch in JS. The
  browser sends it automatically **only if every request uses
  `credentials: "include"`**.
- **On app load / hard refresh**, memory is empty → call `POST /auth/refresh`
  once to bootstrap a new access token from the cookie.
- **On `401 expired`**, transparently call `/auth/refresh` and retry the request.
- **OAuth** is a full-page redirect, not `fetch`. You send the browser to
  `/api/auth/google`; it comes back to your `/auth/callback` page; you then call
  `/auth/refresh` to get the access token.

### Step 0 — Environment & prerequisites

```bash
# .env (frontend)
VITE_API_URL=http://localhost:8000
```

Backend must allow your origin. Ensure the backend `.env` has:

```bash
FRONTEND_URL=http://localhost:5173
# or, for multiple origins:
# CORS_ORIGINS=http://localhost:5173,https://app.example.com
```

> ⚠️ Cross-site cookies in production require **HTTPS** and the API + app on the
> same site or properly configured `SameSite`. In dev over `http://localhost`
> the backend uses `SameSite=Lax`; in prod it uses `Secure; SameSite=Strict`.
> If the API is on a different registrable domain than the app, set
> `COOKIE_DOMAIN` and serve both over HTTPS.

### Step 1 — Token store (in-memory)

```ts
// src/auth/tokenStore.ts
let accessToken: string | null = null;

export const tokenStore = {
  get: () => accessToken,
  set: (t: string | null) => { accessToken = t; },
  clear: () => { accessToken = null; },
};
```

### Step 2 — API client with auto-refresh + retry

This is the core piece. Every call sends the cookie (`credentials: "include"`)
and the Bearer token; on an *expired* access token it refreshes **once** and
retries. Concurrent 401s share a single in-flight refresh.

```ts
// src/auth/apiClient.ts
import { tokenStore } from "./tokenStore";

const API = import.meta.env.VITE_API_URL;

let refreshPromise: Promise<boolean> | null = null;

// Bootstrap / renew the access token from the httpOnly refresh cookie.
export async function refreshAccessToken(): Promise<boolean> {
  // De-dupe concurrent refreshes.
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch(`${API}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) { tokenStore.clear(); return false; }
      const data = await res.json();
      tokenStore.set(data.accessToken);
      return true;
    })().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

// Fetch wrapper: attaches Bearer, sends cookie, refreshes on 401-expired.
export async function apiFetch(
  path: string,
  init: RequestInit = {},
  _retry = true,
): Promise<Response> {
  const token = tokenStore.get();
  const res = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401 && _retry) {
    const body = await res.clone().json().catch(() => null);
    const reason = body?.error?.details?.reason;

    if (reason === "reuse") {           // suspected theft — hard logout
      tokenStore.clear();
      window.location.assign("/login");
      return res;
    }
    // expired or missing token → try one refresh, then replay the request
    const ok = await refreshAccessToken();
    if (ok) return apiFetch(path, init, false);
  }
  return res;
}

// Small helper that throws on non-2xx and returns parsed JSON.
export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error);
  return data as T;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(status: number, error?: { code?: string; message?: string; details?: unknown }) {
    super(error?.message ?? "Request failed");
    this.status = status;
    this.code = error?.code;
    this.details = error?.details;
  }
}
```

### Step 3 — Auth API functions

```ts
// src/auth/authApi.ts
import { apiJson } from "./apiClient";
import { tokenStore } from "./tokenStore";

export interface User {
  id: string; username: string; displayName: string;
  avatar: string | null; role: "USER" | "ADMIN"; createdAt: string;
}
interface AuthResponse { user: User; accessToken: string; expiresIn: string; tokenType: string; }

export async function register(input: {
  email: string; password: string; username?: string; displayName?: string;
}): Promise<User> {
  const data = await apiJson<AuthResponse>("/api/auth/register", {
    method: "POST", body: JSON.stringify(input),
  });
  tokenStore.set(data.accessToken);
  return data.user;
}

export async function login(email: string, password: string): Promise<User> {
  const data = await apiJson<AuthResponse>("/api/auth/login", {
    method: "POST", body: JSON.stringify({ email, password }),
  });
  tokenStore.set(data.accessToken);
  return data.user;
}

export async function getMe() {
  return apiJson<{ user: User; accounts: Array<{
    provider: "LOCAL" | "GOOGLE" | "GITHUB"; email: string | null;
    emailVerified: boolean; scopes: string[];
  }> }>("/api/auth/me");
}

export async function logout(): Promise<void> {
  await apiJson("/api/auth/logout", { method: "POST" });
  tokenStore.clear();
}

export async function logoutAll(): Promise<void> {
  await apiJson("/api/auth/logout-all", { method: "POST" });
  tokenStore.clear();
}

export async function listSessions() {
  return apiJson<{ sessions: Array<{
    id: string; ipAddress: string | null; userAgent: string | null;
    deviceName: string | null; lastUsedAt: string; createdAt: string; current: boolean;
  }> }>("/api/auth/sessions");
}
export const revokeSession = (id: string) =>
  apiJson(`/api/auth/sessions/${id}`, { method: "DELETE" });

export const setPassword = (newPassword: string, currentPassword?: string) =>
  apiJson("/api/auth/password", { method: "POST", body: JSON.stringify({ newPassword, currentPassword }) });

export const unlinkAccount = (provider: "LOCAL" | "GOOGLE" | "GITHUB") =>
  apiJson(`/api/auth/accounts/${provider.toLowerCase()}`, { method: "DELETE" });
```

### Step 4 — Auth context (bootstrap on load)

On mount, attempt a silent refresh so a page reload keeps the user logged in.

```tsx
// src/auth/AuthProvider.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { refreshAccessToken } from "./apiClient";
import { getMe, login as apiLogin, logout as apiLogout, type User } from "./authApi";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function reload() {
    try {
      const ok = await refreshAccessToken();  // get access token from cookie
      if (!ok) { setUser(null); return; }
      const { user } = await getMe();
      setUser(user);
    } catch { setUser(null); }
  }

  useEffect(() => { reload().finally(() => setLoading(false)); }, []);

  return (
    <Ctx.Provider value={{
      user, loading,
      login: async (e, p) => { setUser(await apiLogin(e, p)); },
      logout: async () => { await apiLogout(); setUser(null); },
      reload,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
```

Wrap the app once:

```tsx
// src/main.tsx
<AuthProvider><App /></AuthProvider>
```

### Step 5 — Login & register forms

```tsx
// src/pages/LoginPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { OAuthButtons } from "../components/OAuthButtons";
import { ApiError } from "../auth/apiClient";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {error && <p role="alert">{error}</p>}
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
      <button type="submit">Log in</button>
      <OAuthButtons />
    </form>
  );
}
```

Register is the same, calling `register({ email, password, username?, displayName? })`.
Surface `422` validation `details` (a map of field → messages) next to inputs,
and `409` as “email/username already in use”.

### Step 6 — OAuth buttons (full-page redirect)

OAuth is **not** an AJAX call. Navigate the whole browser to the start URL.

```tsx
// src/components/OAuthButtons.tsx
const API = import.meta.env.VITE_API_URL;

export function OAuthButtons({ returnTo = "/dashboard" }: { returnTo?: string }) {
  const go = (provider: "google" | "github") => {
    const url = new URL(`${API}/api/auth/${provider}`);
    url.searchParams.set("returnTo", returnTo);
    window.location.assign(url.toString());   // leave the SPA
  };
  return (
    <div>
      <button type="button" onClick={() => go("google")}>Continue with Google</button>
      <button type="button" onClick={() => go("github")}>Continue with GitHub</button>
    </div>
  );
}
```

> To **link** a provider to a signed-in user instead of logging in, send the user
> through the *same* start URL while they have a session — the backend detects
> the session and runs in link mode. (Because OAuth-start is a top-level browser
> navigation, the backend reads it via the refresh cookie context; simplest is to
> only expose the “Link GitHub” button on an authenticated settings page.)

### Step 7 — OAuth callback page

The backend redirects here after the provider round-trip:
`http://localhost:5173/auth/callback?status=success`. This page finishes login by
bootstrapping the access token from the freshly-set cookie.

```tsx
// src/pages/AuthCallback.tsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { reload } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.get("status") !== "success") {
      setError("Sign-in was cancelled or failed.");
      return;
    }
    reload()                          // refresh cookie → access token → /me
      .then(() => navigate("/dashboard", { replace: true }))
      .catch(() => setError("Could not complete sign-in."));
  }, []);

  if (error) return <div role="alert">{error} <a href="/login">Try again</a></div>;
  return <div>Signing you in…</div>;
}
```

Add the route (see Step 8). Make sure your frontend router has a
`/auth/callback` route — that path is what the backend redirects to by default.

### Step 8 — Routing & protected routes

```tsx
// src/routes.tsx
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";

function RequireAuth({ children, role }: { children: JSX.Element; role?: "ADMIN" }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading…</div>;        // wait for bootstrap refresh
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/admin" element={<RequireAuth role="ADMIN"><AdminPage /></RequireAuth>} />
    </Routes>
  );
}
```

> Gate on `loading` so a hard refresh doesn’t bounce an authenticated user to
> `/login` before the bootstrap refresh resolves.

### Step 9 — Session management & account settings UI

On a settings page you can list devices, revoke individual sessions, log out
everywhere, add/change a password, and link/unlink providers:

```tsx
const { sessions } = await listSessions();
// render sessions; disable "revoke" on the one with current === true
await revokeSession(id);                 // kill one device
await logoutAll();                       // kill all (then redirect to /login)
await setPassword("NewPass123", "OldPass123");   // OAuth users omit the 2nd arg
await unlinkAccount("GITHUB");           // 403 if it's the only login method
```

### Step 10 — Logout

```tsx
const { logout } = useAuth();
await logout();                // revokes current session + clears cookie
navigate("/login");
```

Use `logoutAll()` for “sign out of all devices”.

### End-to-end sequence (what happens when)

```
First visit / hard refresh
  App mount → refresh() → POST /auth/refresh (cookie) → access token → GET /me → user

Email login
  submit → POST /auth/login → {user, accessToken} in memory → navigate

OAuth login
  click → browser → GET /api/auth/github → github.com → …/github/callback
        → backend sets cookie → 302 /auth/callback?status=success
        → AuthCallback → POST /auth/refresh → access token → GET /me → navigate

Any API call with an expired access token
  request → 401 {reason:"expired"} → POST /auth/refresh → retry original request

Detected token theft
  request → 401 {reason:"reuse"} → clear memory → redirect /login
```

### Common pitfalls

- **Forgetting `credentials: "include"`** on *any* auth request → the cookie is
  not sent, refresh silently fails, user appears logged out. It must be on
  `/refresh`, `/logout`, and every authenticated call. (The `apiClient` above
  sets it globally — always go through it.)
- **CORS error / cookie not stored** → backend `FRONTEND_URL`/`CORS_ORIGINS`
  doesn’t exactly match your origin (scheme + host + port), or you’re mixing
  `http`/`https`.
- **Storing the access token in `localStorage`** → don’t; keep it in memory.
- **Redirect loop on `/dashboard`** → you didn’t gate the route on `loading`.
- **OAuth via `fetch`** → won’t work; OAuth start/callback must be top-level
  browser navigations.
- **Access token “not expiring immediately” after logout-all** → expected;
  stateless access tokens live up to 15m. Rely on refresh failing for hard
  revocation, or shorten `ACCESS_TOKEN_EXPIRES_IN`.
