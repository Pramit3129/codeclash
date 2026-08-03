"use client";

import { useState, useEffect, type ReactNode } from "react";
import {
  Play,
  Check,
  RefreshCw,
  RotateCcw,
  Terminal,
} from "lucide-react";

type Lang = "python" | "cpp" | "typescript" | "java";

const CODE_SNIPPETS: Record<Lang, string> = {
  python: `from typing import List

class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        lookup = {}
        for i, num in enumerate(nums):
            if target - num in lookup:
                return [lookup[target - num], i]
            lookup[num] = i
        return []`,
  cpp: `#include <vector>
#include <unordered_map>

class Solution {
public:
    std::vector<int> twoSum(std::vector<int>& nums, int target) {
        std::unordered_map<int, int> lookup;
        for (int i = 0; i < nums.size(); ++i) {
            int diff = target - nums[i];
            if (lookup.count(diff)) {
                return {lookup[diff], i};
            }
            lookup[nums[i]] = i;
        }
        return {};
    }
};`,
  typescript: `function twoSum(nums: number[], target: number): number[] {
    const map = new Map<number, number>();
    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        if (map.has(complement)) {
            return [map.get(complement)!, i];
        }
        map.set(nums[i], i);
    }
    return [];
}`,
  java: `import java.util.HashMap;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        HashMap<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (map.containsKey(complement)) {
                return new int[] { map.get(complement), i };
            }
            map.put(nums[i], i);
        }
        return new int[0];
    }
}`,
};

// One Dark palette
const COLORS = {
  default: "#abb2bf",
  keyword: "#c792ea",
  string: "#98c379",
  number: "#d19a66",
  comment: "#5c6370",
};

const TOKEN_RE =
  /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b(?:class|def|return|if|for|in|import|from|function|const|let|var|public|private|static|int|void|bool|string|long|new|using|namespace|vector|unordered_map|HashMap|Map|List|Solution|while|break|continue|self|this)\b|\b\d+(?:\.\d+)?\b/g;

function highlightLine(line: string, key: number): ReactNode {
  const trimmed = line.trim();

  if (trimmed.startsWith("//") || (trimmed.startsWith("#") && !trimmed.startsWith("#include"))) {
    return (
      <span key={key} style={{ color: COLORS.comment }}>
        {line}
      </span>
    );
  }

  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let tokenKey = 0;
  TOKEN_RE.lastIndex = 0;

  while ((match = TOKEN_RE.exec(line)) !== null) {
    if (match.index > last) {
      nodes.push(
        <span key={tokenKey++} style={{ color: COLORS.default }}>
          {line.slice(last, match.index)}
        </span>
      );
    }
    const token = match[0];
    const isString = token.startsWith('"') || token.startsWith("'");
    const isNumber = /^\d/.test(token);
    nodes.push(
      <span
        key={tokenKey++}
        style={{ color: isString ? COLORS.string : isNumber ? COLORS.number : COLORS.keyword }}
      >
        {token}
      </span>
    );
    last = match.index + token.length;
  }

  if (last < line.length) {
    nodes.push(
      <span key={tokenKey++} style={{ color: COLORS.default }}>
        {line.slice(last)}
      </span>
    );
  }

  return <span key={key}>{nodes}</span>;
}

const TESTCASES = [
  { id: 1, label: "Testcase 1", passed: true },
  { id: 2, label: "Testcase 2", passed: true },
  { id: 3, label: "Testcase 3", passed: true },
  { id: 4, label: "Testcase 4", passed: false },
];

