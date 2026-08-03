"use client";

import { ArrowRight, Play } from "lucide-react";

interface HeroSectionProps {
  onOpenAuth: (mode: "login" | "signup") => void;
  onWatchDemo: () => void;
}

const AVATARS = [
  { initials: "NK", bg: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  { initials: "AR", bg: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  { initials: "SW", bg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { initials: "DP", bg: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
];

export function HeroSection({ onOpenAuth, onWatchDemo }: HeroSectionProps) {
  return (
    <section className="relative pt-44 pb-24 overflow-hidden">
      {/* Energy layers */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="aurora absolute -top-52 left-1/2 -translate-x-1/2 w-[900px] h-[620px] opacity-70" />
        <div className="bg-grid-faint absolute inset-0" />
        <div className="glow-accent absolute -top-48 left-1/2 -translate-x-1/2 w-[820px] h-[520px]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-48 bg-gradient-to-t from-bg to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        <div className="flex flex-col items-center text-center">
          {/* Eyebrow */}
          <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 backdrop-blur px-4 py-1.5 text-xs font-medium text-ink-2 shadow-soft">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            Now in open beta — 100,000+ developers
          </div>

          {/* Headline */}
          <h1
            className="animate-fade-up mt-8 text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-semibold tracking-tighter leading-[1.02] text-balance"
            style={{ animationDelay: "80ms" }}
          >
            Compete. Solve.
            <br />
            <span className="text-energized">Become legendary.</span>
          </h1>

          {/* Subtitle */}
          <p
            className="animate-fade-up mt-7 max-w-2xl text-lg sm:text-xl text-ink-2 leading-relaxed text-pretty"
            style={{ animationDelay: "160ms" }}
          >
            Solve algorithmic challenges against real developers in real time.
            Sharpen your DSA through live 1v1 duels, ranked contests, and
            instant matchmaking.
          </p>

          {/* CTAs */}
          <div
            className="animate-fade-up mt-10 flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto"
            style={{ animationDelay: "240ms" }}
          >
            <button
              onClick={() => onOpenAuth("signup")}
              className="btn-shine group w-full sm:w-auto h-12 px-7 rounded-full bg-accent text-accent-ink text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-lifted hover:bg-accent-strong transition-colors"
            >
              Get started free
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
            <button
              onClick={onWatchDemo}
              className="w-full sm:w-auto h-12 px-7 rounded-full border border-line bg-surface text-sm font-medium text-ink inline-flex items-center justify-center gap-2 shadow-soft hover:bg-elevated hover:border-line-strong transition-colors"
            >
              <Play className="w-3.5 h-3.5 text-accent fill-current" />
              Watch a live battle
            </button>
          </div>

          {/* Social proof */}
          <div
            className="animate-fade-up mt-12 flex flex-col sm:flex-row items-center gap-3.5"
            style={{ animationDelay: "320ms" }}
          >
            <div className="flex -space-x-2.5">
              {AVATARS.map((avatar) => (
                <span
                  key={avatar.initials}
                  className={`w-9 h-9 rounded-full ${avatar.bg} ring-2 ring-bg flex items-center justify-center text-[11px] font-semibold`}
                >
                  {avatar.initials}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2.5 text-sm text-ink-2">
              <span className="flex" aria-hidden>
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg
                    key={i}
                    viewBox="0 0 20 20"
                    className="w-4 h-4 fill-accent"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 0 0 .95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1 1 0 0 0-.363 1.118l1.286 3.958c.3.922-.755 1.688-1.538 1.118l-3.367-2.446a1 1 0 0 0-1.176 0l-3.367 2.446c-.783.57-1.838-.196-1.538-1.118l1.286-3.958a1 1 0 0 0-.363-1.118L2.063 9.385c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 0 0 .95-.69l1.286-3.958Z" />
                  </svg>
                ))}
              </span>
              <span>Rated 4.9/5 by competitive programmers</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
