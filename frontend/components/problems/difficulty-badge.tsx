import type { Difficulty } from "@/lib/problems/types";
import { DIFFICULTY_LABELS } from "@/lib/problems/types";

const SOLID_STYLES: Record<Difficulty, string> = {
  EASY: "bg-[#00b8a3]/15 text-[#00b8a3] border border-[#00b8a3]/30",
  MEDIUM: "bg-[#ffa116]/15 text-[#ffa116] border border-[#ffa116]/30",
  HARD: "bg-[#ef4743]/15 text-[#ef4743] border border-[#ef4743]/30",
};

const TEXT_STYLES: Record<Difficulty, string> = {
  EASY: "text-[#00b8a3]",
  MEDIUM: "text-[#ffa116]",
  HARD: "text-[#ef4743]",
};

interface DifficultyBadgeProps {
  difficulty: Difficulty;
  className?: string;
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
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${SOLID_STYLES[difficulty]} ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {DIFFICULTY_LABELS[difficulty]}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${SOLID_STYLES[difficulty]} ${className}`}
    >
      {DIFFICULTY_LABELS[difficulty]}
    </span>
  );
}