export function IDEMockup() {
  const [selectedLang, setSelectedLang] = useState<Lang>("python");
  const [activeTestcase, setActiveTestcase] = useState(1);
  const [timerSeconds, setTimerSeconds] = useState(272);
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [executionResult, setExecutionResult] = useState<{
    status: string;
    runtime: string;
    memory: string;
  } | null>({ status: "Accepted", runtime: "36 ms", memory: "14.2 MB" });

  useEffect(() => {
    const interval = setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 300));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimer = (totalSec: number) => {
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const handleRunCode = () => {
    setIsRunningCode(true);
    setExecutionResult(null);
    setTimeout(() => {
      setIsRunningCode(false);
      setExecutionResult({
        status: "Accepted",
        runtime: `${Math.floor(Math.random() * 15) + 25} ms`,
        memory: `${(Math.random() * 2 + 13.5).toFixed(1)} MB`,
      });
    }, 900);
  };

  return (
    <section className="max-w-6xl mx-auto px-5 sm:px-8 relative z-10 pb-28">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/4 h-72 glow-accent"
      />

      <div className="relative rounded-3xl border border-line bg-surface overflow-hidden shadow-lifted ring-1 ring-black/[0.03] dark:ring-white/[0.04]">
        {/* Window title bar */}
        <div className="flex items-center gap-3 px-5 h-12 border-b border-line bg-elevated/60">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#ff5f57]/80 shadow-soft" />
            <span className="w-3 h-3 rounded-full bg-[#febc2e]/80 shadow-soft" />
            <span className="w-3 h-3 rounded-full bg-[#28c840]/80 shadow-soft" />
          </div>
          <div className="flex-1 flex justify-center">
            <span className="font-mono text-xs text-ink-3 truncate">
              duel / room-92a8 · two-sum
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-success">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
            </span>
            Live
          </div>
        </div>

        {/* Battle header */}
        <div className="grid grid-cols-3 items-center px-6 py-5 border-b border-line">
          {/* Player 1 */}
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <span className="w-9 h-9 rounded-full bg-blue-500/15 text-blue-500 flex items-center justify-center text-sm font-semibold">
                A
              </span>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success ring-2 ring-surface" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Alice</span>
                <span className="font-mono text-[11px] text-ink-3">
                  1524 elo
                </span>
              </div>
              <div className="mt-1.5 h-1 w-28 max-w-full rounded-full bg-elevated overflow-hidden">
                <div
                  className="grow-bar h-full rounded-full bg-gradient-to-r from-accent to-success/80"
                  style={{ width: "85%", animationDelay: "300ms" }}
                />
              </div>
            </div>
          </div>

          {/* Timer */}
          <div className="flex flex-col items-center">
            <span className="font-mono text-lg font-medium tabular-nums text-accent">
              {formatTimer(timerSeconds)}
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-ink-3 mt-0.5">
              Live 1v1
            </span>
          </div>

          {/* Player 2 */}
          <div className="flex items-center gap-3 justify-end">
            <div className="min-w-0 text-right">
              <div className="flex items-center gap-2 justify-end">
                <span className="font-mono text-[11px] text-ink-3">
                  1468 elo
                </span>
                <span className="text-sm font-semibold">Bob</span>
              </div>
              <div className="mt-1.5 h-1 w-28 max-w-full ml-auto rounded-full bg-elevated overflow-hidden">
                <div
                  className="grow-bar h-full rounded-full bg-gradient-to-r from-success/80 to-violet-500"
                  style={{ width: "60%", animationDelay: "450ms" }}
                />
              </div>
            </div>
            <div className="relative shrink-0">
              <span className="w-9 h-9 rounded-full bg-violet-500/15 text-violet-500 flex items-center justify-center text-sm font-semibold">
                B
              </span>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success ring-2 ring-surface" />
            </div>
          </div>
        </div>

        {/* IDE split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[520px]">
          {/* Problem panel */}
          <div className="lg:col-span-5 border-r border-line bg-bg/40 p-7 flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold tracking-tight">
                1. Two Sum
              </h3>
              <span className="rounded-md bg-accent/10 text-accent text-[11px] font-medium px-2 py-0.5">
                Medium
              </span>
            </div>

            <p className="mt-3 text-sm text-ink-2 leading-relaxed">
              Given an array of integers{" "}
              <code className="font-mono text-[12px] px-1 py-0.5 rounded bg-elevated text-ink">
                nums
              </code>{" "}
              and an integer{" "}
              <code className="font-mono text-[12px] px-1 py-0.5 rounded bg-elevated text-ink">
                target
              </code>
              , return indices of the two numbers that add up to{" "}
              <code className="font-mono text-[12px] px-1 py-0.5 rounded bg-elevated text-ink">
                target
              </code>
              .
            </p>

            <div className="mt-4 rounded-xl border border-line bg-elevated/50 p-4 font-mono text-[12px] leading-relaxed">
              <div className="text-ink-3 font-sans text-[11px] font-medium uppercase tracking-wide mb-2">
                Example 1
              </div>
              <div>
                <span className="text-ink-3">Input: </span>
                <span className="text-ink">
                  nums = [2,7,11,15], target = 9
                </span>
              </div>
              <div>
                <span className="text-ink-3">Output: </span>
                <span className="text-ink">[0,1]</span>
              </div>
              <div className="text-ink-3 font-sans text-[12px] mt-1">
                nums[0] + nums[1] == 9, so return [0, 1].
              </div>
            </div>

            <div className="mt-6">
              <div className="text-[11px] font-medium text-ink-3 uppercase tracking-wide mb-2">
                Testcases
              </div>
              <div className="grid grid-cols-2 gap-2">
                {TESTCASES.map((tc) => (
                  <button
                    key={tc.id}
                    onClick={() => setActiveTestcase(tc.id)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors ${
                      activeTestcase === tc.id
                        ? "border-line-strong bg-elevated text-ink"
                        : "border-line bg-surface text-ink-2 hover:bg-elevated/60"
                    }`}
                  >
                    <span className="font-medium">{tc.label}</span>
                    {tc.passed ? (
                      <span className="inline-flex items-center gap-1 text-success">
                        <Check className="w-3 h-3" />
                        Passed
                      </span>
                    ) : (
                      <span className="text-ink-3">Pending</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-auto pt-6 hidden lg:block">
              <div className="rounded-xl border border-line bg-elevated/40 px-4 py-3 flex items-center gap-2.5 text-xs text-ink-3">
                <Terminal className="w-3.5 h-3.5 text-accent" />
                <span>
                  Match state synced — both players see the same problem.
                </span>
              </div>
            </div>
          </div>

          {/* Editor panel */}
          <div className="lg:col-span-7 editor-dark p-0 flex flex-col min-w-0">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <select
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(e.target.value as Lang)}
                  className="bg-white/[0.04] border border-white/[0.08] text-zinc-200 text-xs rounded-md px-3 py-1.5 font-mono focus:outline-none focus:border-accent/60 appearance-none cursor-pointer"
                >
                  <option value="python">Python 3</option>
                  <option value="cpp">C++ 20</option>
                  <option value="typescript">TypeScript</option>
                  <option value="java">Java 17</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" />
                saved
              </div>
            </div>

            {/* Code */}
            <div className="flex-1 overflow-x-auto px-6 py-5 font-mono text-[13px] leading-[1.75]">
              {CODE_SNIPPETS[selectedLang].split("\n").map((line, idx) => (
                <div key={idx} className="flex">
                  <span className="w-7 shrink-0 select-none text-right pr-4 text-zinc-600">
                    {idx + 1}
                  </span>
                  <span className="whitespace-pre">
                    {highlightLine(line, idx)}
                  </span>
                </div>
              ))}
              <div className="flex">
                <span className="w-7 shrink-0 select-none text-right pr-4 text-zinc-600">
                  {CODE_SNIPPETS[selectedLang].split("\n").length + 1}
                </span>
                <span className="cursor-blink" />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/[0.06] space-y-3">
              {isRunningCode ? (
                <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-xs text-zinc-400 flex items-center gap-2.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent" />
                  Running tests against the sandbox…
                </div>
              ) : (
                executionResult && (
                  <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-medium text-emerald-300">
                      <Check className="w-3.5 h-3.5" />
                      {executionResult.status}
                    </span>
                    <span className="flex items-center gap-4 font-mono text-[11px] text-zinc-400">
                      <span>
                        {executionResult.runtime}
                        <span className="text-zinc-600"> runtime</span>
                      </span>
                      <span>
                        {executionResult.memory}
                        <span className="text-zinc-600"> memory</span>
                      </span>
                    </span>
                  </div>
                )
              )}

              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setSelectedLang("python");
                    setExecutionResult({
                      status: "Accepted",
                      runtime: "36 ms",
                      memory: "14.2 MB",
                    });
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset code
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRunCode}
                    disabled={isRunningCode}
                    className="h-9 px-4 rounded-md border border-white/[0.1] bg-white/[0.04] text-xs font-medium text-zinc-200 hover:bg-white/[0.08] transition-colors disabled:opacity-50"
                  >
                    Run
                  </button>
                  <button
                    onClick={handleRunCode}
                    disabled={isRunningCode}
                    className="h-9 px-4 rounded-md bg-accent text-accent-ink text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-accent-strong transition-colors disabled:opacity-50"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    Submit
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
