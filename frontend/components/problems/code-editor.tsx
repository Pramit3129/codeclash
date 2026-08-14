"use client";

import dynamic from "next/dynamic";
import type { Language } from "@/lib/problems/types";
import { MONACO_LANGUAGE_MAP } from "@/lib/problems/types";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#0b0c0f] text-ink-3 text-sm">
      Loading editor...
    </div>
  ),
});

interface CodeEditorProps {
  language: Language;
  value: string;
  onChange: (value: string) => void;
  height?: string;
}

export function CodeEditor({
  language,
  value,
  onChange,
  height = "100%",
}: CodeEditorProps) {
  return (
    <MonacoEditor
      height={height}
      language={MONACO_LANGUAGE_MAP[language]}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        wordWrap: "off",
        automaticLayout: true,
        fontSize: 14,
        tabSize: 4,
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        folding: true,
        bracketPairColorization: { enabled: true },
        smoothScrolling: true,
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        renderLineHighlight: "all",
        padding: { top: 12, bottom: 12 },
      }}
    />
  );
}
