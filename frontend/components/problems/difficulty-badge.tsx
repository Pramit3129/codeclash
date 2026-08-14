import type { Difficulty } from "@/lib/problems/types";
import { DIFFICULTY_LABELS } from "@/lib/problems/types";

const SOLID_STYLES: Record<Difficulty, string> = {
  EASY: "bg-success-soft text-success",
  MEDIUM: "bg-amber-500/12 text-amber-400",
  HARD: "bg-danger/12 text-danger",
};

const TEXT_STYLES: Record<Difficulty, string> = {
  EASY: "text-success",
  MEDIUM: "text-amber-400",
  HARD: "text-danger",
};

interface DifficultyBadgeProps {
  difficulty: Difficulty;
  className?: string;
  /**
   * `solid` — filled pill, used in listings.
   * `mark`  — bare dot + letterspaced label, for a page's own header.
   */
  variant?: "solid" | "mark";
}

export function DifficultyBadge({
  difficulty,
  className = "",
  variant = "solid",
}: DifficultyBadgeProps) {
  if (variant === "mark") {
    return (
      <span
        className={`inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] ${TEXT_STYLES[difficulty]} ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {DIFFICULTY_LABELS[difficulty]}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${SOLID_STYLES[difficulty]} ${className}`}
    >
      {DIFFICULTY_LABELS[difficulty]}
    </span>
  );
}
