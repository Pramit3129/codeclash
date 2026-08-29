"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, X, Clock, ListChecks, Cpu } from "lucide-react";
import type { Language } from "@/lib/problems/types";
import { LANGUAGE_LABELS } from "@/lib/problems/types";

const CONFETTI_COUNT = 140;
const CONFETTI_MS = 2600;

// Greens and golds, matching the verdict palette used across the problem page.
const CONFETTI_COLORS = [
  "#2cbb5d",
  "#4ade80",
  "#f0a132",
  "#fbbf24",
  "#ffffff",
  "#8b5cf6",
];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  spin: number;
  angle: number;
}

/**
 * Canvas confetti burst. Self-contained rather than a dependency: it's a few
 * dozen lines of physics and avoids pulling a library in for one screen.
 * Honours `prefers-reduced-motion` by not running at all.
 */
function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Two side cannons, angled inward — reads better than a top-down drizzle.
    const pieces: Piece[] = Array.from({ length: CONFETTI_COUNT }, (_, i) => {
      const fromLeft = i % 2 === 0;
      const spread = (Math.random() - 0.5) * 1.1;
      const power = 9 + Math.random() * 7;
      return {
        x: fromLeft ? 0 : width,
        y: height * (0.55 + Math.random() * 0.25),
        vx: (fromLeft ? 1 : -1) * power * (0.7 + Math.random() * 0.5),
        vy: -power * (0.75 + Math.random() * 0.6) + spread,
        size: 4 + Math.random() * 6,
        color:
          CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]!,
        spin: (Math.random() - 0.5) * 0.35,
        angle: Math.random() * Math.PI * 2,
      };
    });

    let raf = 0;
    const start = performance.now();

    const frame = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, width, height);

      for (const p of pieces) {
        p.vy += 0.28; // gravity
        p.vx *= 0.995; // drag
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.spin;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.globalAlpha = Math.max(0, 1 - elapsed / CONFETTI_MS);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.62);
        ctx.restore();
      }

      if (elapsed < CONFETTI_MS) raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}

interface CelebrationProps {
  onClose: () => void;
  problemTitle: string;
  passedTestCases: number;
  totalTestCases: number;
  runtimeMs: number | null;
  language: Language;
}

/**
 * Mounts only while open, so `entered` starts false on every showing and the
 * entrance transition replays for each accepted submission.
 */
export function AcceptedCelebration({
  open,
  ...props
}: CelebrationProps & { open: boolean }) {
  if (!open) return null;
  return <CelebrationDialog {...props} />;
}

function CelebrationDialog({
  onClose,
  problemTitle,
  passedTestCases,
  totalTestCases,
  runtimeMs,
  language,
}: CelebrationProps) {
  const [entered, setEntered] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Next frame, so the transition has a start state to animate from.
    const id = requestAnimationFrame(() => setEntered(true));
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const stats: { icon: typeof Clock; label: string; value: string }[] = [
    {
      icon: ListChecks,
      label: "Test cases",
      value: `${passedTestCases}/${totalTestCases}`,
    },
    {
      icon: Clock,
      label: "Runtime",
      value:
        runtimeMs == null
          ? "—"
          : runtimeMs < 10
            ? `${runtimeMs.toFixed(1)} ms`
            : `${Math.round(runtimeMs)} ms`,
    },
    {
      icon: Cpu,
      label: "Language",
      value: LANGUAGE_LABELS[language] ?? language,
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="accepted-title"
      onClick={onClose}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${
        entered ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <Confetti />

      <div
        onClick={(event) => event.stopPropagation()}
        className={`relative w-full max-w-sm rounded-2xl border border-[#2cbb5d]/30 bg-[#1e1e1e] p-7 text-center shadow-2xl shadow-[#2cbb5d]/10 transition-all duration-300 ${
          entered ? "translate-y-0 scale-100" : "translate-y-3 scale-95"
        }`}
      >
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-[#2a2a2a] hover:text-gray-200"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#2cbb5d]/15 ring-4 ring-[#2cbb5d]/10">
          <Check className="h-8 w-8 text-[#2cbb5d]" strokeWidth={3} />
        </div>

        <h2
          id="accepted-title"
          className="text-2xl font-bold tracking-tight text-[#2cbb5d]"
        >
          Accepted
        </h2>
        <p className="mt-1.5 text-sm text-gray-400">
          All test cases passed for{" "}
          <span className="font-medium text-gray-200">{problemTitle}</span>.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-2">
          {stats.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="rounded-xl border border-[#333333] bg-[#262626] px-2 py-3"
            >
              <Icon className="mx-auto mb-1.5 h-3.5 w-3.5 text-gray-500" />
              <div className="font-mono text-sm font-semibold text-gray-100">
                {value}
              </div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wide text-gray-500">
                {label}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-[#383838] bg-[#282828] px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-[#333333] hover:text-white"
          >
            Keep editing
          </button>
          <Link
            href="/problems"
            className="flex-1 rounded-lg bg-[#2cbb5d] px-4 py-2.5 text-sm font-semibold text-[#0d2b18] transition-colors hover:bg-[#34d06a]"
          >
            Next problem
          </Link>
        </div>
      </div>
    </div>
  );
}
