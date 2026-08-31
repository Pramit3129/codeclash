"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isRealtimeConfigured } from "./config";
import { realtimeClient } from "./socketClient";
import type { RealtimeState, SocketResponse } from "./types";

interface RealtimeContextValue extends RealtimeState {
  isConnected: boolean;
  /** True when NEXT_PUBLIC_REALTIME_URL is missing from the environment. */
  isConfigured: boolean;
  retry: () => void;
  /** Registers a socket listener; returns the matching `off`. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on: (event: string, handler: (...args: any[]) => void) => () => void;
  emit: (event: string, payload?: unknown) => void;
  emitWithAck: <T>(
    event: string,
    payload?: unknown,
  ) => Promise<SocketResponse<T>>;
}

const Ctx = createContext<RealtimeContextValue | null>(null);

/**
 * Owns the one and only Socket.IO connection for the app.
 *
 * The connection follows the auth session: it opens once the user is known and
 * tears down on logout. Feature components subscribe through `useRealtime`
 * instead of creating sockets of their own.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const state = useSyncExternalStore(
    realtimeClient.subscribe,
    realtimeClient.getState,
    realtimeClient.getServerState,
  );

  const userId = user?.id ?? null;

  useEffect(() => {
    if (loading) return;

    if (!userId) {
      // Logout / unauthenticated: drop the socket and clear all socket state.
      realtimeClient.disconnect();
      return;
    }

    realtimeClient.connect();
  }, [userId, loading]);

  const retry = useCallback(() => realtimeClient.retry(), []);
  const on = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: string, handler: (...args: any[]) => void) =>
      realtimeClient.on(event, handler),
    [],
  );
  const emit = useCallback(
    (event: string, payload?: unknown) => realtimeClient.emit(event, payload),
    [],
  );
  const emitWithAck = useCallback(
    <T,>(event: string, payload?: unknown) =>
      realtimeClient.emitWithAck<T>(event, payload),
    [],
  );

  const value = useMemo<RealtimeContextValue>(
    () => ({
      ...state,
      isConnected: state.status === "connected",
      isConfigured: isRealtimeConfigured(),
      retry,
      on,
      emit,
      emitWithAck,
    }),
    [state, retry, on, emit, emitWithAck],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useRealtime must be used within RealtimeProvider");
  }
  return ctx;
}
