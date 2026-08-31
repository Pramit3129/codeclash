import { io, type Socket } from "socket.io-client";
import { ApiError } from "@/lib/auth/apiClient";
import {
  ACK_TIMEOUT_MS,
  HANDSHAKE_TIMEOUT_MS,
  RECONNECTION_ATTEMPTS,
  RECONNECTION_DELAY_MAX_MS,
  RECONNECTION_DELAY_MS,
  getRealtimeUrl,
} from "./config";
import { issueWsTicket } from "./ticketApi";
import type { RealtimeState, SocketResponse } from "./types";

type StateListener = (state: RealtimeState) => void;
// Socket.IO event payloads are untyped at the wire level.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventHandler = (...args: any[]) => void;

/** Frozen so it is safe to hand out as the server/initial snapshot. */
const INITIAL_STATE: RealtimeState = Object.freeze({
  status: "idle",
  socketId: null,
  error: null,
  needsManualRetry: false,
});

/**
 * Single, app-wide Socket.IO connection.
 *
 * Components never construct their own socket — they go through
 * `RealtimeProvider` / `useRealtime`, which talk to this singleton. That keeps
 * exactly one connection (and therefore one `user:{userId}` room membership)
 * alive for the whole session.
 */
class RealtimeClient {
  private socket: Socket | null = null;
  private state: RealtimeState = INITIAL_STATE;
  private stateListeners = new Set<StateListener>();
  /**
   * Event handlers registered before/across socket instances. Kept here rather
   * than only on the socket so that a rebuilt socket transparently inherits
   * them and callers still get a matching `off` for every `on`.
   */
  private handlers = new Map<string, Set<EventHandler>>();
  /** Result of the most recent ticket request, consumed by `connect_error`. */
  private lastTicketError: TicketFailure | null = null;
  private manualReconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // ---- state ----

  // Arrow properties: these are passed straight to `useSyncExternalStore`, so
  // their identity must stay stable across renders.
  getState = (): RealtimeState => this.state;

  /** Snapshot used during SSR, where no socket exists. */
  getServerState = (): RealtimeState => INITIAL_STATE;

  subscribe = (listener: StateListener): (() => void) => {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  };

  private setState(patch: Partial<RealtimeState>) {
    const next = { ...this.state, ...patch };
    if (
      next.status === this.state.status &&
      next.socketId === this.state.socketId &&
      next.error === this.state.error &&
      next.needsManualRetry === this.state.needsManualRetry
    ) {
      return;
    }
    this.state = next;
    this.stateListeners.forEach((listener) => listener(next));
  }

  // ---- lifecycle ----

  isConnected(): boolean {
    return this.socket?.connected === true;
  }

  connect(): void {
    if (this.socket) {
      // `active` covers "currently attempting to (re)connect".
      if (!this.socket.connected && !this.socket.active) {
        this.lastTicketError = null;
        this.setState({ status: "connecting", error: null, needsManualRetry: false });
        this.socket.connect();
      }
      return;
    }

    let url: string;
    try {
      url = getRealtimeUrl();
    } catch (err) {
      this.setState({
        status: "error",
        error: err instanceof Error ? err.message : "Realtime is not configured",
        needsManualRetry: false,
      });
      return;
    }

    this.setState({ status: "connecting", error: null, needsManualRetry: false });

    const socket = io(url, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      tryAllTransports: true,
      timeout: HANDSHAKE_TIMEOUT_MS,
      reconnection: true,
      reconnectionAttempts: RECONNECTION_ATTEMPTS,
      reconnectionDelay: RECONNECTION_DELAY_MS,
      reconnectionDelayMax: RECONNECTION_DELAY_MAX_MS,
      randomizationFactor: 0.5,
      // `auth` as a *function* is re-invoked before every handshake, including
      // every reconnect attempt. That is what makes single-use tickets work:
      // a consumed ticket is never replayed, each attempt fetches a fresh one.
      auth: (cb) => {
        issueWsTicket()
          .then((ticket) => {
            this.lastTicketError = null;
            cb({ ticket });
          })
          .catch((err: unknown) => {
            this.lastTicketError = describeTicketError(err);
            // The handshake must still be answered; the server rejects the
            // empty payload and `connect_error` decides whether to keep trying.
            cb({});
          });
      },
    });

