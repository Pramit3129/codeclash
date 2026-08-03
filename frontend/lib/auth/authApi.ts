import { apiJson } from "./apiClient";
import { tokenStore } from "./tokenStore";
import { API_URL } from "./config";

export type OAuthProvider = "google" | "github";

// Top-level browser navigation that starts an OAuth flow. When the user is
// already signed in, the backend detects the refresh cookie and runs in "link"
// mode, attaching the provider to the current account instead of logging in.
export function startOAuth(
  provider: OAuthProvider,
  options: { returnTo?: string } = {},
): void {
  const params = options.returnTo
    ? `?${new URLSearchParams({ returnTo: options.returnTo }).toString()}`
    : "";
  window.location.assign(`${API_URL}/api/auth/${provider}${params}`);
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  role: "USER" | "ADMIN";
  createdAt: string;
}

export type Provider = "LOCAL" | "GOOGLE" | "GITHUB";

export interface AuthAccount {
  provider: Provider;
  email: string | null;
  emailVerified: boolean;
  scopes: string[];
}

export interface AuthSession {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  deviceName: string | null;
  lastUsedAt: string;
  createdAt: string;
  current: boolean;
}

interface AuthResponse {
  user: User;
  accessToken: string;
  expiresIn: string;
  tokenType: string;
}

export async function register(input: {
  email: string;
  password: string;
  username?: string;
  displayName?: string;
}): Promise<User> {
  const data = await apiJson<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
  tokenStore.set(data.accessToken);
  return data.user;
}

export async function login(email: string, password: string): Promise<User> {
  const data = await apiJson<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  tokenStore.set(data.accessToken);
  return data.user;
}

export async function getMe(): Promise<{ user: User; accounts: AuthAccount[] }> {
  return apiJson<{ user: User; accounts: AuthAccount[] }>("/api/auth/me");
}

export async function logout(): Promise<void> {
  await apiJson("/api/auth/logout", { method: "POST" });
  tokenStore.clear();
}

export async function logoutAll(): Promise<void> {
  await apiJson("/api/auth/logout-all", { method: "POST" });
  tokenStore.clear();
}

export async function listSessions(): Promise<{ sessions: AuthSession[] }> {
  return apiJson<{ sessions: AuthSession[] }>("/api/auth/sessions");
}

export const revokeSession = (id: string) =>
  apiJson(`/api/auth/sessions/${id}`, { method: "DELETE" });

export const setPassword = (
  newPassword: string,
  options: { currentPassword?: string; email?: string } = {},
) =>
  apiJson("/api/auth/password", {
    method: "POST",
    body: JSON.stringify({
      newPassword,
      currentPassword: options.currentPassword,
      email: options.email,
    }),
  });

export const unlinkAccount = (provider: Provider) =>
  apiJson(`/api/auth/accounts/${provider.toLowerCase()}`, { method: "DELETE" });

// Permanently delete the current account. Clears the local token on success.
export async function deleteAccount(): Promise<void> {
  await apiJson("/api/auth/account", { method: "DELETE" });
  tokenStore.clear();
}
