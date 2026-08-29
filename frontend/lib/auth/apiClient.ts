import { tokenStore } from "./tokenStore";
import { API_URL } from "./config";

let refreshPromise: Promise<boolean> | null = null;

export async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        tokenStore.clear();
        return false;
      }
      const data = await res.json();
      tokenStore.set(data.accessToken);
      return true;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  _retry = true,
): Promise<Response> {
  const token = tokenStore.get();
  const isJsonBody = Boolean(init.body && typeof init.body === "string");
  const headers: Record<string, string> = {
    ...(isJsonBody ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers as Record<string, string>),
  };

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  if (res.status === 401 && _retry) {
    const body = await res.clone().json().catch(() => null);
    const reason = body?.error?.details?.reason;

    if (reason === "reuse") {
      tokenStore.clear();
      window.location.assign("/");
      return res;
    }

    const ok = await refreshAccessToken();
    if (ok) return apiFetch(path, init, false);
  }

  return res;
}

export async function apiJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await apiFetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error);
  return data as T;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(
    status: number,
    error?: { code?: string; message?: string; details?: unknown },
  ) {
    super(error?.message ?? "Request failed");
    this.name = "ApiError";
    this.status = status;
    this.code = error?.code;
    this.details = error?.details;
  }
}
