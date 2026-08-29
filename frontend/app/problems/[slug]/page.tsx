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
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  FileText,
  BookOpen,
  History,
  Play,
  CloudUpload,
  RotateCcw,
  Tag,
  Lock,
  Lightbulb,
  Code2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getProblemBySlug } from "@/lib/problems/api";
import { runCode } from "@/lib/problems/run";
import { AcceptedCelebration } from "@/components/problems/accepted-celebration";
import {
  createSubmission,
  connectJudgeStream,
  pollSubmission,
} from "@/lib/problems/submissions";
import type {
  ProblemDetails,
  Language,
  SampleTestCase,
  Submission,
  TestResult,
  TestCaseItem,
  RunOutcome,
  RunTestCaseInput,
} from "@/lib/problems/types";
import { LANGUAGE_LABELS } from "@/lib/problems/types";
import { DifficultyBadge } from "@/components/problems/difficulty-badge";
import { CodeEditor } from "@/components/problems/code-editor";
import { LanguageSelector } from "@/components/problems/language-selector";
import { ProblemDetailSkeleton } from "@/components/problems/skeleton";
import { TestConsole } from "@/components/problems/test-console";

interface PageState {
  problem: ProblemDetails | null;
  loading: boolean;
  error: string | null;
  codeByLanguage: Record<Language, string>;
}

interface SubmissionEntry {
  submission: Submission;
  expanded: boolean;
}

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
      className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#333333] transition-colors"
      title="Copy"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-[#2cbb5d]" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

function ExampleBlock({ tc, index }: { tc: SampleTestCase; index: number }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-gray-200">
        Example {index + 1}:
      </div>
      <div className="rounded-xl border border-[#333333] bg-[#262626] p-3.5 font-mono text-xs text-gray-200 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <span className="font-semibold text-gray-400">Input: </span>
            <span>{tc.input.trim()}</span>
          </div>
          <CopyButton text={tc.input} />
        </div>
        <div className="flex items-start justify-between">
          <div>
            <span className="font-semibold text-gray-400">Output: </span>
            <span>{tc.expectedOutput.trim()}</span>
          </div>
          <CopyButton text={tc.expectedOutput} />
        </div>
      </div>
    </div>
  );
}

function verdictLabel(verdict: string | null): string {
  switch (verdict) {
    case "AC": return "Accepted";
    case "WA": return "Wrong Answer";
    case "TLE": return "Time Limit Exceeded";
    case "RE": return "Runtime Error";
    case "CE": return "Compilation Error";
    case "MLE": return "Memory Limit Exceeded";
    case "SE": return "System Error";
    default: return "Pending";
  }
}

function formatMs(ms: number): string {
  return ms < 10 ? `${ms.toFixed(1)}ms` : `${Math.round(ms)}ms`;
}

/**
 * Minimum spacing between revealed test results, in ms.
 *
 * The judge publishes one PROGRESS event per test over Redis pub/sub, which
 * is fire-and-forget: anything emitted before this client's SSE subscriber
 * attaches is dropped, and a fast problem can finish all its cases before
 * the stream is even open. Whatever survives then lands in a single burst.
 * Pacing the reveal keeps the bar readable in both cases — live events
 * simply arrive slower than this and pass straight through.
 */
const REVEAL_INTERVAL_MS = 140;

