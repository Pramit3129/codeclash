// The realtime (Socket.IO) server is deployed separately from the REST API, so
// it gets its own env var. Never fall back to a hardcoded host: an unset value
// must surface as a configuration error instead of silently pointing the
// production build at a developer machine.
const RAW_REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL ?? "";

export const REALTIME_URL = RAW_REALTIME_URL.trim().replace(/\/+$/, "");

export const REALTIME_ENV_VAR = "NEXT_PUBLIC_REALTIME_URL";

export function isRealtimeConfigured(): boolean {
  return REALTIME_URL.length > 0;
}

export function getRealtimeUrl(): string {
  if (!isRealtimeConfigured()) {
    throw new Error(
      `Realtime server URL is not configured. Set ${REALTIME_ENV_VAR} in your environment.`,
    );
  }
  return REALTIME_URL;
}

// Socket.IO reconnection pacing. The ticket endpoint is rate limited to 5
// requests/minute per user and every reconnect attempt burns one ticket, so the
// delays here are deliberately wider than the library defaults (1s / 5s).
export const RECONNECTION_DELAY_MS = 3_000;
export const RECONNECTION_DELAY_MAX_MS = 20_000;
export const RECONNECTION_ATTEMPTS = 8;
export const HANDSHAKE_TIMEOUT_MS = 12_000;
export const ACK_TIMEOUT_MS = 10_000;
