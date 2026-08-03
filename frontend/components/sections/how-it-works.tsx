"use client";

import { useState } from "react";
import {
  UserCheck,
  Code2,
  Trophy,
  Loader2,
  Swords,
  Check,
  ArrowRight,
} from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { SpotlightCard } from "@/components/ui/spotlight-card";

const STEPS = [
  {
    icon: UserCheck,
    title: "Find a match",
    description:
      "The ELO engine pairs you with an opponent of similar skill in seconds.",
  },
  {
    icon: Code2,
    title: "Solve faster",
    description:
      "Write the optimal solution under live head-to-head pressure.",
  },
  {
    icon: Trophy,
    title: "Climb the ranks",
    description:
      "Earn rating points, unlock badges, and rise on the global leaderboard.",
  },
];

export function HowItWorks({
  onOpenAuth,
}: {
  onOpenAuth: (mode: "login" | "signup") => void;
}) {
  const [matchState, setMatchState] = useState<"idle" | "searching" | "found">(
    "idle"
  );
  const [searchProgress, setSearchProgress] = useState(0);

  const startMatchSim = () => {
    setMatchState("searching");
    setSearchProgress(0);
    const interval = setInterval(() => {
      setSearchProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setMatchState("found");
          return 100;
        }
        return prev + 25;
      });
    }, 400);
  };

  return (
    <section
      id="how-it-works"
      className="py-28 border-t border-line bg-surface/50"
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            How it works
          </p>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-balance">
            From queue to ranked win in three steps
          </h2>
          <p className="mt-5 text-lg text-ink-2 leading-relaxed">
            A deliberately simple flow. No lobbies, no waiting rooms — just
            match, solve, and rank.
          </p>
        </Reveal>

        {/* Steps */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-5">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <Reveal key={step.title} delay={index * 80} className="h-full">
                <SpotlightCard className="group relative h-full rounded-2xl border border-line bg-bg p-7 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lifted">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-ink-3">
                      0{index + 1}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                  <h3 className="mt-8 text-lg font-semibold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-2.5 text-[15px] text-ink-2 leading-relaxed">
                    {step.description}
                  </p>
                </SpotlightCard>
              </Reveal>
            );
          })}
        </div>

        {/* Match simulator */}
        <Reveal delay={120}>
          <div className="mt-6 rounded-3xl border border-line bg-bg px-8 py-10 md:px-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 shadow-soft">
            <div className="max-w-md">
              <h3 className="text-xl font-semibold tracking-tight">
                Try the matchmaking — live
              </h3>
              <p className="mt-2 text-[15px] text-ink-2 leading-relaxed">
                Watch how quickly the ELO engine finds an opponent in your skill
                bracket.
              </p>
            </div>

            <div className="shrink-0">
              {matchState === "idle" && (
                <button
                  onClick={startMatchSim}
                  className="btn-shine group h-11 px-6 rounded-full bg-accent text-accent-ink text-sm font-semibold inline-flex items-center gap-2 shadow-lifted hover:bg-accent-strong transition-colors"
                >
                  <Swords className="w-4 h-4 transition-transform duration-300 group-hover:rotate-12" />
                  Simulate a quick match
                </button>
              )}

              {matchState === "searching" && (
                <div className="flex items-center gap-3 rounded-full border border-line bg-surface px-5 py-3 text-sm text-ink-2 shadow-soft">
                  <Loader2 className="w-4 h-4 animate-spin text-accent" />
                  <span>Searching queue… {searchProgress}%</span>
                </div>
              )}

              {matchState === "found" && (
                <div className="flex items-center gap-4 rounded-2xl border border-success/25 bg-success/5 px-5 py-3.5 shadow-soft">
                  <span className="w-9 h-9 rounded-full bg-success/15 text-success flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </span>
                  <div className="text-sm">
                    <div className="font-medium text-ink">
                      Matched with @dev_ninja
                    </div>
                    <div className="text-xs text-ink-3 font-mono">1540 elo</div>
                  </div>
                  <button
                    onClick={() => onOpenAuth("signup")}
                    className="ml-2 h-9 px-4 rounded-full bg-accent text-accent-ink text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-accent-strong transition-colors"
                  >
                    Join room
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
