"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtime } from "./RealtimeProvider";
import type {
  MatchRoomPayload,
  RoomMembershipEvent,
  SocketErrorDetails,
} from "./types";

export type MatchRoomStatus = "idle" | "joining" | "joined" | "error";

/** A `room.joined` / `room.left` broadcast, kept for the activity feed. */
export interface MatchRoomActivity {
  id: string;
  type: "joined" | "left";
  userId: string;
  at: number;
}

/** How many membership events the feed retains. */
const MAX_ACTIVITY = 20;

let activitySeq = 0;

export interface MatchRoomState {
  status: MatchRoomStatus;
  error: SocketErrorDetails | null;
  /**
   * Other user ids seen joining this room during the current connection. The
   * server broadcasts `room.joined` only for *subsequent* joiners, so this is
   * "who arrived after us", not a full roster.
   */
  participants: string[];
  /** Membership changes, newest first — lets the UI announce joins and leaves. */
  activity: MatchRoomActivity[];
  /** The most recent departure, so "opponent left" survives an empty roster. */
  lastDeparture: MatchRoomActivity | null;
  leave: () => Promise<void>;
}

/** Settled outcome of one join attempt, scoped to the attempt that produced it. */
interface JoinOutcome {
  /** `${matchId}::${socketId}` — a reconnect invalidates the previous outcome. */
  key: string;
  status: "joined" | "error" | "left";
  error: SocketErrorDetails | null;
}

/**
 * Joins `match:{matchId}` for as long as the component is mounted and the
 * socket is connected, and mirrors room membership broadcasts into state.
 *
 * Every `on` registered here has a matching `off` in the effect cleanup, so
 * navigating in and out of the match view cannot accumulate listeners.
 */
export function useMatchRoom(matchId: string | null): MatchRoomState {
  const { on, emit, emitWithAck, socketId } = useRealtime();
  const [outcome, setOutcome] = useState<JoinOutcome | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [activity, setActivity] = useState<MatchRoomActivity[]>([]);
  // Tracks whether the server currently considers this socket in the room, so
  // teardown does not emit a leave for a room we never entered.
  const inRoomRef = useRef(false);

  // A new socket id means a new handshake, so the room must be re-joined.
  const attemptKey = matchId && socketId ? `${matchId}::${socketId}` : null;

  // ---- membership broadcasts ----
  useEffect(() => {
    if (!matchId) return;

    const record = (type: MatchRoomActivity["type"], userId: string) => {
      const entry: MatchRoomActivity = {
        id: `${type}-${userId}-${++activitySeq}`,
        type,
        userId,
        at: Date.now(),
      };
      setActivity((prev) => [entry, ...prev].slice(0, MAX_ACTIVITY));
    };

    const handleJoined = (payload: RoomMembershipEvent) => {
      if (payload?.matchId !== matchId || !payload.userId) return;
      setParticipants((prev) =>
        prev.includes(payload.userId) ? prev : [...prev, payload.userId],
      );
      record("joined", payload.userId);
    };

    const handleLeft = (payload: RoomMembershipEvent) => {
      if (payload?.matchId !== matchId || !payload.userId) return;
      setParticipants((prev) => prev.filter((id) => id !== payload.userId));
      record("left", payload.userId);
    };

    const offJoined = on("room.joined", handleJoined);
    const offLeft = on("room.left", handleLeft);

    return () => {
      offJoined();
      offLeft();
    };
  }, [matchId, on]);

  // ---- join / leave lifecycle ----
  useEffect(() => {
    // No match selected, or not connected (yet). `attemptKey` already reads as
    // "joining" once both are available, so there is nothing to set here.
    if (!matchId || !attemptKey) return;

    let cancelled = false;

    emitWithAck<MatchRoomPayload>("match.join", { matchId }).then((response) => {
      if (cancelled) return;
      inRoomRef.current = response.success;
      setOutcome({
        key: attemptKey,
        status: response.success ? "joined" : "error",
        error: response.success ? null : response.error,
      });
    });

    return () => {
      cancelled = true;
      if (inRoomRef.current) {
        inRoomRef.current = false;
        // Fire-and-forget: on an unmount or a dropped connection there is no
        // one left to await the ack.
        emit("match.leave", { matchId });
      }
      setParticipants([]);
      setActivity([]);
      setOutcome(null);
    };
  }, [matchId, attemptKey, emit, emitWithAck]);

  const leave = useCallback(async () => {
    if (!matchId || !attemptKey || !inRoomRef.current) return;
    inRoomRef.current = false;
    const response = await emitWithAck<MatchRoomPayload>("match.leave", {
      matchId,
    });
    setParticipants([]);
    setActivity([]);
    setOutcome({
      key: attemptKey,
      status: response.success ? "left" : "error",
      error: response.success ? null : response.error,
    });
  }, [matchId, attemptKey, emitWithAck]);

  const current = outcome?.key === attemptKey ? outcome : null;

  let status: MatchRoomStatus;
  if (!attemptKey) {
    status = "idle";
  } else if (!current || current.status === "left") {
    status = current ? "idle" : "joining";
  } else {
    status = current.status;
  }

  // Surfaces "opponent left" even though the roster is back to empty — but only
  // while nobody has since rejoined.
  const lastDeparture =
    activity[0]?.type === "left" && participants.length === 0
      ? activity[0]
      : null;

  return {
    status,
    error: current?.error ?? null,
    participants,
    activity,
    lastDeparture,
    leave,
  };
}
