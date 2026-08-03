"use client";

import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { TransparentBadge } from "@/components/ui/transparent-badge";
import { LEAGUES } from "@/lib/leagues";

const PEDESTAL_ORDER = [...LEAGUES].reverse();

/* ------------------------------------------------------------------ *
 *  Section
 * ------------------------------------------------------------------ */

export function BadgeShowcase({
  onOpenAuth,
}: {
  onOpenAuth: (mode: "login" | "signup") => void;
}) {
  return (
    <section className="relative py-28 border-t border-line bg-surface/50">
      {/* Fine gold pinstripe at the top */}
      <div
        aria-hidden
        className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent"
      />
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        {/* Header */}
        <Reveal className="max-w-2xl">
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Season badges
            </p>
          </div>
          <h2 className="mt-5 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-[1.1] text-balance">
            <span className="text-ink">Compete.</span>{" "}
            <span className="text-accent">Climb.</span>
            <span className="block mt-3 text-ink-2 font-medium">
              Become the{" "}
              <span className="font-display italic font-normal text-energized">
                highest rated.
              </span>
            </span>
          </h2>
          <p className="mt-6 text-lg text-ink-2 leading-relaxed max-w-lg">
            Every duel you win earns rating and moves you up the leagues. Reach
            Legend and stand above everyone else on the platform.
          </p>
        </Reveal>

        {/* Pedestal showcase */}
        <Reveal delay={120}>
          <div className="mt-20">
            {/* Badges resting on their plinths */}
            <div className="grid grid-cols-5 gap-1.5 sm:gap-8 items-end">
              {PEDESTAL_ORDER.map((league, index) => {
                const Icon = league.Icon;
                const isLegend = league.name === "Legend";
                return (
                  <div
                    key={league.name}
                    className="group relative flex flex-col items-center"
                  >
                    {/* Colored halo behind the badge */}
                    <div
                      className="absolute left-1/2 -translate-x-1/2 top-0 w-16 h-16 sm:w-24 sm:h-24 rounded-full blur-2xl opacity-[0.14] group-hover:opacity-35 transition-opacity duration-500 pointer-events-none"
                      style={{ backgroundColor: league.accentHex }}
                    />

                    {/* Badge */}
                    <div className="relative transition-transform duration-300 ease-out group-hover:-translate-y-1.5">
                      <TransparentBadge
                        src={league.img}
                        alt={`${league.name} league badge`}
                        glow={league.glow}
                        className={
                          isLegend
                            ? "w-[72px] sm:w-[118px]"
                            : "w-[62px] sm:w-[102px]"
                        }
                      />
                    </div>

                    {/* Plinth */}
                    <div
                      className={`plinth-grow relative w-full overflow-hidden rounded-t-xl border-x border-t ${league.pedestalBorder} bg-[#16161a] dark:bg-[#1a1a20] shadow-soft`}
                      style={{
                        height: league.pedestalHeight,
                        animationDelay: `${index * 90}ms`,
                      }}
                    >
                      {/* Colored top rim */}
                      <div
                        className="absolute top-0 inset-x-0 h-[3px]"
                        style={{ backgroundColor: league.accentHex }}
                      />
                      {/* League-colored inner wash */}
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: `radial-gradient(120% 70% at 50% -20%, ${league.accentHex}26, transparent 55%)`,
                        }}
                      />
                      {/* Depth at the base */}
                      <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                    </div>

                    {/* Ground glow */}
                    <div
                      className="w-full h-px mt-3 rounded-full opacity-70 group-hover:opacity-100 transition-opacity duration-300"
                      style={{
                        background: `linear-gradient(to right, transparent, ${league.accentHex}80, transparent)`,
                      }}
                    />

                    {/* Label */}
                    <div className="mt-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Icon className={`w-3.5 h-3.5 ${league.textAccent}`} />
                        <span
                          className={`text-sm sm:text-[15px] font-semibold tracking-tight ${league.textAccent}`}
                        >
                          {league.name}
                        </span>
                      </div>
                      <div className="mt-1.5 font-mono text-[11px] sm:text-xs text-ink-3 tabular-nums">
                        {league.range}
                      </div>
                      <div className="mt-1 text-[11px] text-ink-3/80">
                        {league.share} of players
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>

        {/* Footer + CTA */}
        <Reveal delay={200}>
          <div className="mt-20 flex flex-col items-center text-center">
            <p className="max-w-md text-sm text-ink-3">
              Badges are earned every season and pinned to your profile forever.
              The higher the pedestal, the harder it was to reach.
            </p>
            <button
              onClick={() => onOpenAuth("signup")}
              className="btn-shine group mt-7 h-12 px-7 rounded-full bg-accent text-accent-ink text-sm font-semibold inline-flex items-center gap-2 shadow-lifted hover:bg-accent-strong transition-colors"
            >
              <span>Start climbing</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
