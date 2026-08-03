"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

export function AuthCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { reload } = useAuth();
  const [failed, setFailed] = useState(false);
  const ran = useRef(false);

  const status = searchParams.get("status");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    reload()
      .then((ok) => {
        if (ok) {
          router.replace("/profile");
        } else {
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));
  }, [searchParams, reload, router]);

  const error =
    status !== "success"
      ? "Sign-in was cancelled or failed."
      : failed
        ? "Could not complete sign-in."
        : null;

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center">
        <div role="alert" className="max-w-sm">
          <h1 className="text-lg font-semibold tracking-tight">Sign-in failed</h1>
          <p className="mt-2 text-sm text-ink-2">{error}</p>
        </div>
        <Link
          href="/"
          className="h-11 px-6 rounded-full bg-accent text-accent-ink text-sm font-semibold inline-flex items-center shadow-lifted hover:bg-accent-strong transition-colors"
        >
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      <p className="text-sm text-ink-2">Signing you in…</p>
    </div>
  );
}
