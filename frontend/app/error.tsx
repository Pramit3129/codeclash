"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw } from "lucide-react";

/**
 * Route-level error boundary.
 *
 * Without this, a render error anywhere under `app/` unmounts the whole tree:
 * the tab goes blank and any work the page owned — open judge streams,
 * in-flight submissions — is torn down with it. Containing the failure keeps
 * the rest of the app alive and gives the user a way back.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled render error:", error);
  }, [error]);

  return (
    <div className="min-h-screen pt-20 flex items-center justify-center px-5">
      <div className="text-center max-w-sm">
        <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-ink mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-ink-2 mb-4">
          This page hit an unexpected error. Your submissions are safe — they
          keep judging on the server.
        </p>
        {error.digest && (
          <p className="text-xs text-ink-3 font-mono mb-4">
            Reference: {error.digest}
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/problems"
            className="px-4 py-2 text-sm font-medium text-ink-2 hover:text-ink bg-surface border border-line rounded-lg transition-colors"
          >
            Back to problems
          </Link>
          <button
            onClick={() => unstable_retry()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/8 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
