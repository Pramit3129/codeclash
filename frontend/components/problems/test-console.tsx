"use client";

import { useState, useEffect, useRef } from "react";
import {
  Lock,
  Plus,
  Trash2,
  Check,
  X,
  Clock,
  Terminal,
  ChevronUp,
  ChevronDown,
  Loader2,
  AlertCircle,
  Copy,
  CheckCircle2,
} from "lucide-react";
import type {
  TestCaseItem,
  RunOutcome,
  RunTestCaseResult,
} from "@/lib/problems/types";

interface TestConsoleProps {
  testCases: TestCaseItem[];
  onAddCustomCase: () => void;
  onRemoveCustomCase: (id: string) => void;
  onUpdateCustomCaseInput: (id: string, input: string) => void;
  runOutcome: RunOutcome | null;
  isRunning: boolean;
  activeTab: "testcase" | "result";
  onTabChange: (tab: "testcase" | "result") => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const DEFAULT_CONSOLE_HEIGHT = 290;
const MIN_CONSOLE_HEIGHT = 150;
const MAX_CONSOLE_HEIGHT = 650;

function formatMs(ms: number): string {
  return ms < 10 ? `${ms.toFixed(1)}ms` : `${Math.round(ms)}ms`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#333333] transition-colors"
      title="Copy text"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-[#2cbb5d]" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

/**
 * Sanitizes container/internal path references (e.g. `/sandbox/main.py`, `/tmp/...`)
 * into clean, LeetCode-style `Line X` line numbers so sandbox paths are never exposed.
 */
export function sanitizeErrorOutput(text: string): string {
  if (!text) return "";

  let cleaned = text;

  // 1. Python tracebacks: File "/sandbox/main.py", line 14 -> Line 14
  cleaned = cleaned.replace(
    /File\s+["'].*?([^\/\\]+\.(?:py|js|ts|cpp|c|java))["'],\s*line\s*(\d+)/gi,
    "Line $2",
  );
  cleaned = cleaned.replace(/File\s+["'].*?["'],\s*line\s*(\d+)/gi, "Line $1");

  // 2. C++ / C / Java compiler & runtime errors: /sandbox/Solution.java:4: error: -> Line 4: error:
  cleaned = cleaned.replace(
    /(?:[a-zA-Z]:)?[\\\/].*?[\\\/]([^\/\\]+\.(?:cpp|c|hpp|h|java)):(\d+):(\d+):/gi,
    "Line $2:$3:",
  );
  cleaned = cleaned.replace(
    /(?:[a-zA-Z]:)?[\\\/].*?[\\\/]([^\/\\]+\.(?:cpp|c|hpp|h|java)):(\d+):/gi,
    "Line $2:",
  );

  // 3. Node.js stack traces: at main (/sandbox/main.js:7:10) -> at main (Line 7:10)
  cleaned = cleaned.replace(
    /\(.*?[\\\/](?:sandbox|tmp|algoriumx)[\\\/].*?:(\d+):(\d+)\)/gi,
    "(Line $1:$2)",
  );
  cleaned = cleaned.replace(
    /at\s+.*?[\\\/](?:sandbox|tmp|algoriumx)[\\\/].*?:(\d+):(\d+)/gi,
    "at Line $1:$2",
  );

  // 4. Fallback: replace any lingering /sandbox/ or /tmp/ paths with "solution"
  cleaned = cleaned.replace(
    /["']?\/sandbox\/[a-zA-Z0-9_\-\.\/]+["']?/g,
    "solution",
  );
  cleaned = cleaned.replace(
    /["']?\/tmp\/[a-zA-Z0-9_\-\.\/]+["']?/g,
    "solution",
  );

  return cleaned.trim();
}

function extractMainError(stderr: string): string | null {
  if (!stderr) return null;
  const lines = stderr
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  return lines[lines.length - 1];
}

export function getCaseStatus(res: RunTestCaseResult) {
  const isError =
    (res.exitCode !== null && res.exitCode !== 0) ||
    res.verdict === "RE" ||
    (res.stderr && res.stderr.trim().length > 0 && res.verdict !== "AC");

  if (res.isSample && res.expectedOutput !== null) {
    if (res.verdict === "AC" && !isError) {
      return {
        label: "Accepted",
        isSuccess: true,
        isError: false,
        isTle: false,
        isCustom: false,
      };
    }
    if (res.verdict === "TLE") {
      return {
        label: "Time Limit Exceeded",
        isSuccess: false,
        isError: true,
        isTle: true,
        isCustom: false,
      };
    }
    if (isError) {
      return {
        label: "Runtime Error",
        isSuccess: false,
        isError: true,
        isTle: false,
        isCustom: false,
      };
    }
    return {
      label: "Wrong Answer",
      isSuccess: false,
      isError: true,
      isTle: false,
      isCustom: false,
    };
  }

  // Custom case
  if (isError) {
    return {
      label: "Runtime Error",
      isSuccess: false,
      isError: true,
      isTle: false,
      isCustom: true,
    };
  }
  return {
    label: "Executed",
    isSuccess: true,
    isError: false,
    isTle: false,
    isCustom: true,
  };
}

export function getOverallRunStatus(runOutcome: RunOutcome) {
  if (runOutcome.status === "CE" || runOutcome.compileError) {
    return {
      label: "Compile Error",
      failingCaseText: "",
      isSuccess: false,
    };
  }

  // Find index of first failing/error case
  const failingIdx = runOutcome.results.findIndex((r) => {
    const isError =
      (r.exitCode !== null && r.exitCode !== 0) ||
      r.verdict === "RE" ||
      (r.stderr && r.stderr.trim().length > 0 && r.verdict !== "AC");
    const isSampleFail = r.isSample && r.verdict !== "AC";
    return isError || isSampleFail;
  });

  let failingCaseText = "";
  if (failingIdx >= 0) {
    const failingRes = runOutcome.results[failingIdx];
    failingCaseText =
      failingRes.expectedOutput === null
        ? `(Case ${failingIdx + 1} Custom)`
        : `(Case ${failingIdx + 1})`;
  }

  const hasRuntimeError = runOutcome.results.some(
    (r) =>
      (r.exitCode !== null && r.exitCode !== 0) ||
      r.verdict === "RE" ||
      (r.stderr && r.stderr.trim().length > 0 && r.verdict !== "AC"),
  );
  if (hasRuntimeError) {
    return {
      label: "Runtime Error",
      failingCaseText,
      isSuccess: false,
    };
  }

  const hasWrongAnswer = runOutcome.results.some(
    (r) => r.isSample && r.verdict === "WA",
  );
  if (hasWrongAnswer) {
    return {
      label: "Wrong Answer",
      failingCaseText,
      isSuccess: false,
    };
  }

  const hasTle = runOutcome.results.some(
    (r) => r.isSample && r.verdict === "TLE",
  );
  if (hasTle) {
    return {
      label: "Time Limit Exceeded",
      failingCaseText,
      isSuccess: false,
    };
  }

  if (runOutcome.passedSampleCases === runOutcome.totalSampleCases) {
    return {
      label: "Accepted",
      failingCaseText: "",
      isSuccess: true,
    };
  }

  return {
    label: "Wrong Answer",
    failingCaseText,
    isSuccess: false,
  };
}

export function TestConsole({
  testCases,
  onAddCustomCase,
  onRemoveCustomCase,
  onUpdateCustomCaseInput,
  runOutcome,
  isRunning,
  activeTab,
  onTabChange,
  isExpanded,
  onToggleExpand,
}: TestConsoleProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string>(
    testCases[0]?.id ?? "",
  );
  const [selectedResultIndex, setSelectedResultIndex] = useState<number>(0);

  // Vertical Resizing State
  const [consoleHeight, setConsoleHeight] = useState(DEFAULT_CONSOLE_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartYRef = useRef<number>(0);
  const dragStartHeightRef = useRef<number>(DEFAULT_CONSOLE_HEIGHT);

  // Keep selectedCaseId valid when testCases list changes
  useEffect(() => {
    if (!testCases.some((tc) => tc.id === selectedCaseId)) {
      if (testCases.length > 0) {
        setSelectedCaseId(testCases[0].id);
      }
    }
  }, [testCases, selectedCaseId]);

  // When runOutcome updates, automatically select the FIRST failing testcase!
  useEffect(() => {
    if (runOutcome?.results && runOutcome.results.length > 0) {
      const firstFailIndex = runOutcome.results.findIndex((r) => {
        const isError =
          (r.exitCode !== null && r.exitCode !== 0) ||
          r.verdict === "RE" ||
          (r.stderr && r.stderr.trim().length > 0 && r.verdict !== "AC");
        const isSampleFail = r.isSample && r.verdict !== "AC";
        return isError || isSampleFail;
      });

      if (firstFailIndex >= 0) {
        setSelectedResultIndex(firstFailIndex);
      } else {
        setSelectedResultIndex(0);
      }
    }
  }, [runOutcome]);

  const activeTestCase =
    testCases.find((tc) => tc.id === selectedCaseId) ?? testCases[0];

  const activeResult: RunTestCaseResult | undefined =
    runOutcome?.results?.[selectedResultIndex];

  // Vertical Drag Handle Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = consoleHeight;
    setIsResizing(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizing) return;
    const deltaY = dragStartYRef.current - e.clientY;
    const newHeight = Math.min(
      MAX_CONSOLE_HEIGHT,
      Math.max(MIN_CONSOLE_HEIGHT, dragStartHeightRef.current + deltaY),
    );
    setConsoleHeight(newHeight);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsResizing(false);
  };

  const overallStatus = runOutcome ? getOverallRunStatus(runOutcome) : null;
  const sanitizedCompileError = runOutcome?.compileError
    ? sanitizeErrorOutput(runOutcome.compileError)
    : null;

  return (
    <div
      style={{
        height: isExpanded ? `${consoleHeight}px` : "auto",
      }}
      className={`relative border-t border-[#282828] bg-[#1a1a1a] flex flex-col transition-[height] duration-75 ${
        isResizing ? "select-none" : ""
      }`}
    >
      {/* Top Vertical Drag Handle */}
      {isExpanded && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize console height"
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={() => setConsoleHeight(DEFAULT_CONSOLE_HEIGHT)}
          className="group absolute -top-1.5 inset-x-0 h-3 cursor-row-resize z-20 flex items-center justify-center touch-none"
        >
          <span
            className={`h-[3px] w-12 rounded-full transition-colors ${
              isResizing ? "bg-[#2cbb5d]" : "bg-[#333333] group-hover:bg-[#444444]"
            }`}
          />
        </div>
      )}

      {/* Console Header Bar (LeetCode Style) */}
      <div className="flex items-center justify-between px-3 h-9 border-b border-[#282828] bg-[#262626] shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              if (!isExpanded) onToggleExpand();
              onTabChange("testcase");
            }}
            className={`px-3 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all ${
              activeTab === "testcase" && isExpanded
                ? "bg-[#1a1a1a] text-white font-semibold shadow-sm"
                : "text-gray-400 hover:text-gray-200 hover:bg-[#333333]/50"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-[#2cbb5d]" />
            <span>Testcase</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#333333] text-gray-400">
              {testCases.length}
            </span>
          </button>

          <button
            onClick={() => {
              if (!isExpanded) onToggleExpand();
              onTabChange("result");
            }}
            className={`px-3 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all ${
              activeTab === "result" && isExpanded
                ? "bg-[#1a1a1a] text-white font-semibold shadow-sm"
                : "text-gray-400 hover:text-gray-200 hover:bg-[#333333]/50"
            }`}
          >
            {isRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2cbb5d]" />
            ) : (
              <Terminal className="w-3.5 h-3.5 text-[#2cbb5d]" />
            )}
            <span>Test Result</span>
            {overallStatus && (
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  overallStatus.isSuccess ? "bg-[#2cbb5d]" : "bg-[#ef4743]"
                }`}
              />
            )}
          </button>
        </div>

        <button
          onClick={onToggleExpand}
          className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#333333] transition-colors"
          title={isExpanded ? "Collapse Console" : "Expand Console"}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronUp className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Expanded Console Body */}
      {isExpanded && (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4 bg-[#1a1a1a]">
          {/* TAB 1: TESTCASE INPUT VIEW */}
          {activeTab === "testcase" && (
            <div className="flex flex-col gap-3 flex-1 min-h-0">
              {/* Test Case Sub-Tabs (LeetCode Style) */}
              <div className="flex items-center gap-2 flex-wrap">
                {testCases.map((tc, index) => {
                  const isSelected = tc.id === selectedCaseId;
                  return (
                    <div
                      key={tc.id}
                      className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isSelected
                          ? "bg-[#282828] text-white border border-[#383838] shadow-sm font-semibold"
                          : "text-gray-400 hover:text-gray-200 hover:bg-[#262626]"
                      }`}
                    >
                      <button
                        onClick={() => setSelectedCaseId(tc.id)}
                        className="flex items-center gap-1.5"
                      >
                        {tc.isSample && (
                          <span title="Sample testcase (locked)">
                            <Lock className="w-3 h-3 text-[#ffa116]" />
                          </span>
                        )}
                        <span>
                          Case {index + 1}
                          {!tc.isSample && " (Custom)"}
                        </span>
                      </button>

                      {!tc.isSample && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveCustomCase(tc.id);
                          }}
                          className="opacity-60 group-hover:opacity-100 hover:text-[#ef4743] p-0.5 rounded transition-all ml-0.5"
                          title="Delete custom testcase"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {testCases.length < 10 && (
                  <button
                    onClick={onAddCustomCase}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-[#2cbb5d] hover:bg-[#2cbb5d]/10 transition-all border border-dashed border-[#383838]"
                    title="Add custom testcase"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Case</span>
                  </button>
                )}
              </div>

              {/* Active Testcase Input Box */}
              {activeTestCase && (
                <div className="flex flex-col gap-2 flex-1 min-h-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-400">
                      Input
                    </span>
                    {activeTestCase.isSample ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#ffa116] bg-[#ffa116]/10 px-2 py-0.5 rounded border border-[#ffa116]/20">
                        <Lock className="w-2.5 h-2.5" />
                        Sample Case (Locked)
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-[#2cbb5d] bg-[#2cbb5d]/10 px-2 py-0.5 rounded border border-[#2cbb5d]/20">
                        Custom Case (Editable)
                      </span>
                    )}
                  </div>

                  <textarea
                    value={activeTestCase.input}
                    onChange={(e) =>
                      onUpdateCustomCaseInput(
                        activeTestCase.id,
                        e.target.value,
                      )
                    }
                    readOnly={activeTestCase.isSample}
                    placeholder="Enter test input..."
                    className={`w-full flex-1 font-mono text-xs p-3.5 rounded-xl border bg-[#262626] border-[#333333] resize-none outline-none transition-all ${
                      activeTestCase.isSample
                        ? "text-gray-300 cursor-not-allowed opacity-90"
                        : "focus:border-[#2cbb5d] text-white"
                    }`}
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TEST RESULT VIEW (LeetCode Screenshot Match) */}
          {activeTab === "result" && (
            <div className="flex flex-col gap-3 flex-1 min-h-0">
              {isRunning ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin text-[#2cbb5d]" />
                  <p className="text-xs font-medium">Running test cases...</p>
                </div>
              ) : !runOutcome ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
                  <Terminal className="w-6 h-6 stroke-[1.5]" />
                  <p className="text-xs">
                    Run your code to execute sample and custom test cases.
                  </p>
                </div>
              ) : runOutcome.status === "CE" || sanitizedCompileError ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#ef4743]">
                      <AlertCircle className="w-4 h-4" />
                      <span>Compile Error</span>
                    </div>
                    <CopyButton text={sanitizedCompileError || ""} />
                  </div>
                  <pre className="font-mono text-xs text-[#ef4743] bg-[#ef4743]/10 p-3.5 rounded-xl border border-[#ef4743]/25 whitespace-pre-wrap break-words leading-relaxed">
                    {sanitizedCompileError || "Compilation failed."}
                  </pre>
                </div>
              ) : (
                <div className="flex flex-col gap-3 flex-1 min-h-0">
                  {/* Status Banner (LeetCode Screenshot Match) */}
                  <div className="flex items-center gap-3 shrink-0">
                    {overallStatus?.isSuccess ? (
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-[#2cbb5d]">
                          Accepted
                        </span>
                        <span className="text-xs text-gray-400 font-mono">
                          Runtime: {formatMs(runOutcome.executionTimeMs)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-[#ef4743]">
                          {overallStatus?.label}
                        </span>
                        {overallStatus?.failingCaseText && (
                          <span className="text-xs font-semibold text-[#ef4743]">
                            {overallStatus.failingCaseText}
                          </span>
                        )}
                        <span className="text-xs text-gray-400 font-mono">
                          Runtime: {formatMs(runOutcome.executionTimeMs)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Case Results Sub-Tabs (Green pill checkmark cards matching LeetCode screenshot) */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {runOutcome.results.map((res, idx) => {
                      const isSelected = selectedResultIndex === idx;
                      const status = getCaseStatus(res);

                      return (
                        <button
                          key={res.testCaseId ?? idx}
                          onClick={() => setSelectedResultIndex(idx)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            status.isSuccess
                              ? isSelected
                                ? "bg-[#2cbb5d]/20 text-[#2cbb5d] border border-[#2cbb5d]/40 shadow-sm"
                                : "bg-[#262626] text-[#2cbb5d]/80 hover:bg-[#282828]"
                              : isSelected
                              ? "bg-[#ef4743]/20 text-[#ef4743] border border-[#ef4743]/40 shadow-sm"
                              : "bg-[#262626] text-[#ef4743]/80 hover:bg-[#282828]"
                          }`}
                        >
                          {status.isSuccess ? (
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          ) : (
                            <X className="w-3.5 h-3.5 stroke-[2.5]" />
                          )}
                          <span>
                            Case {idx + 1}
                            {res.expectedOutput === null ? " (Custom)" : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Result Detail View (LeetCode style dark box cards) */}
                  {activeResult && (
                    <div className="space-y-3 font-mono text-xs flex-1 min-h-0 overflow-y-auto pt-1">
                      {/* Input Card */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-sans font-medium text-gray-400">
                            Input
                          </span>
                          <CopyButton text={activeResult.input} />
                        </div>
                        <pre className="p-3.5 rounded-xl bg-[#262626] border border-[#333333] text-gray-100 whitespace-pre-wrap break-words">
                          {activeResult.input.trim() || "<empty>"}
                        </pre>
                      </div>

                      {/* Output Card */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-sans font-medium text-gray-400">
                            Output
                          </span>
                          <CopyButton text={activeResult.stdout} />
                        </div>
                        <pre className="p-3.5 rounded-xl bg-[#262626] border border-[#333333] text-gray-100 whitespace-pre-wrap break-words">
                          {activeResult.stdout.trim() || "<no output>"}
                        </pre>
                      </div>

                      {/* Expected Output Card */}
                      {activeResult.expectedOutput !== null && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-sans font-medium text-gray-400">
                              Expected Output
                            </span>
                            <CopyButton text={activeResult.expectedOutput} />
                          </div>
                          <pre className="p-3.5 rounded-xl bg-[#262626] border border-[#333333] text-gray-100 whitespace-pre-wrap break-words">
                            {activeResult.expectedOutput.trim() || "<empty>"}
                          </pre>
                        </div>
                      )}

                      {/* Standard Error (stderr) */}
                      {activeResult.stderr ? (
                        <div>
                          {(() => {
                            const sanitizedStderr = sanitizeErrorOutput(
                              activeResult.stderr,
                            );
                            const mainErr = extractMainError(sanitizedStderr);

                            return (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-sans font-medium text-[#ef4743]">
                                    Standard Error (stderr)
                                  </span>
                                  <CopyButton text={sanitizedStderr} />
                                </div>
                                <div className="rounded-xl bg-[#ef4743]/10 border border-[#ef4743]/25 p-3.5 text-[#ef4743] font-mono overflow-hidden">
                                  {mainErr && (
                                    <div className="mb-2 font-semibold text-xs pb-1.5 border-b border-[#ef4743]/20">
                                      {mainErr}
                                    </div>
                                  )}
                                  <pre className="whitespace-pre-wrap break-words leading-relaxed text-xs">
                                    {sanitizedStderr}
                                  </pre>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
