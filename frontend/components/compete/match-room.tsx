"use client";

import { LogIn, LogOut, UserMinus, Users } from "lucide-react";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";
import { useMatchRoom } from "@/lib/realtime/useMatchRoom";

const ERROR_COPY: Record<string, string> = {
  UNAUTHORIZED: "Your realtime session is no longer authenticated.",
  INVALID_PAYLOAD: "That match id is not valid.",
  FORBIDDEN: "You are not a participant in this match.",
  NOT_IN_ROOM: "You are not in this match room.",
  NOT_CONNECTED: "Waiting for the realtime connection.",
  TIMEOUT: "The realtime server did not respond. Try again.",
};

function shortId(userId: string): string {
  return userId.length > 10 ? `${userId.slice(0, 6)}…${userId.slice(-4)}` : userId;
}

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

interface MatchRoomProps {
  matchId: string;
  onLeft: () => void;
}

export function MatchRoom({ matchId, onLeft }: MatchRoomProps) {
  const { isConnected } = useRealtime();
  const { status, error, participants, activity, lastDeparture, leave } =
    useMatchRoom(matchId);

  const handleLeave = async () => {
    await leave();
    onLeft();
  };

  return (
    <div className="p-5 rounded-xl bg-surface border border-line space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-ink-3 mb-1">Match room</p>
          <p className="text-sm font-mono text-ink truncate">{matchId}</p>
        </div>
        <button
          onClick={handleLeave}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-ink-2 hover:text-ink bg-elevated border border-line hover:border-line-strong rounded-lg transition-colors flex-shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          Leave
        </button>
      </div>

      {status === "joining" && (
        <p className="text-sm text-ink-2">Joining match room…</p>
      )}

      {status === "idle" && !isConnected && (
        <p className="text-sm text-ink-2">
          Waiting for the realtime connection…
        </p>
      )}

      {status === "error" && error && (
        <p className="text-sm text-danger">
          {ERROR_COPY[error.code] ?? error.message}
        </p>
      )}

      {status === "joined" && (
        <div className="flex items-center gap-2.5 text-sm">
          {lastDeparture ? (
            <>
              <UserMinus className="w-4 h-4 text-danger flex-shrink-0" />
              <span className="text-danger font-medium">
                Opponent left the match
              </span>
              <span className="text-xs text-ink-3">
                {formatTime(lastDeparture.at)}
              </span>
            </>
          ) : (
            <>
              <Users className="w-4 h-4 text-ink-3 flex-shrink-0" />
              {participants.length === 0 ? (
                <span className="text-ink-2">Waiting for an opponent…</span>
              ) : (
                <span className="text-ink">
                  {participants.length === 1
                    ? "Opponent connected"
                    : `${participants.length} others connected`}
                </span>
              )}
            </>
          )}
        </div>
      )}

      {participants.length > 0 && (
        <ul className="space-y-1.5">
          {participants.map((userId) => (
            <li
              key={userId}
              className="flex items-center gap-2 text-xs font-mono text-ink-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" />
              {userId}
            </li>
          ))}
        </ul>
      )}

      {activity.length > 0 && (
        <div className="pt-3 border-t border-line">
          <p className="text-xs text-ink-3 mb-2">Room activity</p>
          <ul className="space-y-1.5">
            {activity.map((entry) => (
              <li key={entry.id} className="flex items-center gap-2 text-xs">
                {entry.type === "joined" ? (
                  <LogIn className="w-3.5 h-3.5 text-success flex-shrink-0" />
                ) : (
                  <UserMinus className="w-3.5 h-3.5 text-danger flex-shrink-0" />
                )}
                <span className="font-mono text-ink-2">
                  {shortId(entry.userId)}
                </span>
                <span
                  className={
                    entry.type === "joined" ? "text-success" : "text-danger"
                  }
                >
                  {entry.type === "joined" ? "joined" : "left"}
                </span>
                <span className="text-ink-3 ml-auto tabular-nums">
                  {formatTime(entry.at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
