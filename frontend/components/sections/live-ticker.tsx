"use client";

import { Reveal } from "@/components/ui/reveal";

const DUELS = [
  {
    winner: "neha_42",
    wElo: 2104,
    loser: "code_master",
    lElo: 2051,
    problem: "Two Sum",
    lang: "Python",
    time: "142 ms",
  },
  {
    winner: "algoNinja",
    wElo: 1987,
    loser: "devKartic",
    lElo: 1924,
    problem: "Longest Substring",
    lang: "C++",
    time: "96 ms",
  },
  {
    winner: "syntax_king",
    wElo: 1900,
    loser: "quant_dom",
    lElo: 1888,
    problem: "Binary Tree Level Order",
    lang: "TypeScript",
    time: "210 ms",
  },
  {
    winner: "binary_brain",
    wElo: 1964,
    loser: "neon_dev",
    lElo: 1912,
    problem: "Coin Change",
    lang: "Java",
    time: "168 ms",
  },
  {
    winner: "devKartic",
    wElo: 1924,
    loser: "loop_legend",
    lElo: 1863,
    problem: "Validate BST",
    lang: "Python",
    time: "88 ms",
  },
  {
    winner: "code_master",
    wElo: 2051,
    loser: "algoNinja",
    lElo: 1987,
    problem: "Sliding Window Max",
    lang: "C++",
    time: "120 ms",
  },
];

function Avatar({ initials, hue }: { initials: string; hue: string }) {
  return (
    <span
      className={`w-6 h-6 rounded-full ${hue} flex items-center justify-center text-[10px] font-semibold shrink-0`}
    >
      {initials}
    </span>
  );
}

export function LiveTicker() {
  return (
    <section className="relative py-16 border-y border-line overflow-hidden bg-surface/50">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
      >
        <div className="glow-accent absolute -top-24 left-1/4 w-96 h-48 opacity-60" />
        <div className="glow-accent absolute -bottom-24 right-1/4 w-96 h-48 opacity-60" />
      </div>

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal>
          <div className="flex flex-col md:flex-row items-center gap-5">
            {/* Live badge */}
            <div className="shrink-0 flex items-center gap-2.5 rounded-full border border-danger/20 bg-danger/5 px-4 py-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-danger opacity-60 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-danger" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-danger">
                Live duels
              </span>
            </div>

            <p className="hidden lg:block shrink-0 text-sm text-ink-3">
              38 matches finished in the last minute
            </p>

            {/* Ticker */}
            <div className="marquee flex-1 min-w-0">
              <div className="marquee-track items-center gap-3 pr-3">
                {[...DUELS, ...DUELS].map((duel, index) => (
                  <span
                    key={index}
                    aria-hidden={index >= DUELS.length}
                    className="flex items-center gap-2.5 rounded-full border border-line bg-bg pl-2.5 pr-4 py-2 shadow-soft whitespace-nowrap transition-colors hover:border-line-strong"
                  >
                    <Avatar initials={duel.winner[0].toUpperCase()} hue="bg-accent/15 text-accent" />
                    <span className="text-sm font-medium text-ink">
                      {duel.winner}
                    </span>
                    <span className="text-xs text-ink-3">beat</span>
                    <Avatar initials={duel.loser[0].toUpperCase()} hue="bg-blue-500/15 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-ink">
                      {duel.loser}
                    </span>
                    <span className="mx-0.5 h-4 w-px bg-line" />
                    <span className="font-mono text-[11px] text-success">
                      {duel.lang} · {duel.time}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
