"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Mail,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ApiError } from "@/lib/auth/apiClient";
import { startOAuth } from "@/lib/auth/authApi";

function isRecord(value: unknown): value is Record<string, string[]> {
  return typeof value === "object" && value !== null;
}

function fieldErrorMessages(
  fieldErrors: Record<string, string[]>,
  field: string,
): string[] {
  const messages = fieldErrors[field];
  return Array.isArray(messages) ? messages : [];
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "login" | "signup";
}

export function AuthModal({
  isOpen,
  onClose,
  initialMode = "login",
}: AuthModalProps) {
  const { login, register } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  if (!isOpen) return null;

  const clearError = () => {
    setError(null);
    setFieldErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSuccessMsg("");
    clearError();

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register({
          email,
          password,
          username: name,
          displayName: name,
        });
      }
      setSuccessMsg(
        mode === "login"
          ? "You're signed in. Good luck out there."
          : "Account created. Welcome to the arena."
      );
      setTimeout(() => {
        setSuccessMsg("");
        setEmail("");
        setPassword("");
        setName("");
        onClose();
        router.push("/");
      }, 1100);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && isRecord(err.details)) {
        setFieldErrors(err.details);
        setError(null);
      } else {
        setFieldErrors({});
        setError(
          err instanceof ApiError ? err.message : "Something went wrong. Please try again."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuth = (provider: "google" | "github") => {
    startOAuth(provider);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-3xl border border-line bg-bg shadow-modal p-9">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-5 right-5 p-1.5 rounded-full text-ink-3 hover:text-ink hover:bg-elevated transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-md bg-accent text-accent-ink font-mono font-bold text-[13px] flex items-center justify-center">
            {"</>"}
          </span>
          <span className="text-[17px] font-semibold tracking-tight">
            CodeClash
          </span>
        </div>

        <h2 className="mt-6 text-xl font-semibold tracking-tight">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          {mode === "login"
            ? "Sign in to access your profile and live duels."
            : "Start competing against developers worldwide."}
        </p>

        {/* Segmented control */}
        <div className="mt-6 grid grid-cols-2 rounded-xl bg-elevated p-1">
          <button
            onClick={() => {
              clearError();
              setMode("login");
            }}
            className={`h-9 rounded-md text-sm transition-colors ${
              mode === "login"
                ? "bg-bg text-ink font-medium shadow-sm"
                : "text-ink-3 hover:text-ink-2"
            }`}
          >
            Log in
          </button>
          <button
            onClick={() => {
              clearError();
              setMode("signup");
            }}
            className={`h-9 rounded-md text-sm transition-colors ${
              mode === "signup"
                ? "bg-bg text-ink font-medium shadow-sm"
                : "text-ink-3 hover:text-ink-2"
            }`}
          >
            Sign up
          </button>
        </div>

        {/* OAuth */}
        <div className="mt-6 space-y-2.5">
          <button
            onClick={() => handleOAuth("github")}
            className="w-full h-11 rounded-xl border border-line bg-surface text-sm font-medium text-ink flex items-center justify-center gap-2.5 hover:bg-elevated hover:border-line-strong transition-colors"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
            </svg>
            Continue with GitHub
          </button>
          <button
            onClick={() => handleOAuth("google")}
            className="w-full h-11 rounded-xl border border-line bg-surface text-sm font-medium text-ink flex items-center justify-center gap-2.5 hover:bg-elevated hover:border-line-strong transition-colors"
          >
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
            Continue with Google
          </button>
        </div>

        {/* Divider */}
        <div className="relative my-6">
          <div className="border-t border-line" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg px-3 text-xs text-ink-3">
            or continue with email
          </span>
        </div>

        {successMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-success/25 bg-success/5 px-4 py-2.5 text-sm text-success">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {successMsg}
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/5 px-4 py-2.5 text-sm text-danger">
            <span className="mt-0.5 shrink-0">⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-ink mb-1.5"
              >
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-ink-3 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="username"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearError();
                  }}
                  placeholder="alex_dev"
                  aria-invalid={fieldErrorMessages(fieldErrors, "username").length > 0}
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-line bg-surface text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors"
                />
              </div>
              {fieldErrorMessages(fieldErrors, "username").map((msg) => (
                <p key={msg} className="mt-1.5 text-xs text-danger">
                  {msg}
                </p>
              ))}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-ink mb-1.5"
            >
              Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-ink-3 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearError();
                  }}
                  placeholder="alex@example.com"
                  aria-invalid={fieldErrorMessages(fieldErrors, "email").length > 0}
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-line bg-surface text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors"
                />
              </div>
              {fieldErrorMessages(fieldErrors, "email").map((msg) => (
                <p key={msg} className="mt-1.5 text-xs text-danger">
                  {msg}
                </p>
              ))}
            </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium text-ink"
              >
                Password
              </label>
              {mode === "login" && (
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    alert("Password reset instructions sent.");
                  }}
                  className="text-sm text-ink-3 hover:text-ink transition-colors"
                >
                  Forgot?
                </a>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-ink-3 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearError();
                  }}
                  placeholder="••••••••"
                  aria-invalid={fieldErrorMessages(fieldErrors, "password").length > 0}
                  className="w-full h-11 pl-10 pr-11 rounded-xl border border-line bg-surface text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors"
                />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {fieldErrorMessages(fieldErrors, "password").map((msg) => (
              <p key={msg} className="mt-1.5 text-xs text-danger">
                {msg}
              </p>
            ))}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-shine group w-full h-12 rounded-full bg-accent text-accent-ink text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-lifted hover:bg-accent-strong transition-colors disabled:opacity-60"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-accent-ink/30 border-t-accent-ink rounded-full animate-spin" />
            ) : (
              <>
                {mode === "login" ? "Log in" : "Create account"}
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-ink-3">
          By continuing, you agree to our{" "}
          <a href="#" className="underline underline-offset-2 hover:text-ink">
            Terms
          </a>{" "}
          and{" "}
          <a href="#" className="underline underline-offset-2 hover:text-ink">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}
