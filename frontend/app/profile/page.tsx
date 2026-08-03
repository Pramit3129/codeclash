"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Globe,
  Key,
  Laptop,
  Link2,
  LogOut,
  Mail,
  Monitor,
  Plus,
  Shield,
  Smartphone,
  Unlink,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ApiError } from "@/lib/auth/apiClient";
import {
  getMe,
  listSessions,
  revokeSession,
  setPassword,
  startOAuth,
  unlinkAccount,
  type AuthAccount,
  type AuthSession,
  type Provider,
  type User,
} from "@/lib/auth/authApi";

interface ProfileData {
  user: User;
  accounts: AuthAccount[];
  sessions: AuthSession[];
}

// OAuth providers that can be connected from this page (LOCAL is handled by the
// password section, not a "connect" button).
const OAUTH_PROVIDERS: { provider: Extract<Provider, "GITHUB" | "GOOGLE">; label: string; oauth: "github" | "google" }[] = [
  { provider: "GITHUB", label: "GitHub", oauth: "github" },
  { provider: "GOOGLE", label: "Google", oauth: "google" },
];

async function loadProfile(): Promise<ProfileData | null> {
  try {
    const me = await getMe();
    const { sessions } = await listSessions();
    return { user: me.user, accounts: me.accounts, sessions };
  } catch {
    return null;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function deviceIcon(userAgent: string | null) {
  const ua = userAgent?.toLowerCase() ?? "";
  if (/iphone|ipad|android|mobile/.test(ua)) return Smartphone;
  if (/mac|windows|linux|chromeos|ipad/.test(ua)) return Laptop;
  return Monitor;
}

function providerLabel(provider: Provider): string {
  if (provider === "LOCAL") return "Email & password";
  return provider.charAt(0) + provider.slice(1).toLowerCase();
}

function ProviderIcon({ provider }: { provider: Provider }) {
  if (provider === "GITHUB") {
    return (
      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
      </svg>
    );
  }
  if (provider === "GOOGLE") {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        />
      </svg>
    );
  }
  return <Mail className="w-4 h-4" />;
}

function ProfileFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileFallback />}>
      <ProfileContent />
    </Suspense>
  );
}

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, reload, logout } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState<Provider | null>(null);

  // Surface the result of an OAuth "link" round-trip (returnTo=/profile).
  // Derived once from the query param so we don't setState inside an effect.
  const linkStatus = searchParams.get("status");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(
    () =>
      linkStatus === "success"
        ? { kind: "success", text: "Account linked successfully." }
        : linkStatus === "error"
          ? {
              kind: "error",
              text: "Couldn't link that account — it may already be linked to another user.",
            }
          : null,
  );

  // Clean the query string so a refresh doesn't re-show the banner.
  useEffect(() => {
    if (linkStatus) router.replace("/profile");
  }, [linkStatus, router]);

  useEffect(() => {
    loadProfile().then((data) => {
      if (data) setProfile(data);
      else setError("Could not load profile data.");
    });
  }, []);

  const accounts = useMemo(() => profile?.accounts ?? [], [profile]);
  const sessions = useMemo(() => profile?.sessions ?? [], [profile]);
  const linkedProviders = useMemo(
    () => new Set(accounts.map((a) => a.provider)),
    [accounts],
  );
  const hasLocal = linkedProviders.has("LOCAL");
  // Refuse to let the user strip their last remaining way to sign in.
  const canUnlink = accounts.length > 1;

  const refreshProfile = async () => {
    const data = await loadProfile();
    if (data) setProfile(data);
    return data;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Not signed in</h1>
          <p className="mt-2 text-sm text-ink-2">
            Sign in to view your profile and sessions.
          </p>
        </div>
        <Link
          href="/"
          className="h-11 px-6 rounded-full bg-accent text-accent-ink text-sm font-semibold inline-flex items-center shadow-lifted hover:bg-accent-strong transition-colors"
        >
          Go to home
        </Link>
      </div>
    );
  }

  const handleRevoke = async (id: string) => {
    try {
      await revokeSession(id);
      setProfile((prev) =>
        prev ? { ...prev, sessions: prev.sessions.filter((s) => s.id !== id) } : prev
      );
    } catch {
      setError("Could not revoke that session.");
    }
  };

  const handleConnect = (oauth: "github" | "google") => {
    startOAuth(oauth, { returnTo: "/profile" });
  };

  const handleUnlink = async (provider: Provider) => {
    setNotice(null);
    setUnlinking(provider);
    try {
      await unlinkAccount(provider);
      await refreshProfile();
      setNotice({ kind: "success", text: `${providerLabel(provider)} unlinked.` });
    } catch (err) {
      setNotice({
        kind: "error",
        text:
          err instanceof ApiError
            ? err.message
            : "Could not unlink that account.",
      });
    } finally {
      setUnlinking(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    setProfile(null);
    router.push("/");
  };

  const handleReload = async () => {
    setError(null);
    const ok = await reload();
    if (!ok) return;
    await refreshProfile();
  };

  return (
    <div className="min-h-screen bg-bg text-ink font-sans antialiased overflow-x-hidden">
      <div className="mx-auto max-w-3xl px-5 sm:px-8 pt-28 pb-24">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        {notice && (
          <div
            className={`mt-6 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
              notice.kind === "success"
                ? "border-success/25 bg-success/5 text-success"
                : "border-danger/25 bg-danger/5 text-danger"
            }`}
          >
            <span>{notice.text}</span>
            <button
              onClick={() => setNotice(null)}
              className="shrink-0 text-xs font-medium underline underline-offset-2 hover:opacity-80"
            >
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger">
            <span>{error}</span>
            <button
              onClick={handleReload}
              className="shrink-0 text-sm font-medium underline underline-offset-2 hover:opacity-80"
            >
              Retry
            </button>
          </div>
        )}

        {/* Profile header */}
        <section className="mt-6 rounded-3xl border border-line bg-surface shadow-soft p-7 sm:p-9">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {user.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar}
                alt={user.displayName || user.username}
                className="w-20 h-20 rounded-2xl ring-2 ring-accent/20 object-cover"
              />
            ) : (
              <span className="w-20 h-20 rounded-2xl bg-accent/12 border border-accent/15 text-accent text-2xl font-semibold flex items-center justify-center">
                {getInitials(user.displayName || user.username)}
              </span>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {user.displayName || user.username}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                  <Shield className="w-3 h-3" />
                  {user.role}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-2">@{user.username}</p>
              <p className="mt-3 text-sm text-ink-3">
                Member since {formatDate(user.createdAt)}
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-line-strong text-sm font-medium text-ink hover:bg-elevated transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          </div>
        </section>

        {/* Linked accounts */}
        <section className="mt-6 rounded-3xl border border-line bg-surface shadow-soft p-6 sm:p-7">
          <h2 className="text-sm font-semibold tracking-tight">Linked accounts</h2>
          <p className="mt-1 text-xs text-ink-3">
            Connect multiple providers to sign in any way you like. They all share
            one CodeClash account.
          </p>

          <ul className="mt-5 space-y-3">
            {/* Existing linked accounts */}
            {accounts.map((account) => (
              <li
                key={account.provider}
                className="flex items-center gap-3 rounded-xl border border-line bg-bg px-4 py-3"
              >
                <span className="w-8 h-8 rounded-lg bg-elevated text-ink-2 flex items-center justify-center">
                  <ProviderIcon provider={account.provider} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium">
                    {providerLabel(account.provider)}
                  </span>
                  <span className="block text-xs text-ink-3 truncate">
                    {account.email ?? "No email"}
                  </span>
                </span>
                {account.emailVerified ? (
                  <span className="inline-flex items-center gap-1 text-xs text-success">
                    <Check className="w-3.5 h-3.5" />
                    Verified
                  </span>
                ) : (
                  <span className="text-xs text-ink-3">Unverified</span>
                )}
                {canUnlink ? (
                  <button
                    onClick={() => handleUnlink(account.provider)}
                    disabled={unlinking === account.provider}
                    title={`Unlink ${providerLabel(account.provider)}`}
                    className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-danger hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {unlinking === account.provider ? (
                      <span className="inline-block w-3.5 h-3.5 border-2 border-danger/30 border-t-danger rounded-full animate-spin" />
                    ) : (
                      <Unlink className="w-3.5 h-3.5" />
                    )}
                    Unlink
                  </button>
                ) : (
                  <span
                    title="This is your only way to sign in — add another before removing it."
                    className="shrink-0 text-[11px] font-medium text-ink-3"
                  >
                    Only login
                  </span>
                )}
              </li>
            ))}

            {/* Connectable OAuth providers not yet linked */}
            {OAUTH_PROVIDERS.filter((p) => !linkedProviders.has(p.provider)).map(
              (p) => (
                <li
                  key={p.provider}
                  className="flex items-center gap-3 rounded-xl border border-dashed border-line px-4 py-3"
                >
                  <span className="w-8 h-8 rounded-lg bg-elevated text-ink-3 flex items-center justify-center">
                    <ProviderIcon provider={p.provider} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-ink-2">
                      {p.label}
                    </span>
                    <span className="block text-xs text-ink-3">Not connected</span>
                  </span>
                  <button
                    onClick={() => handleConnect(p.oauth)}
                    className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-line-strong text-xs font-medium text-ink hover:bg-elevated transition-colors"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Connect
                  </button>
                </li>
              ),
            )}
          </ul>
        </section>

        {/* Password & security */}
        <PasswordSection
          hasLocal={hasLocal}
          onDone={async () => {
            await refreshProfile();
          }}
          onNotice={setNotice}
        />

        {/* Active sessions */}
        <section className="mt-6 rounded-3xl border border-line bg-surface shadow-soft p-6 sm:p-7">
          <h2 className="text-sm font-semibold tracking-tight">Active sessions</h2>
          <p className="mt-1 text-xs text-ink-3">Devices currently signed in.</p>

          <ul className="mt-5 space-y-3">
            {sessions.length === 0 && (
              <li className="text-sm text-ink-3">No active sessions.</li>
            )}
            {sessions.map((session) => {
              const DeviceIcon = deviceIcon(session.userAgent);
              return (
                <li
                  key={session.id}
                  className="flex items-center gap-3 rounded-xl border border-line bg-bg px-4 py-3"
                >
                  <span className="w-8 h-8 rounded-lg bg-elevated text-ink-2 flex items-center justify-center">
                    <DeviceIcon className="w-4 h-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {session.deviceName ?? "Browser session"}
                      {session.current && (
                        <span className="rounded-full bg-accent/10 border border-accent/25 text-accent text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5">
                          Current
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-ink-3 truncate">
                      {session.ipAddress ? `${session.ipAddress} · ` : ""}
                      {session.userAgent?.slice(0, 40)}
                    </span>
                  </span>
                  <span className="text-xs text-ink-3 whitespace-nowrap">
                    {formatRelative(session.lastUsedAt)}
                  </span>
                  {!session.current && (
                    <button
                      onClick={() => handleRevoke(session.id)}
                      className="shrink-0 text-xs font-medium text-danger hover:underline"
                    >
                      Revoke
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-5 flex items-center gap-1.5 text-xs text-ink-3">
            <Globe className="w-3.5 h-3.5" />
            <span>This page shows {sessions.length} of your active sessions.</span>
          </div>
        </section>
      </div>
    </div>
  );
}

function PasswordSection({
  hasLocal,
  onDone,
  onNotice,
}: {
  hasLocal: boolean;
  onDone: () => Promise<void>;
  onNotice: (n: { kind: "success" | "error"; text: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setFieldError(null);
    setShow(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFieldError(null);
    try {
      await setPassword(newPassword, hasLocal ? currentPassword : undefined);
      onNotice({
        kind: "success",
        text: hasLocal
          ? "Password updated. Other sessions were signed out."
          : "Password set — you can now sign in with email and password.",
      });
      reset();
      setOpen(false);
      await onDone();
    } catch (err) {
      setFieldError(
        err instanceof ApiError ? err.message : "Could not save your password.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-6 rounded-3xl border border-line bg-surface shadow-soft p-6 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            Password &amp; security
          </h2>
          <p className="mt-1 text-xs text-ink-3">
            {hasLocal
              ? "Change the password for email sign-in."
              : "Set a password to also sign in with your email — handy if you signed up with GitHub or Google."}
          </p>
        </div>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-line-strong text-xs font-medium text-ink hover:bg-elevated transition-colors"
          >
            {hasLocal ? <Key className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {hasLocal ? "Change password" : "Set a password"}
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {hasLocal && (
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Current password
              </label>
              <input
                type={show ? "text" : "password"}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 px-3.5 rounded-xl border border-line bg-bg text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              {hasLocal ? "New password" : "Password"}
            </label>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full h-11 px-3.5 pr-11 rounded-xl border border-line bg-bg text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label="Toggle password visibility"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink transition-colors"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {fieldError && <p className="text-xs text-danger">{fieldError}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full bg-accent text-accent-ink text-sm font-semibold shadow-lifted hover:bg-accent-strong transition-colors disabled:opacity-60"
            >
              {busy ? (
                <span className="inline-block w-4 h-4 border-2 border-accent-ink/30 border-t-accent-ink rounded-full animate-spin" />
              ) : hasLocal ? (
                "Update password"
              ) : (
                "Set password"
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              className="h-10 px-4 rounded-full text-sm font-medium text-ink-2 hover:text-ink transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
