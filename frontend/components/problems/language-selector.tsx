"use client";

import type { Language } from "@/lib/problems/types";
import { ALL_LANGUAGES, LANGUAGE_LABELS } from "@/lib/problems/types";

interface LanguageSelectorProps {
  selected: Language;
  onSelect: (language: Language) => void;
}

export function LanguageSelector({ selected, onSelect }: LanguageSelectorProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-elevated rounded-lg">
      {ALL_LANGUAGES.map((lang) => (
        <button
          key={lang}
          onClick={() => onSelect(lang)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            selected === lang
              ? "bg-surface text-ink shadow-soft"
              : "text-ink-2 hover:text-ink hover:bg-surface/50"
          }`}
        >
          {LANGUAGE_LABELS[lang]}
        </button>
      ))}
    </div>
  );
}