    this.socket = socket;
    this.attachLifecycleHandlers(socket);
    this.reattachHandlers(socket);
    socket.connect();
  }

  private attachLifecycleHandlers(socket: Socket) {
    socket.on("connect", () => {
      this.clearManualReconnectTimer();
      this.lastTicketError = null;
      // The server joins `user:{userId}` automatically on connect — the client
      // must never emit a join for it.
      this.setState({
        status: "connected",
        socketId: socket.id ?? null,
        error: null,
        needsManualRetry: false,
      });
    });

    socket.on("connect_error", (err: Error) => {
      const ticketError = this.lastTicketError;
      this.lastTicketError = null;

      if (ticketError?.fatal) {
        // Retrying cannot help (session gone, or rate limited) — stop here
        // rather than burning further ticket requests.
        socket.disconnect();
        this.setState({
          status: "error",
          socketId: null,
          error: ticketError.message,
          needsManualRetry: true,
        });
        return;
      }

      // A rejected handshake never reuses the ticket: socket.io calls the
      // `auth` function again on the next attempt, which mints a fresh one.
      this.setState({
        status: socket.active ? "connecting" : "error",
        socketId: null,
        error:
          ticketError?.message ||
          err.message ||
          "Unable to reach the realtime server",
        needsManualRetry: !socket.active,
      });
    });

    socket.on("disconnect", (reason: Socket.DisconnectReason) => {
      // "io client disconnect" is our own teardown; leave the state to whoever
      // initiated it.
      if (reason === "io client disconnect") return;

      this.setState({
        status: "disconnected",
        socketId: null,
        error: `Disconnected: ${reason}`,
        needsManualRetry: false,
      });

      // The server closed the socket, so socket.io will not retry on its own.
      // Schedule one reconnect, which fetches a brand new ticket.
      if (reason === "io server disconnect") {
        this.scheduleManualReconnect();
      }
    });

    socket.io.on("reconnect_attempt", () => {
      this.setState({ status: "connecting" });
    });

    socket.io.on("reconnect_failed", () => {
      this.setState({
        status: "error",
        socketId: null,
        error: "Could not reconnect to the realtime server",
        needsManualRetry: true,
      });
    });
  }

  private scheduleManualReconnect() {
    this.clearManualReconnectTimer();
    this.manualReconnectTimer = setTimeout(() => {
      this.manualReconnectTimer = null;
      if (this.socket && !this.socket.connected && !this.socket.active) {
        this.setState({ status: "connecting" });
        this.socket.connect();
      }
    }, RECONNECTION_DELAY_MS);
  }

  private clearManualReconnectTimer() {
    if (this.manualReconnectTimer) {
      clearTimeout(this.manualReconnectTimer);
      this.manualReconnectTimer = null;
    }
  }

  /** Explicit user-triggered retry after reconnection was exhausted. */
  retry(): void {
    this.lastTicketError = null;
    if (!this.socket) {
      this.connect();
      return;
    }
    if (this.socket.connected) return;
    this.setState({ status: "connecting", error: null, needsManualRetry: false });
    this.socket.connect();
  }

  /** Full teardown — used on logout. Listeners registered via `on` are kept. */
  disconnect(): void {
    this.clearManualReconnectTimer();
    this.lastTicketError = null;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.io.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.state = INITIAL_STATE;
    this.stateListeners.forEach((listener) => listener(this.state));
  }

  // ---- events ----

  private reattachHandlers(socket: Socket) {
    this.handlers.forEach((set, event) => {
      set.forEach((handler) => socket.on(event, handler));
    });
  }

  /** Registers a listener and returns its matching `off` for cleanup. */
  on(event: string, handler: EventHandler): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    this.socket?.on(event, handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler);
    this.socket?.off(event, handler);
  }

  /** Fire-and-forget emit. Silently dropped when offline. */
  emit(event: string, payload?: unknown): void {
    if (!this.socket?.connected) return;
    this.socket.emit(event, payload);
  }

  /**
   * Emit expecting the server's `SocketResponse` ack. Never throws: transport
   * problems are normalised into the same error shape the server uses.
   */
  async emitWithAck<T>(
    event: string,
    payload?: unknown,
    timeoutMs = ACK_TIMEOUT_MS,
  ): Promise<SocketResponse<T>> {
    const socket = this.socket;
    if (!socket?.connected) {
      return {
        success: false,
        error: {
          code: "NOT_CONNECTED",
          message: "Realtime connection is not established",
        },
      };
    }

    try {
      const response = await socket
        .timeout(timeoutMs)
        .emitWithAck(event, payload);
      return response as SocketResponse<T>;
    } catch {
      return {
        success: false,
        error: {
          code: "TIMEOUT",
          message: "The realtime server did not respond in time",
        },
      };
    }
  }
}

interface TicketFailure {
  message: string;
  /** Fatal failures stop reconnection; the user retries explicitly. */
  fatal: boolean;
}

function describeTicketError(err: unknown): TicketFailure {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) {
      return {
        message: "Your session expired. Sign in again to reconnect.",
        fatal: true,
      };
    }
    if (err.status === 429) {
      // The ticket endpoint allows 5 requests/minute — backing off further
      // would only deepen the throttle.
      return {
        message: "Too many connection attempts. Wait a moment, then retry.",
        fatal: true,
      };
    }
    return {
      message: err.message || "Could not obtain a realtime ticket",
      fatal: false,
    };
  }
  return {
    message:
      err instanceof Error ? err.message : "Could not obtain a realtime ticket",
    fatal: false,
  };
}

export const realtimeClient = new RealtimeClient();
