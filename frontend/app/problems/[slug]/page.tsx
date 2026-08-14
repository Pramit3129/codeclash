"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getProblemBySlug } from "@/lib/problems/api";
import type { ProblemDetails, Language, SampleTestCase } from "@/lib/problems/types";
import { DifficultyBadge } from "@/components/problems/difficulty-badge";
import { CodeEditor } from "@/components/problems/code-editor";
import { LanguageSelector } from "@/components/problems/language-selector";
import { ProblemDetailSkeleton } from "@/components/problems/skeleton";

interface PageState {
  problem: ProblemDetails | null;
  loading: boolean;
  error: string | null;
  codeByLanguage: Record<Language, string>;
}

/** How far the split can be dragged, as a percentage of the container. */
const MIN_SPLIT = 28;
const MAX_SPLIT = 72;
const DEFAULT_SPLIT = 50;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded text-ink-3 hover:text-ink hover:bg-elevated transition-colors"
      title="Copy"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-success" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
      {children}
    </h3>
  );
}

/** A gutter-labelled payload row, e.g. `Input   2 3`. Sits inside an ExampleBlock card. */
function IoRow({ label, text }: { label: string; text: string }) {
  return (
    <div className="group relative flex items-start gap-3 px-4 py-3">
      <span className="w-12 shrink-0 pt-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-3">
        {label}
      </span>
      <pre className="flex-1 min-w-0 pr-8 font-mono text-[13px] leading-relaxed text-ink whitespace-pre-wrap break-words">
        {text.trim()}
      </pre>
      <span className="absolute top-2 right-2.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <CopyButton text={text} />
      </span>
    </div>
  );
}

function ExampleBlock({ tc, index }: { tc: SampleTestCase; index: number }) {
  return (
    <div>
      <div className="mb-2.5 text-[13px] font-semibold text-ink">
        Example {index + 1}
      </div>
      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-elevated/40">
        <IoRow label="Input" text={tc.input} />
        <IoRow label="Output" text={tc.expectedOutput} />
      </div>
    </div>
  );
}

function SpecItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-3">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-[13px] text-ink">{value}</dd>
    </div>
  );
}

