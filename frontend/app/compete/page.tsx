"use client";

import { useState, type FormEvent } from "react";
import { Swords } from "lucide-react";
import { Navbar } from "@/components/ui/navbar";
import { AuthModal } from "@/components/auth/auth-modal";
import { ConnectionStatus } from "@/components/compete/connection-status";
import { MatchRoom } from "@/components/compete/match-room";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";
import { REALTIME_ENV_VAR } from "@/lib/realtime/config";

export default function CompetePage() {
  const { user, loading } = useAuth();
  const { isConfigured, isConnected, status, connect, disconnect } =
    useRealtime();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [matchIdInput, setMatchIdInput] = useState("");
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);

  const handleOpenAuth = (mode: "login" | "signup") => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const handleJoin = (event: FormEvent) => {
    event.preventDefault();
    const matchId = matchIdInput.trim();
    if (!matchId) return;
    setActiveMatchId(matchId);
  };

  const handleGoOffline = () => {
    setActiveMatchId(null);
    disconnect();
  };

  // "idle" means no socket has been opened yet — nothing connects, and no WS
  // ticket is requested, until the user presses Ready.
  const isOffline = status === "idle";

  return (
    <div className="min-h-screen bg-bg text-ink font-sans antialiased">
      <Navbar onOpenAuth={handleOpenAuth} />

      <main className="pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-5 sm:px-8">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-ink mb-2 flex items-center gap-2.5">
              <Swords className="w-6 h-6 text-accent" />
              Compete
            </h1>
            <p className="text-ink-2 text-sm">
              Live 1v1 duels. Your realtime connection opens automatically while
              you are signed in.
            </p>
          </div>

          {loading && (
            <div className="h-16 rounded-xl bg-surface border border-line animate-pulse" />
          )}

          {!loading && !user && (
            <div className="p-6 rounded-xl bg-surface border border-line text-center">
              <p className="text-sm text-ink-2 mb-4">
                Sign in to connect to the realtime arena.
              </p>
              <button
                onClick={() => handleOpenAuth("login")}
                className="h-10 px-5 rounded-full bg-accent text-accent-ink text-sm font-semibold hover:bg-accent-strong transition-colors"
              >
                Log in
              </button>
            </div>
          )}

          {!loading && user && !isConfigured && (
            <div className="p-4 rounded-xl bg-danger/8 border border-danger/20">
              <p className="text-sm text-danger">
                Realtime is not configured. Set{" "}
                <code className="font-mono">{REALTIME_ENV_VAR}</code> to the
                realtime server URL and rebuild.
              </p>
            </div>
          )}

          {!loading && user && isConfigured && isOffline && (
            <div className="p-8 rounded-xl bg-surface border border-line text-center">
              <span className="w-12 h-12 mx-auto mb-4 rounded-full bg-accent/12 border border-accent/15 flex items-center justify-center">
                <Swords className="w-5 h-5 text-accent" />
              </span>
              <h2 className="text-base font-semibold text-ink mb-1.5">
                Ready to compete?
              </h2>
              <p className="text-sm text-ink-2 mb-5 max-w-sm mx-auto">
                You are offline. Going ready opens your live connection to the
                arena so opponents can reach you.
              </p>
              <button
                onClick={connect}
                className="h-10 px-6 rounded-full bg-accent text-accent-ink text-sm font-semibold hover:bg-accent-strong transition-colors"
              >
                I&rsquo;m ready
              </button>
            </div>
          )}

          {!loading && user && isConfigured && !isOffline && (
            <div className="space-y-4">
              <ConnectionStatus onGoOffline={handleGoOffline} />

              {activeMatchId ? (
                <MatchRoom
                  matchId={activeMatchId}
                  onLeft={() => setActiveMatchId(null)}
                />
              ) : (
                <form
                  onSubmit={handleJoin}
                  className="p-5 rounded-xl bg-surface border border-line space-y-3"
                >
                  <label
                    htmlFor="match-id"
                    className="block text-sm font-medium text-ink"
                  >
                    Join a match room
                  </label>
                  <p className="text-xs text-ink-3">
                    Matchmaking is not live yet — enter a match id to open its
                    realtime room.
                  </p>
                  <div className="flex gap-2">
                    <input
                      id="match-id"
                      value={matchIdInput}
                      onChange={(e) => setMatchIdInput(e.target.value)}
                      placeholder="match id"
                      autoComplete="off"
                      className="flex-1 h-10 px-3 rounded-lg bg-elevated border border-line text-sm font-mono text-ink placeholder:text-ink-3 focus:border-line-strong outline-none transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={!matchIdInput.trim() || !isConnected}
                      className="h-10 px-5 rounded-lg bg-accent text-accent-ink text-sm font-semibold hover:bg-accent-strong transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Join
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </main>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
      />
    </div>
  );
}
