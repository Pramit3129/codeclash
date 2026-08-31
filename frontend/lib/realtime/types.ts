// Mirrors backend/src/modules/realtime/socket.types.ts
export interface SocketErrorDetails {
  code: string;
  message: string;
  details?: unknown;
}

export interface SocketSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

export interface SocketErrorResponse {
  success: false;
  error: SocketErrorDetails;
}

export type SocketResponse<T = unknown> =
  | SocketSuccessResponse<T>
  | SocketErrorResponse;

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export interface RealtimeState {
  status: ConnectionStatus;
  socketId: string | null;
  /** Human readable reason for the last failure, if any. */
  error: string | null;
  /** True once reconnection has been given up on and a manual retry is needed. */
  needsManualRetry: boolean;
}

export interface MatchRoomPayload {
  matchId: string;
}

/** Broadcast to the match room when another participant joins/leaves. */
export interface RoomMembershipEvent {
  userId: string;
  matchId: string;
}