export default function ProblemDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [state, setState] = useState<PageState>({
    problem: null,
    loading: true,
    error: null,
    codeByLanguage: { PYTHON: "", JAVASCRIPT: "", JAVA: "", CPP: "" },
  });
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("PYTHON");
  const [fetchKey, setFetchKey] = useState(0);
  const [activeTab, setActiveTab] = useState<"description" | "solutions" | "submissions">("description");

  // Resizable split between the statement and the editor.
  const splitRef = useRef<HTMLDivElement>(null);
  const [splitPercent, setSplitPercent] = useState(DEFAULT_SPLIT);
  const [dragging, setDragging] = useState(false);

  const clampSplit = (value: number) =>
    Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, value));

  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const handleDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !splitRef.current) return;
    const bounds = splitRef.current.getBoundingClientRect();
    setSplitPercent(
      clampSplit(((event.clientX - bounds.left) / bounds.width) * 100),
    );
  };

  const handleDragEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  };

  const handleSplitKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setSplitPercent((previous) => clampSplit(previous - 2));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setSplitPercent((previous) => clampSplit(previous + 2));
    } else if (event.key === "Home") {
      event.preventDefault();
      setSplitPercent(DEFAULT_SPLIT);
    }
  };

  useEffect(() => {
    let cancelled = false;

    getProblemBySlug(slug)
      .then((response) => {
        if (cancelled) return;
        if (response.success) {
          const details = response.problemDetails;
          setState({
            problem: details,
            loading: false,
            error: null,
            codeByLanguage: {
              PYTHON: details.starterCode.PYTHON,
              JAVASCRIPT: details.starterCode.JAVASCRIPT,
              JAVA: details.starterCode.JAVA,
              CPP: details.starterCode.CPP,
            },
          });
          setSelectedLanguage("PYTHON");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load problem.";
        setState((prev) => ({
          ...prev,
          loading: false,
          error: message,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [slug, fetchKey]);

  const handleRetry = useCallback(() => {
    setState({ problem: null, loading: true, error: null, codeByLanguage: { PYTHON: "", JAVASCRIPT: "", JAVA: "", CPP: "" } });
    setFetchKey((k) => k + 1);
  }, []);

  const handleCodeChange = (value: string) => {
    setState((prev) => ({
      ...prev,
      codeByLanguage: { ...prev.codeByLanguage, [selectedLanguage]: value },
    }));
  };

  const handleLanguageChange = (language: Language) => {
    setSelectedLanguage(language);
  };

  if (state.loading) {
    return <ProblemDetailSkeleton />;
  }

  if (state.error) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-ink mb-2">
            {state.error.includes("404") ? "Problem not found" : "Error loading problem"}
          </h2>
          <p className="text-sm text-ink-2 mb-4">{state.error}</p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/problems"
              className="px-4 py-2 text-sm font-medium text-ink-2 hover:text-ink bg-surface border border-line rounded-lg transition-colors"
            >
              Back to problems
            </Link>
            <button
              onClick={handleRetry}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/8 rounded-lg transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!state.problem) return null;

  const testCases = state.problem.testCases;

  return (
    <div
      ref={splitRef}
      style={{ ["--left-w" as string]: `${splitPercent}%` }}
      className={`flex flex-col lg:flex-row h-[calc(100vh-4rem)] ${
        dragging ? "cursor-col-resize select-none" : ""
      }`}
    >
      {/* Left panel — problem statement */}
      <div className="split-left flex flex-col overflow-hidden bg-bg">
        {/* Nav + tabs */}
        <div className="flex items-center gap-3 px-5 border-b border-line">
          <Link
            href="/problems"
            title="Back to problems"
            className="p-1.5 -ml-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-elevated transition-all hover:-translate-x-0.5"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="w-px h-4 bg-line" />
          <div className="flex items-center">
            {(["description", "solutions", "submissions"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-3 py-3 text-[13px] font-medium capitalize transition-colors ${
                  activeTab === tab ? "text-ink" : "text-ink-3 hover:text-ink-2"
                }`}
              >
                {tab}
                <span
                  className={`absolute -bottom-px left-3 right-3 h-[1.5px] rounded-full bg-accent transition-transform duration-300 ease-out ${
                    activeTab === tab ? "scale-x-100" : "scale-x-0"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "description" && (
            <article className="px-8 py-9 max-w-[44rem]">
              <header>
                <div className="flex items-baseline justify-between gap-5">
                  <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em] text-ink">
                    {state.problem.title}
                  </h1>
                  <DifficultyBadge
                    difficulty={state.problem.difficulty}
                    variant="mark"
                    className="shrink-0 translate-y-px"
                  />
                </div>

                <dl className="mt-6 flex items-start gap-10">
                  <SpecItem
                    label="Time limit"
                    value={`${state.problem.timeLimitMs} ms`}
                  />
                  <SpecItem
                    label="Memory"
                    value={`${state.problem.memoryLimitMb} MB`}
                  />
                </dl>
              </header>

              <hr className="my-7 border-0 border-t border-line" />

              {/* Statement */}
              <div className="problem-markdown problem-statement">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {state.problem.statementMd}
                </ReactMarkdown>
              </div>

              {/* Constraints */}
              {state.problem.constraintsMd?.trim() && (
                <section className="mt-10">
                  <SectionLabel>Constraints</SectionLabel>
                  <div className="problem-markdown problem-constraints">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {state.problem.constraintsMd}
                    </ReactMarkdown>
                  </div>
                </section>
              )}

              {/* Examples */}
              {testCases.length > 0 && (
                <section className="mt-10">
                  <SectionLabel>
                    {testCases.length === 1 ? "Example" : "Examples"}
                  </SectionLabel>
                  <div className="space-y-7">
                    {testCases.map((tc, i) => (
                      <ExampleBlock key={tc.ordinal} tc={tc} index={i} />
                    ))}
                  </div>
                </section>
              )}
            </article>
          )}

          {activeTab === "solutions" && (
            <div className="px-8 py-24 text-center">
              <p className="text-sm text-ink-3">Solutions are coming soon.</p>
            </div>
          )}

          {activeTab === "submissions" && (
            <div className="px-8 py-24 text-center">
              <p className="text-sm text-ink-3">No submissions yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Drag handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panels"
        aria-valuenow={Math.round(splitPercent)}
        aria-valuemin={MIN_SPLIT}
        aria-valuemax={MAX_SPLIT}
        tabIndex={0}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
        onKeyDown={handleSplitKeyDown}
        onDoubleClick={() => setSplitPercent(DEFAULT_SPLIT)}
        className="group hidden lg:flex relative w-1.5 shrink-0 cursor-col-resize items-center justify-center touch-none"
      >
        <span
          className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-px transition-colors ${
            dragging ? "bg-accent/60" : "bg-line group-hover:bg-accent/40"
          }`}
        />
        <span
          className={`relative h-9 w-[3px] rounded-full transition-colors ${
            dragging ? "bg-accent/70" : "bg-transparent group-hover:bg-accent/50"
          }`}
        />
      </div>

      {/* Right panel — code editor */}
      <div className="flex flex-col min-h-0 lg:flex-1 lg:min-w-0">
        {/* Editor toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-surface border-b border-line">
          <LanguageSelector
            selected={selectedLanguage}
            onSelect={handleLanguageChange}
          />
          <div className="flex items-center gap-2">
            <button
              disabled
              className="px-4 py-1.5 text-sm font-medium text-ink-3 bg-elevated rounded-lg cursor-not-allowed"
            >
              Run
            </button>
            <button
              disabled
              className="btn-shine px-4 py-1.5 text-sm font-medium text-accent-ink bg-accent/50 rounded-lg cursor-not-allowed"
            >
              Submit
            </button>
          </div>
        </div>

        {/* Monaco editor */}
        <div
          className={`flex-1 min-h-0 editor-dark ${
            dragging ? "pointer-events-none" : ""
          }`}
        >
          <CodeEditor
            language={selectedLanguage}
            value={state.codeByLanguage[selectedLanguage]}
            onChange={handleCodeChange}
          />
        </div>
      </div>
    </div>
  );
}
