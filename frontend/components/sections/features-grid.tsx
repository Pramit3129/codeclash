"use client";

import { Swords, Users, BookOpen, Zap, Trophy, BarChart3 } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { SpotlightCard } from "@/components/ui/spotlight-card";

const FEATURES = [
  {
    icon: Swords,
    title: "Real-time duels",
    description:
      "Pair with developers worldwide and solve head-to-head in synchronized dual IDEs with zero network lag.",
  },
  {
    icon: Users,
    title: "Fair matchmaking",
    description:
      "An ELO system balances every match so each duel is genuinely close and every win feels earned.",
  },
  {
    icon: BookOpen,
    title: "Curated problem set",
    description:
      "Hundreds of hand-selected DSA questions across arrays, trees, dynamic programming, and graphs.",
  },
  {
    icon: Zap,
    title: "Instant execution",
    description:
      "A sub-second sandbox validates your solution against testcases the moment you submit.",
  },
  {
    icon: Trophy,
    title: "Ranked contests",
    description:
      "Weekly global tournaments with rating shifts, badges, and a hall of fame for the fastest solvers.",
  },
  {
    icon: BarChart3,
    title: "Deep analytics",
    description:
      "Track topic mastery, solve speed, win rates, and rating trends over time with clear visual reports.",
  },
];

export function FeaturesGrid() {
  return (
    <section id="features" className="py-28">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Features
          </p>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-balance">
            Built for competitive programmers
          </h2>
          <p className="mt-5 text-lg text-ink-2 leading-relaxed">
            Everything you need to sharpen your algorithmic speed and dominate
            technical interviews — in one focused platform.
          </p>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Reveal key={feature.title} delay={index * 60} className="h-full">
                <SpotlightCard className="group h-full rounded-2xl border border-line bg-surface p-7 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-line-strong hover:shadow-lifted">
                  <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="mt-6 text-lg font-semibold tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="mt-2.5 text-[15px] text-ink-2 leading-relaxed">
                    {feature.description}
                  </p>
                </SpotlightCard>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
