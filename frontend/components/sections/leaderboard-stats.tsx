"use client";

import { useState, type CSSProperties } from "react";
import { ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { TransparentBadge } from "@/components/ui/transparent-badge";
import { LEAGUES, getLeague } from "@/lib/leagues";

const LEADERBOARD = [
  {
    rank: 1,
    handle: "neha_42",
    rating: 2104,
    delta: +12,
    country: "IN",
    winRate: "72.4%",
    initials: "N",
    avatar: "bg-accent/15 text-accent",
  },
  {
    rank: 2,
    handle: "code_master",
    rating: 2051,
    delta: -3,
    country: "US",
    winRate: "69.7%",
    initials: "C",
    avatar: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  },
  {
    rank: 3,
    handle: "algoNinja",
    rating: 1987,
    delta: +8,
    country: "JP",
    winRate: "66.1%",
    initials: "A",
    avatar: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
  {
    rank: 4,
    handle: "devKartic",
    rating: 1924,
    delta: +2,
    country: "IN",
    winRate: "63.8%",
    initials: "D",
    avatar: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  {
    rank: 5,
    handle: "syntax_king",
    rating: 1900,
    delta: -6,
    country: "DE",
    winRate: "61.5%",
    initials: "S",
    avatar: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  },
];

const TIMEFRAMES = ["all time", "monthly", "weekly"] as const;

const HEAD_CLASS =
  "px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-3";

export function LeaderboardStats({
  onOpenAuth,
}: {
  onOpenAuth: (mode: "login" | "signup") => void;
}) {
  const [timeframe, setTimeframe] = useState<number>(0);

  return (
    <section id="leaderboard" className="py-28">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        {/* Section header */}
        <Reveal>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                Rankings
              </p>
              <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-balance">
                Live leaderboard
              </h2>
              <p className="mt-5 text-lg text-ink-2 leading-relaxed">
                Top-rated competitors, updated in real time.
              </p>
            </div>

            <div className="flex items-center rounded-full border border-line bg-surface p-1 text-sm shadow-soft">
              {TIMEFRAMES.map((t, index) => (
                <button
                  key={t}
                  onClick={() => setTimeframe(index)}
                  className={`px-4 py-1.5 rounded-full transition-colors ${
                    timeframe === index
                      ? "bg-bg text-ink font-medium shadow-soft"
                      : "text-ink-3 hover:text-ink-2"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Content */}
        <div className="mt-16 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Leaderboard */}
          <Reveal className="lg:col-span-7">
            <div className="h-full rounded-2xl border border-line bg-surface shadow-soft overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-elevated/50">
                    <th className={`${HEAD_CLASS} w-14`}>Rank</th>
                    <th className={HEAD_CLASS}>Player</th>
                    <th className={HEAD_CLASS}>Rating</th>
                    <th className={`${HEAD_CLASS} hidden md:table-cell`}>
                      Trend
                    </th>
                    <th className={`${HEAD_CLASS} hidden md:table-cell`}>
                      Country
                    </th>
                    <th className={`${HEAD_CLASS} text-right`}>Win rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {LEADERBOARD.map((row) => {
                    const league = getLeague(row.rating);
                    const isPodium = row.rank <= 3;
                    return (
                      <tr
                        key={row.handle}
                        className={`transition-colors ${
                          row.rank === 1
                            ? "bg-accent/5 hover:bg-accent/10"
                            : "hover:bg-elevated/40"
                        }`}
                      >
                        <td className="px-5 py-4">
                          <span
                            className={`font-mono text-[13px] tabular-nums ${
                              isPodium
                                ? "text-accent font-semibold"
                                : "text-ink-3"
                            }`}
                          >
                            {String(row.rank).padStart(2, "0")}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="flex items-center gap-3">
                            <span
                              className={`w-8 h-8 rounded-full ${row.avatar} flex items-center justify-center text-[11px] font-semibold shrink-0`}
                            >
                              {row.initials}
                            </span>
                            <span className="min-w-0">
                              <span className="block font-medium text-ink leading-tight">
                                @{row.handle}
                              </span>
                              <span
                                className={`mt-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-px text-[10px] font-semibold uppercase tracking-wider ${league.badge}`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${league.color}`}
                                />
                                {league.name}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-mono text-[15px] font-semibold text-accent tabular-nums">
                            {row.rating}
                          </span>
                        </td>
                        <td className="px-5 py-4 hidden md:table-cell">
                          <span
                            className={`inline-flex items-center gap-1 font-mono text-[12px] font-medium tabular-nums ${
                              row.delta >= 0 ? "text-success" : "text-danger"
                            }`}
                          >
                            {row.delta >= 0 ? (
                              <TrendingUp className="w-3.5 h-3.5" />
                            ) : (
                              <TrendingDown className="w-3.5 h-3.5" />
                            )}
                            {row.delta >= 0 ? "+" : ""}
                            {row.delta}
                          </span>
                        </td>
                        <td className="px-5 py-4 hidden md:table-cell">
                          <span className="font-mono text-[13px] text-ink-3">
                            {row.country}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="font-mono text-[13px] text-ink-2 tabular-nums">
                            {row.winRate}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="border-t border-line px-5 py-4 flex justify-center">
                <button
                  onClick={() => onOpenAuth("login")}
                  className="group inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink transition-colors"
                >
                  View full leaderboard
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
          </Reveal>

          <Reveal
            delay={120}
            className="lg:col-span-5 flex flex-col gap-5"
          >
            {/* Season leagues */}
            <SpotlightCard className="flex-1 rounded-2xl border border-line bg-surface p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lifted">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold tracking-tight">
                  Season leagues
                </h3>
                <span className="rounded-full bg-accent/10 text-accent text-[11px] font-medium px-3 py-1">
                  Season 7
                </span>
              </div>
              <p className="mt-1.5 text-sm text-ink-3">
                Every duel shifts your rating. Climb into the top league before
                the season resets.
              </p>
              <ul className="mt-5 space-y-1">
                {LEAGUES.map((league, index) => (
                  <li
                    key={league.name}
                    className="group flex items-center gap-3.5 rounded-xl px-3 py-3 transition-colors hover:bg-elevated/40"
                  >
                    <TransparentBadge
                      src={league.img}
                      alt={`${league.name} league badge`}
                      glow={league.glow}
                      className="w-10 h-10 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-ink">
                          {league.name}
                        </span>
                        <span className="font-mono text-[11px] text-ink-3 tabular-nums">
                          {league.range}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-elevated overflow-hidden">
                        <div
                          className={`league-bar h-full rounded-full ${league.color} opacity-80 transition-opacity duration-300 group-hover:opacity-100`}
                          style={
                            {
                              "--bar-width": league.share,
                              animationDelay: `${index * 90}ms`,
                            } as CSSProperties
                          }
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </SpotlightCard>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