function JudgeProgressBar({
  revealed,
  total,
  passed,
  failed,
  done,
}: {
  revealed: number;
  total: number;
  passed: number;
  failed: boolean;
  done: boolean;
}) {
  const percent = total > 0 ? Math.min(100, (revealed / total) * 100) : 0;

  return (
    <div className="px-4 pb-3 -mt-1">
      <div className="flex items-center justify-between mb-1.5 text-[11px] font-mono">
        <span className={failed ? "text-[#ef4743]" : "text-gray-400"}>
          {done
            ? `${passed}/${total} test cases passed`
            : total > 0
              ? `Running test ${Math.min(revealed + 1, total)} of ${total}`
              : "Queued for judging"}
        </span>
        <span className="text-gray-500">
          {total > 0 ? `${Math.round(percent)}%` : ""}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[#333333] overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ease-out ${
            failed ? "bg-[#ef4743]" : "bg-[#2cbb5d]"
          } ${total === 0 ? "animate-pulse" : ""}`}
          style={{ width: total > 0 ? `${percent}%` : "100%" }}
        />
      </div>
    </div>
  );
}

function LeetCodeSubmissionRow({
  submission,
  index,
  total,
  expanded,
  onToggle,
  revealedCount,
}: {
  submission: Submission;
  index: number;
  total: number;
  expanded: boolean;
  onToggle: () => void;
  /** Caps how many results are shown; omitted for settled rows (show all). */
  revealedCount?: number;
}) {
  const dateStr = new Date(submission.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const rowNum = total - index;
  const isAccepted = submission.verdict === "AC";
  const allResults = submission.testResults ?? [];
  const results =
    revealedCount == null ? allResults : allResults.slice(0, revealedCount);
  // Still catching up on a burst of results, even if the verdict has landed.
  const revealing = results.length < allResults.length;
  const revealedPassed = results.filter((tr) => tr.verdict === "AC").length;
  const anyFailed = results.some((tr) => tr.verdict !== "AC");
  const isJudging =
    submission.status === "QUEUED" ||
    submission.status === "RUNNING" ||
    revealing;

  // Total test count is unknown until the first PROGRESS event lands.
  const progressLabel =
    submission.totalTestCases > 0
      ? `Judging... ${revealedPassed}/${submission.totalTestCases}`
      : "Judging...";

  // The judge reports per-test timings; the slowest one is what matters
  // against the problem's time limit.
  const slowestMs = results.reduce<number | null>(
    (max, tr) =>
      tr.executionTimeMs == null
        ? max
        : max == null
          ? tr.executionTimeMs
          : Math.max(max, tr.executionTimeMs),
    null,
  );

  return (
    <div className="border-b border-[#282828] bg-[#1a1a1a] hover:bg-[#242424] transition-colors">
      <button
        onClick={onToggle}
        className="w-full grid grid-cols-12 items-center px-4 py-3 text-left text-xs font-mono"
      >
        <span className="col-span-1 text-gray-500 font-medium">{rowNum}</span>
        <div className="col-span-4 flex flex-col">
          <span
            className={`font-semibold text-sm ${
              isJudging
                ? anyFailed
                  ? "text-[#ef4743]"
                  : "text-gray-300"
                : isAccepted
                  ? "text-[#2cbb5d]"
                  : "text-[#ef4743]"
            }`}
          >
            {isJudging ? progressLabel : verdictLabel(submission.verdict)}
          </span>
          <span className="text-[11px] text-gray-400 font-sans mt-0.5">
            {!isJudging && submission.totalTestCases > 0
              ? `${submission.passedTestCases}/${submission.totalTestCases} test cases passed \u00b7 ${dateStr}`
              : dateStr}
          </span>
        </div>
        <div className="col-span-3">
          <span className="px-2.5 py-1 rounded-full bg-[#282828] border border-[#383838] text-[11px] font-sans text-gray-300">
            {submission.language
              ? LANGUAGE_LABELS[submission.language] ?? submission.language
              : "Python"}
          </span>
        </div>
        <div className="col-span-2 flex items-center gap-1 text-gray-300">
          <Clock className="w-3 h-3 text-gray-400" />
          <span>{slowestMs != null ? formatMs(slowestMs) : "—"}</span>
        </div>
        <div className="col-span-2 flex items-center justify-end gap-2 text-gray-400">
          {results.length > 0 && (
            expanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )
          )}
        </div>
      </button>

      {(isJudging || revealing) && (
        <JudgeProgressBar
          revealed={results.length}
          total={submission.totalTestCases}
          passed={revealedPassed}
          failed={anyFailed}
          done={false}
        />
      )}

      {expanded && results.length > 0 && (
        <div className="bg-[#212121] px-6 py-4 border-t border-[#282828] space-y-2 font-mono text-xs">
          {results.map((tr, i) => (
            <div
              key={tr.testCaseId ?? i}
              className={`p-3 rounded-lg border flex items-center justify-between ${
                tr.verdict === "AC"
                  ? "bg-[#262626] border-[#333333] text-gray-200"
                  : "bg-[#ef4743]/10 border-[#ef4743]/20 text-[#ef4743]"
              }`}
            >
              <div className="flex items-center gap-2">
                {tr.verdict === "AC" ? (
                  <Check className="w-4 h-4 text-[#2cbb5d]" />
                ) : (
                  <XCircle className="w-4 h-4 text-[#ef4743]" />
                )}
                <span>Test {i + 1}:</span>
                <span className="font-semibold">{verdictLabel(tr.verdict)}</span>
              </div>
              {tr.executionTimeMs != null && (
                <span className="text-gray-400 text-[11px]">
                  {formatMs(tr.executionTimeMs)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
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

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSubmission, setActiveSubmission] = useState<Submission | null>(null);
  const [activeSubmissionExpanded, setActiveSubmissionExpanded] = useState(true);
  const [pastSubmissions, setPastSubmissions] = useState<SubmissionEntry[]>([]);
  const cleanupSseRef = useRef<(() => void) | null>(null);
  // Read by handleSubmit to archive the previous run without taking
  // activeSubmission as a dependency (which would rebuild the callback on
  // every streamed PROGRESS event).
  const activeSubmissionRef = useRef<Submission | null>(null);
  // How many of the active submission's results are on screen. Trails the
  // known results and walks toward them, so a batch arriving in one VERDICT
  // still animates instead of snapping in fully formed.
  const [revealedCount, setRevealedCount] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  // Submission ids already celebrated, so re-renders and tab switches don't
  // re-trigger the popup for a result the user has already seen.
  const celebratedRef = useRef<Set<string>>(new Set());

  // Run and Testcase state
  const [testCaseItems, setTestCaseItems] = useState<TestCaseItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runOutcome, setRunOutcome] = useState<RunOutcome | null>(null);
  const [consoleTab, setConsoleTab] = useState<"testcase" | "result">("testcase");
  const [isConsoleExpanded, setIsConsoleExpanded] = useState(true);

  // Resizable split
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

          const samples: TestCaseItem[] = details.testCases.map((tc) => ({
            id: `sample-${tc.ordinal}`,
            ordinal: tc.ordinal,
            isSample: true,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
          }));
          setTestCaseItems(samples);
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

  const handleResetCode = useCallback(() => {
    if (!state.problem) return;
    const defaultCode = state.problem.starterCode[selectedLanguage] ?? "";
    setState((prev) => ({
      ...prev,
      codeByLanguage: { ...prev.codeByLanguage, [selectedLanguage]: defaultCode },
    }));
  }, [state.problem, selectedLanguage]);

  const handleLanguageChange = (language: Language) => {
    setSelectedLanguage(language);
  };

  const handleAddCustomCase = useCallback(() => {
    if (testCaseItems.length >= 10) return;
    const newCase: TestCaseItem = {
      id: `custom-${Date.now()}`,
      isSample: false,
      input: "",
    };
    setTestCaseItems((prev) => [...prev, newCase]);
  }, [testCaseItems.length]);

  const handleRemoveCustomCase = useCallback((id: string) => {
    setTestCaseItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleUpdateCustomCaseInput = useCallback(
    (id: string, input: string) => {
      setTestCaseItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, input } : item)),
      );
    },
    [],
  );

  const handleRun = useCallback(async () => {
    if (!state.problem || isRunning) return;

    const code = state.codeByLanguage[selectedLanguage];
    if (!code.trim()) return;

    setIsRunning(true);
    setRunOutcome(null);
    setIsConsoleExpanded(true);
    setConsoleTab("result");

    try {
      const payloadCases: RunTestCaseInput[] = testCaseItems.map((tc) => {
        if (tc.isSample) {
          return {
            ordinal: tc.ordinal,
            isSample: true,
            input: tc.input,
          };
        }
        return {
          isSample: false,
          input: tc.input,
        };
      });

      const res = await runCode(
        state.problem.id,
        selectedLanguage,
        code,
        payloadCases,
      );

      if (res.success) {
        setRunOutcome(res.run);
      }
    } catch (err) {
      console.error("Run error:", err);
    } finally {
      setIsRunning(false);
    }
  }, [
    state.problem,
    state.codeByLanguage,
    selectedLanguage,
    testCaseItems,
    isRunning,
  ]);

  useEffect(() => {
    activeSubmissionRef.current = activeSubmission;
  }, [activeSubmission]);

  useEffect(() => {
    const known = activeSubmission?.testResults?.length ?? 0;
    if (revealedCount >= known) return;
    const timer = setTimeout(
      () => setRevealedCount((count) => count + 1),
      REVEAL_INTERVAL_MS,
    );
    return () => clearTimeout(timer);
  }, [activeSubmission, revealedCount]);

  // Celebrate only once the verdict is final *and* the progress bar has
  // finished filling — landing the popup on a half-drawn bar undercuts it.
  useEffect(() => {
    if (!activeSubmission || activeSubmission.verdict !== "AC") return;
    if (activeSubmission.status !== "COMPLETED") return;
    if (celebratedRef.current.has(activeSubmission.id)) return;

    const known = activeSubmission.testResults?.length ?? 0;
    if (revealedCount < known) return;

    celebratedRef.current.add(activeSubmission.id);
    setCelebrating(true);
  }, [activeSubmission, revealedCount]);

  useEffect(() => {
    return () => {
      cleanupSseRef.current?.();
    };
  }, []);

  /**
   * Falls back to polling the durable record when the judge stream can't be
   * read (network fault, or the stream ending before a verdict). Without this
   * a broken stream leaves the row stuck on "Judging..." forever.
   */
  const startPollingFallback = useCallback((submissionId: string) => {
    const finish = () => {
      setIsSubmitting(false);
      cleanupSseRef.current = null;
    };

    cleanupSseRef.current = pollSubmission(
      submissionId,
      (polled) => {
        setActiveSubmission((prev) => {
          if (prev && prev.id !== submissionId) return prev;
          return {
            ...prev,
            ...polled,
            // The stored record spells the language in the API's lowercase
            // form; keep the enum the UI's label maps are keyed by.
            language: prev?.language ?? polled.language,
          };
        });
        if (polled.status === "COMPLETED" || polled.status === "FAILED") {
          finish();
        }
      },
      { onExhausted: finish },
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!state.problem || isSubmitting) return;

    const code = state.codeByLanguage[selectedLanguage];
    if (!code.trim()) return;

    setIsSubmitting(true);
    cleanupSseRef.current?.();
    cleanupSseRef.current = null;

    // Archive the previous run before starting a new one — the finished
    // submission lives in `pastSubmissions`, the in-flight one in
    // `activeSubmission`, so no id is ever in both lists at once.
    const previous = activeSubmissionRef.current;
    if (previous) {
      setPastSubmissions((prev) => [
        { submission: previous, expanded: false },
        ...prev.filter((entry) => entry.submission.id !== previous.id),
      ]);
    }
    setActiveSubmission(null);
    setActiveSubmissionExpanded(true);
    setRevealedCount(0);

    try {
      const response = await createSubmission(
        state.problem.id,
        selectedLanguage,
        code,
      );

      if (!response.success) {
        throw new Error("Failed to create submission");
      }

      // The 202 body omits `language`; carry the local choice so the row's
      // language badge doesn't fall back to a hardcoded default.
      const submission: Submission = {
        ...response.submission,
        language: selectedLanguage,
      };

      setActiveSubmission(submission);
      setActiveTab("submissions");

      if (submission.status === "COMPLETED" || submission.status === "FAILED") {
        setIsSubmitting(false);
        return;
      }

      const cleanup = connectJudgeStream(submission.id, {
        onProgress: (event) => {
          const newResult: TestResult = {
            testCaseId: event.testCaseId,
            verdict: event.verdict,
            stdout: event.stdout,
            stderr: event.stderr,
            exitCode: event.exitCode,
            executionTimeMs: event.executionTimeMs,
            input: event.input,
            expectedOutput: event.expectedOutput,
          };

          setActiveSubmission((prev) => {
            const base = prev && prev.id === submission.id ? prev : submission;
            const existingResults = base.testResults ?? [];
            const index = existingResults.findIndex(
              (tr) => tr.testCaseId === event.testCaseId,
            );

            const updatedResults =
              index >= 0
                ? existingResults.map((tr, i) => (i === index ? newResult : tr))
                : [...existingResults, newResult];

            return {
              ...base,
              // Stay RUNNING even on a failing case: the judge still owes us
              // a VERDICT, and that event is what finalises the submission.
              status: "RUNNING",
              passedTestCases: event.passedTestCases,
              totalTestCases: event.totalTestCases,
              testResults: updatedResults,
            };
          });
        },
        onVerdict: (event) => {
          setIsSubmitting(false);

          setActiveSubmission((prev) => {
            const base = prev && prev.id === submission.id ? prev : submission;
            return {
              ...base,
              status: "COMPLETED",
              verdict: event.verdict,
              passedTestCases: event.passedTestCases,
              totalTestCases: event.totalTestCases,
              // A verdict published straight from the DB record carries no
              // testResults array; keep the ones streamed by PROGRESS.
              testResults:
                event.testResults && event.testResults.length > 0
                  ? event.testResults
                  : base.testResults ?? [],
            };
          });

          // Keep the cleanup handle: the stream is still draining to the
          // server's end-of-response, and a rapid re-submit should be able
          // to force it shut.
        },
        onError: (error) => {
          console.error("Judge stream error:", error);
          startPollingFallback(submission.id);
        },
      });

      cleanupSseRef.current = cleanup;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Submission failed";
      setActiveSubmission(null);
      setIsSubmitting(false);
      console.error("Submit error:", message);
    }
  }, [
    state.problem,
    state.codeByLanguage,
    selectedLanguage,
    isSubmitting,
    startPollingFallback,
  ]);

  if (state.loading) {
    return <ProblemDetailSkeleton />;
  }

  if (state.error) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center bg-[#1a1a1a]">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-[#ef4743] mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">
            {state.error.includes("404") ? "Problem not found" : "Error loading problem"}
          </h2>
          <p className="text-sm text-gray-400 mb-4">{state.error}</p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/problems"
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-[#282828] border border-[#383838] rounded-lg transition-colors"
            >
              Back to problems
            </Link>
            <button
              onClick={handleRetry}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#2cbb5d] hover:bg-[#2cbb5d]/10 rounded-lg transition-colors"
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
  const isSolved = pastSubmissions.some((s) => s.submission.verdict === "AC") || activeSubmission?.verdict === "AC";

  const acceptedRuntimeMs = (activeSubmission?.testResults ?? []).reduce<
    number | null
  >(
    (max, tr) =>
      tr.executionTimeMs == null
        ? max
        : max == null
          ? tr.executionTimeMs
          : Math.max(max, tr.executionTimeMs),
    null,
  );
  const isJudging =
    isSubmitting &&
    (!activeSubmission ||
      activeSubmission.status === "QUEUED" ||
      activeSubmission.status === "RUNNING");

  const allSubmissionsList = [
    ...(activeSubmission ? [activeSubmission] : []),
    ...pastSubmissions
      .map((p) => p.submission)
      .filter((s) => s.id !== activeSubmission?.id),
  ];

  return (
    <div
      ref={splitRef}
      style={{ ["--left-w" as string]: `${splitPercent}%` }}
      className={`flex flex-col lg:flex-row h-[calc(100vh-4rem)] bg-[#1a1a1a] text-gray-100 ${
        dragging ? "cursor-col-resize select-none" : ""
      }`}
    >
      {/* Left panel — problem statement */}
      <div className="split-left flex flex-col overflow-hidden bg-[#1a1a1a] border-r border-[#282828]">
        {/* Nav + tabs (LeetCode Style Header Bar) */}
        <div className="flex items-center gap-2 px-3 h-10 border-b border-[#282828] bg-[#262626] shrink-0">
          <Link
            href="/problems"
            title="Problem List"
            className="flex items-center gap-1 text-xs text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-[#333333] transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="font-semibold">Problem List</span>
          </Link>
          <span className="w-px h-3.5 bg-[#383838]" />

          <div className="flex items-center gap-1">
            {[
              { id: "description", label: "Description", icon: FileText },
              { id: "solutions", label: "Solutions", icon: BookOpen },
              { id: "submissions", label: "Submissions", icon: History },
            ].map(({ id, label, icon: Icon }) => {
              const isSelected = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-[#1a1a1a] text-white font-semibold shadow-sm"
                      : "text-gray-400 hover:text-gray-200 hover:bg-[#333333]/50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 text-gray-400" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Left Panel Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "description" && (
            <article className="p-6 max-w-[44rem] space-y-6">
              <header className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                    <span>1. {state.problem.title}</span>
                  </h1>
                  {isSolved && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#2cbb5d] bg-[#2cbb5d]/10 px-2.5 py-0.5 rounded-full border border-[#2cbb5d]/20">
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      Solved
                    </span>
                  )}
                </div>

                {/* Metadata Pills matching LeetCode screenshot */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <DifficultyBadge difficulty={state.problem.difficulty} />
                  <button className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#282828] text-gray-300 border border-[#383838] hover:bg-[#333333] transition-colors">
                    <Tag className="w-3 h-3 text-gray-400" />
                    <span>Topics</span>
                  </button>
                  <button className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#282828] text-gray-300 border border-[#383838] hover:bg-[#333333] transition-colors">
                    <Lock className="w-3 h-3 text-gray-400" />
                    <span>Companies</span>
                  </button>
                </div>
              </header>

              {/* Statement Markdown */}
              <div className="problem-markdown text-gray-300 text-sm leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {state.problem.statementMd}
                </ReactMarkdown>
              </div>

              {/* Examples */}
              {testCases.length > 0 && (
                <section className="space-y-4 pt-2">
                  {testCases.map((tc, i) => (
                    <ExampleBlock key={tc.ordinal} tc={tc} index={i} />
                  ))}
                </section>
              )}

              {/* Constraints */}
              {state.problem.constraintsMd?.trim() && (
                <section className="space-y-2 pt-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Constraints:
                  </div>
                  <div className="problem-markdown problem-constraints">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {state.problem.constraintsMd}
                    </ReactMarkdown>
                  </div>
                </section>
              )}
            </article>
          )}

          {activeTab === "solutions" && (
            <div className="p-12 text-center text-gray-400">
              <p className="text-sm font-medium">Community Solutions coming soon.</p>
            </div>
          )}

          {/* Submissions Tab (LeetCode Table Screenshot Match) */}
          {activeTab === "submissions" && (
            <div className="flex flex-col h-full">
              {/* Table Header Bar */}
              <div className="grid grid-cols-12 px-4 py-2.5 text-xs font-medium text-gray-400 border-b border-[#282828] bg-[#262626]">
                <span className="col-span-1">#</span>
                <span className="col-span-4">Status</span>
                <span className="col-span-3">Language</span>
                <span className="col-span-2">Runtime</span>
                <span className="col-span-2 text-right">Details</span>
              </div>

              {allSubmissionsList.length === 0 ? (
                <div className="p-12 text-center text-gray-400 text-sm">
                  No submissions yet. Click <strong className="text-white font-semibold">Submit</strong> to run your solution against all hidden test cases.
                </div>
              ) : (
                <div className="divide-y divide-[#282828]">
                  {allSubmissionsList.map((sub, idx) => (
                    <LeetCodeSubmissionRow
                      key={sub.id}
                      submission={sub}
                      index={idx}
                      total={allSubmissionsList.length}
                      expanded={sub.id === activeSubmission?.id ? activeSubmissionExpanded : false}
                      revealedCount={
                        sub.id === activeSubmission?.id
                          ? revealedCount
                          : undefined
                      }
                      onToggle={() => {
                        if (sub.id === activeSubmission?.id) {
                          setActiveSubmissionExpanded((prev) => !prev);
                        }
                      }}
                    />
                  ))}
                </div>
              )}
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
        className="group hidden lg:flex relative w-1.5 shrink-0 cursor-col-resize items-center justify-center touch-none bg-[#1a1a1a]"
      >
        <span
          className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-px transition-colors ${
            dragging ? "bg-[#2cbb5d]" : "bg-[#282828] group-hover:bg-[#383838]"
          }`}
        />
      </div>

      {/* Right panel — code editor */}
      <div className="flex flex-col min-h-0 lg:flex-1 lg:min-w-0 bg-[#1a1a1a]">
        {/* Editor toolbar (LeetCode Header Bar with Animated Run & Submit Buttons) */}
        <div className="flex items-center justify-between px-3 h-10 bg-[#262626] border-b border-[#282828] shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1a1a1a] text-xs font-semibold text-white border border-[#333333]">
              <Code2 className="w-3.5 h-3.5 text-[#2cbb5d]" />
              <span>Code</span>
            </div>

            <LanguageSelector
              selected={selectedLanguage}
              onSelect={handleLanguageChange}
            />

            <button
              onClick={handleResetCode}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#333333] transition-colors"
              title="Reset to starter code"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Animated Run Button */}
            <button
              onClick={handleRun}
              disabled={isRunning || isJudging}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-200 bg-[#282828] hover:bg-[#383838] border border-[#383838] hover:text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2cbb5d]" />
                  <span>Running...</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current text-[#2cbb5d] group-hover:scale-110 transition-transform duration-200" />
                  <span>Run</span>
                </>
              )}
            </button>

            {/* Animated Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={isJudging || isRunning}
              className="group flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#2cbb5d] hover:bg-[#269e4f] transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-[0_0_16px_rgba(44,187,93,0.5)] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isJudging ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Judging...
                </span>
              ) : (
                <>
                  <CloudUpload className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform duration-200" />
                  <span>Submit</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Monaco editor */}
        <div
          className={`flex-1 min-h-0 bg-[#1e1e1e] ${
            dragging ? "pointer-events-none" : ""
          }`}
        >
          <CodeEditor
            language={selectedLanguage}
            value={state.codeByLanguage[selectedLanguage]}
            onChange={handleCodeChange}
          />
        </div>

        {/* Testcase & Test Result Console */}
        <TestConsole
          testCases={testCaseItems}
          onAddCustomCase={handleAddCustomCase}
          onRemoveCustomCase={handleRemoveCustomCase}
          onUpdateCustomCaseInput={handleUpdateCustomCaseInput}
          runOutcome={runOutcome}
          isRunning={isRunning}
          activeTab={consoleTab}
          onTabChange={setConsoleTab}
          isExpanded={isConsoleExpanded}
          onToggleExpand={() => setIsConsoleExpanded((prev) => !prev)}
        />
      </div>

      <AcceptedCelebration
        open={celebrating}
        onClose={() => setCelebrating(false)}
        problemTitle={state.problem.title}
        passedTestCases={activeSubmission?.passedTestCases ?? 0}
        totalTestCases={activeSubmission?.totalTestCases ?? 0}
        runtimeMs={acceptedRuntimeMs}
        language={activeSubmission?.language ?? selectedLanguage}
      />
    </div>
  );
}
