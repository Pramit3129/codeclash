import type { Difficulty } from "@/lib/problems/types";
import { DIFFICULTY_LABELS } from "@/lib/problems/types";

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  EASY: "bg-success-soft text-success",
  MEDIUM: "bg-amber-500/12 text-amber-400",
  HARD: "bg-danger/12 text-danger",
};

interface DifficultyBadgeProps {
  difficulty: Difficulty;
  className?: string;
}

export function DifficultyBadge({ difficulty, className = "" }: DifficultyBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${DIFFICULTY_STYLES[difficulty]} ${className}`}
    >
      {DIFFICULTY_LABELS[difficulty]}
    </span>
  );
}
