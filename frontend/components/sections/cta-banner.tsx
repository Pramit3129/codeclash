"use client";

import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";

export function CTABanner({
  onOpenAuth,
}: {
  onOpenAuth: (mode: "login" | "signup") => void;
}) {
  return (
    <section className="py-28">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-line bg-surface px-8 py-16 md:px-16 shadow-lifted">
            <div
              aria-hidden
              className="glow-accent absolute -top-24 -right-24 w-[420px] h-[420px]"
            />
            <div
              aria-hidden
              className="glow-accent absolute -bottom-32 -left-24 w-[360px] h-[360px] opacity-60"
            />
            <div className="relative flex flex-col md:flex-row items-center justify-between gap-10 text-center md:text-left">
              <div className="max-w-xl">
                <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-balance">
                  Ready to become the fastest coder on the leaderboard?
                </h2>
                <p className="mt-4 text-lg text-ink-2 leading-relaxed">
                  Create an account in seconds, challenge developers worldwide,
                  and start climbing today.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3.5 shrink-0">
                <button
                  onClick={() => onOpenAuth("signup")}
                  className="btn-shine group h-12 px-7 rounded-full bg-accent text-accent-ink text-sm font-semibold inline-flex items-center gap-2 shadow-lifted hover:bg-accent-strong transition-colors"
                >
                  Get started free
                  <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
                <button
                  onClick={() => onOpenAuth("login")}
                  className="h-12 px-7 rounded-full border border-line bg-bg text-sm font-medium text-ink hover:bg-elevated hover:border-line-strong transition-colors"
                >
                  Log in
                </button>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
