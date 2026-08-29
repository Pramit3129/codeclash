"use client";

import type { Language } from "@/lib/problems/types";
import { ALL_LANGUAGES, LANGUAGE_LABELS } from "@/lib/problems/types";
import { ChevronDown, Lock } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface LanguageSelectorProps {
  selected: Language;
  onSelect: (language: Language) => void;
}

export function LanguageSelector({
  selected,
  onSelect,
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative flex items-center gap-2" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#282828] hover:bg-[#333333] border border-[#383838] text-xs font-medium text-gray-200 transition-all shadow-sm active:scale-95"
      >
        <span>{LANGUAGE_LABELS[selected]}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 bg-[#282828]/60 px-2 py-0.5 rounded-md border border-[#383838]/60">
        <Lock className="w-2.5 h-2.5 text-gray-500" />
        Auto
      </span>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 w-36 rounded-xl bg-[#282828] border border-[#383838] shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {ALL_LANGUAGES.map((lang) => (
            <button
              key={lang}
              onClick={() => {
                onSelect(lang);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center justify-between ${
                selected === lang
                  ? "bg-[#383838] text-white font-semibold"
                  : "text-gray-300 hover:bg-[#333333] hover:text-white"
              }`}
            >
              <span>{LANGUAGE_LABELS[lang]}</span>
              {selected === lang && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#2cbb5d]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
