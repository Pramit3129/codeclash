import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 — Page not found",
  description:
    "This path doesn't lead anywhere. Head back to the CodeClash arena.",
};

export default function NotFound() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-5 py-32 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
        Error 404
      </p>
      <h1 className="mt-6 text-6xl sm:text-7xl font-semibold tracking-tighter text-energized">
        404
      </h1>
      <p className="mt-6 max-w-md text-lg text-ink-2 leading-relaxed">
        This path leads nowhere — not even to the leaderboard. Find your way
        back to a real duel.
      </p>
      <Link
        href="/"
        className="btn-shine group mt-9 inline-flex h-12 items-center gap-2 rounded-full bg-accent px-7 text-sm font-semibold text-accent-ink shadow-lifted transition-colors hover:bg-accent-strong"
      >
        Back to the arena
      </Link>
    </div>
  );
}
