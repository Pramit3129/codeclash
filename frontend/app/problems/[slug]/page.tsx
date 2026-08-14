"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  Clock,
  HardDrive,
  CheckCircle2,
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

function TestCaseBlock({ tc, index }: { tc: SampleTestCase; index: number }) {
  return (
    <div className="rounded-lg border border-line overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-elevated/50 border-b border-line">
        <span className="text-xs font-semibold text-ink">
          Example {index + 1}
        </span>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
              Input
            </span>
            <CopyButton text={tc.input} />
          </div>
          <pre className="text-[13px] text-ink font-mono whitespace-pre-wrap bg-bg rounded-md px-3 py-2 border border-line/50">
            {tc.input.trim()}
          </pre>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
              Output
            </span>
            <CopyButton text={tc.expectedOutput} />
          </div>
          <pre className="text-[13px] text-ink font-mono whitespace-pre-wrap bg-bg rounded-md px-3 py-2 border border-line/50">
            {tc.expectedOutput.trim()}
          </pre>
        </div>
      </div>
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
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)]">
      {/* Left panel - Problem statement */}
      <div className="lg:w-1/2 flex flex-col border-r border-line overflow-hidden bg-bg">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-line bg-surface/50">
          <Link
            href="/problems"
            className="p-1.5 rounded-lg text-ink-2 hover:text-ink hover:bg-elevated transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-base font-semibold text-ink truncate flex-1">
            {state.problem.title}
          </h1>
          <DifficultyBadge difficulty={state.problem.difficulty} />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 px-5 border-b border-line bg-surface/30">
          {(["description", "solutions", "submissions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium capitalize transition-colors relative ${
                activeTab === tab
                  ? "text-ink"
                  : "text-ink-3 hover:text-ink-2"
              }`}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "description" && (
            <div className="px-6 py-6 max-w-none">
              {/* Problem title as heading */}
              <h2 className="text-lg font-semibold text-ink mb-4">
                {state.problem.title}
              </h2>

              {/* Meta info bar */}
              <div className="flex items-center gap-4 mb-6 text-xs">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-elevated text-ink-2">
                  <Clock className="w-3 h-3" />
                  {state.problem.timeLimitMs} ms
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-elevated text-ink-2">
                  <HardDrive className="w-3 h-3" />
                  {state.problem.memoryLimitMb} MB
                </span>
              </div>

              {/* Statement */}
              <div className="problem-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {state.problem.statementMd}
                </ReactMarkdown>
              </div>

              {/* Examples */}
              {testCases.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-accent/12 text-accent text-[10px] font-bold flex items-center justify-center">
                      {testCases.length}
                    </span>
                    {testCases.length === 1 ? "Example" : "Examples"}
                  </h3>
                  <div className="space-y-4">
                    {testCases.map((tc, i) => (
                      <TestCaseBlock key={tc.ordinal} tc={tc} index={i} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "solutions" && (
            <div className="flex flex-col items-center justify-center py-20 text-ink-3">
              <CheckCircle2 className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">Solutions coming soon</p>
            </div>
          )}

          {activeTab === "submissions" && (
            <div className="flex flex-col items-center justify-center py-20 text-ink-3">
              <CheckCircle2 className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">No submissions yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Right panel - Code editor */}
      <div className="lg:w-1/2 flex flex-col min-h-0">
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
        <div className="flex-1 min-h-0 editor-dark">
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
