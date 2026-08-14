"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { AlertCircle, ChevronRight, RefreshCw } from "lucide-react";
import { getProblems } from "@/lib/problems/api";
import type { ProblemListItem, Difficulty } from "@/lib/problems/types";
import { DIFFICULTY_LABELS } from "@/lib/problems/types";
import { DifficultyBadge } from "@/components/problems/difficulty-badge";
import { ProblemListSkeleton } from "@/components/problems/skeleton";

const DIFFICULTY_FILTERS: Array<{ label: string; value: Difficulty | null }> = [
  { label: "All", value: null },
  { label: "Easy", value: "EASY" },
  { label: "Medium", value: "MEDIUM" },
  { label: "Hard", value: "HARD" },
];

const LIMIT = 10;

interface FetchState {
  problems: ProblemListItem[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
}

export default function ProblemsPage() {
  const [state, setState] = useState<FetchState>({
    problems: [],
    nextCursor: null,
    loading: true,
    loadingMore: false,
    error: null,
  });
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const appendRef = useRef(false);
  const cursorRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    getProblems({
      limit: LIMIT,
      cursor: cursorRef.current,
      difficulty: difficulty ?? undefined,
    })
      .then((response) => {
        if (cancelled) return;
        if (response.success) {
          setState((prev) => ({
            problems: appendRef.current
              ? [...prev.problems, ...response.problems.items]
              : response.problems.items,
            nextCursor: response.problems.nextCursor,
            loading: false,
            loadingMore: false,
            error: null,
          }));
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Unable to load problems.";
        setState((prev) => ({
          ...prev,
          loading: false,
          loadingMore: false,
          error: message,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [difficulty, fetchKey]);

  const loadMore = () => {
    if (!state.nextCursor) return;
    setState((prev) => ({ ...prev, loadingMore: true }));
    appendRef.current = true;
    cursorRef.current = state.nextCursor;
    setFetchKey((k) => k + 1);
  };

  const handleDifficultyChange = (newDifficulty: Difficulty | null) => {
    setDifficulty(newDifficulty);
    setState({ problems: [], nextCursor: null, loading: true, loadingMore: false, error: null });
    appendRef.current = false;
    cursorRef.current = undefined;
  };

  const handleRetry = () => {
    setState({ problems: [], nextCursor: null, loading: true, loadingMore: false, error: null });
    appendRef.current = false;
    cursorRef.current = undefined;
    setFetchKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen pt-20 pb-12">
      <div className="max-w-5xl mx-auto px-5 sm:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-ink mb-2">Problems</h1>
          <p className="text-ink-2 text-sm">
            Practice coding problems to improve your skills.
          </p>
        </div>

        {/* Difficulty filter */}
        <div className="flex items-center gap-2 mb-6">
          {DIFFICULTY_FILTERS.map((filter) => (
            <button
              key={filter.label}
              onClick={() => handleDifficultyChange(filter.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                difficulty === filter.value
                  ? "bg-accent/12 text-accent"
                  : "text-ink-2 hover:text-ink hover:bg-elevated"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Error state */}
        {state.error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-danger/8 border border-danger/20 mb-6">
            <AlertCircle className="w-5 h-5 text-danger flex-shrink-0" />
            <p className="text-sm text-danger flex-1">{state.error}</p>
            <button
              onClick={handleRetry}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10 rounded-lg transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* Loading state */}
        {state.loading && <ProblemListSkeleton />}

        {/* Empty state */}
        {!state.loading && !state.error && state.problems.length === 0 && (
          <div className="text-center py-16">
            <p className="text-ink-2 text-sm">
              {difficulty
                ? `No problems found for ${DIFFICULTY_LABELS[difficulty]} difficulty.`
                : "No problems found."}
            </p>
            {difficulty && (
              <button
                onClick={() => handleDifficultyChange(null)}
                className="mt-3 text-sm text-accent hover:text-accent-strong transition-colors"
              >
                Clear filter
              </button>
            )}
          </div>
        )}

        {/* Problem list */}
        {!state.loading && !state.error && state.problems.length > 0 && (
          <div className="space-y-2">
            {state.problems.map((problem, index) => (
              <Link
                key={problem.id}
                href={`/problems/${problem.slug}`}
                className="flex items-center justify-between p-4 rounded-xl bg-surface border border-line hover:border-line-strong hover:shadow-soft transition-all group"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <span className="text-xs text-ink-3 font-mono w-8 text-right flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium text-ink truncate group-hover:text-accent transition-colors">
                    {problem.title}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  <DifficultyBadge difficulty={problem.difficulty} />
                  <ChevronRight className="w-4 h-4 text-ink-3 group-hover:text-ink transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Load more */}
        {!state.loading && state.nextCursor && (
          <div className="flex justify-center mt-6">
            <button
              onClick={loadMore}
              disabled={state.loadingMore}
              className="px-5 py-2.5 text-sm font-medium text-ink-2 hover:text-ink bg-surface border border-line hover:border-line-strong rounded-lg transition-colors disabled:opacity-50"
            >
              {state.loadingMore ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
