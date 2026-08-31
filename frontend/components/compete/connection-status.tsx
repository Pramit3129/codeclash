"use client";

import { PowerOff, RefreshCw } from "lucide-react";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";
import type { ConnectionStatus } from "@/lib/realtime/types";

const STATUS_COPY: Record<ConnectionStatus, string> = {
  idle: "Not connected",
  connecting: "Connecting…",
  connected: "Live",
  disconnected: "Reconnecting…",
  error: "Connection failed",
};

const STATUS_DOT: Record<ConnectionStatus, string> = {
  idle: "bg-ink-3",
  connecting: "bg-accent animate-pulse",
  connected: "bg-success",
  disconnected: "bg-accent animate-pulse",
  error: "bg-danger",
};

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  idle: "text-ink-3",
  connecting: "text-ink-2",
  connected: "text-success",
  disconnected: "text-ink-2",
  error: "text-danger",
};

interface ConnectionStatusProps {
  /** Renders a "Go offline" action that tears the connection down. */
  onGoOffline?: () => void;
}

export function ConnectionStatus({ onGoOffline }: ConnectionStatusProps) {
  const { status, error, needsManualRetry, retry, isConfigured } =
    useRealtime();

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-surface border border-line">
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[status]}`}
        aria-hidden
      />
      <span className={`text-sm font-medium ${STATUS_TEXT[status]}`}>
        {STATUS_COPY[status]}
      </span>

      {error && (
        <span className="text-xs text-ink-3 flex-1 min-w-0 truncate">
          {error}
        </span>
      )}

      {needsManualRetry && isConfigured && (
        <button
          onClick={retry}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 rounded-lg transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reconnect
        </button>
      )}

      {onGoOffline && (
        <button
          onClick={onGoOffline}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-2 hover:text-ink hover:bg-elevated rounded-lg transition-colors ml-auto"
        >
          <PowerOff className="w-3.5 h-3.5" />
          Go offline
        </button>
      )}
    </div>
  );
}
