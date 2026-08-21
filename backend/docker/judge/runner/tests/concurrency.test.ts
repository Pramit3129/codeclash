import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";

import { DockerRunner, JUDGE_CONTAINER_LABEL } from "../utils/docker.runner.ts";
import { OutputComparator } from "../utils/output.comparator.ts";
import { JudgeService } from "../services/judge.service.ts";

import type { SupportedLanguage } from "../types/runner.type.ts";
import type { TestCase } from "../types/test-case.type.ts";
import type { Verdict } from "../types/verdict.types.ts";

const judge = new JudgeService(new DockerRunner(), new OutputComparator());

const SUITE_TIMEOUT_MS = 180_000;

const SUM: Record<SupportedLanguage, string> = {
  python: `a, b = map(int, input().split())\nprint(a + b)`,
  javascript: `const l=require("fs").readFileSync(0,"utf8").trim().split(/\\s+/).map(Number);console.log(l[0]+l[1]);`,
  java: `import java.util.*;
public class Main { public static void main(String[] a){ Scanner s=new Scanner(System.in); System.out.println(s.nextInt()+s.nextInt()); } }`,
  cpp: `#include <iostream>
int main(){ long long a,b; std::cin>>a>>b; std::cout<<a+b<<std::endl; }`,
};

const HOSTILE = `
import glob, subprocess, os
for f in glob.glob("/tmp/exec-*.pid"):
    try:
        open(f, "w").write("1")
    except Exception:
        pass
subprocess.Popen(["sleep", "300"])
try:
    os.kill(1, 9)
except Exception:
    pass
while True:
    pass`;

function casesFor(marker: number): TestCase[] {
  return [1, 2, 3].map((n) => ({
    id: `c${marker}-${n}`,
    stdin: `${marker} ${n}\n`,
    expectedOutput: `${marker + n}\n`,
    isSample: n === 1,
  }));
}

function labelledContainers(): string[] {
  const result = spawnSync(
    "docker",
    ["ps", "-a", "--filter", `label=${JUDGE_CONTAINER_LABEL}=1`, "--format", "{{.Names}}"],
    { encoding: "utf8" },
  );

  return (result.stdout ?? "").trim().split("\n").filter(Boolean);
}

interface Job {
  id: string;
  language: SupportedLanguage;
  sourceCode: string;
  marker: number;
  want: Verdict;
}

async function runAll(jobs: Job[]) {
  const settled = await Promise.all(
    jobs.map(async (job) => ({
      job,
      result: await judge.judge(
        job.id,
        {
          language: job.language,
          sourceCode: job.sourceCode,
          stdin: "",
          timeLimitMs: 3_000,
          memoryLimitMb: 256,
        },
        casesFor(job.marker),
      ),
    })),
  );

  return settled;
}

describe("concurrent submissions", () => {
  test(
    "two simultaneous submissions stay isolated",
    async () => {
      const outcomes = await runAll([
        { id: "a", language: "python", sourceCode: SUM.python, marker: 10, want: "AC" },
        { id: "b", language: "python", sourceCode: SUM.python, marker: 20, want: "AC" },
      ]);

      for (const { job, result } of outcomes) {
        expect(result.verdict).toBe(job.want);

        for (const testResult of result.testResults) {
          expect(testResult.testCaseId.startsWith(`c${job.marker}-`)).toBe(true);
        }
      }
    },
    SUITE_TIMEOUT_MS,
  );

  test(
    "five submissions across four languages produce correct, unmixed results",
    async () => {
      const jobs: Job[] = [
        { id: "s1", language: "python", sourceCode: SUM.python, marker: 100, want: "AC" },
        { id: "s2", language: "javascript", sourceCode: SUM.javascript, marker: 200, want: "AC" },
        { id: "s3", language: "java", sourceCode: SUM.java, marker: 300, want: "AC" },
        { id: "s4", language: "cpp", sourceCode: SUM.cpp, marker: 400, want: "AC" },
        { id: "s5", language: "python", sourceCode: SUM.python, marker: 500, want: "AC" },
      ];

      const outcomes = await runAll(jobs);
      const seenTestCaseIds = new Set<string>();

      for (const { job, result } of outcomes) {
        expect(result.verdict).toBe(job.want);
        expect(result.passedTestCases).toBe(3);

        for (const testResult of result.testResults) {
          expect(testResult.testCaseId.startsWith(`c${job.marker}-`)).toBe(true);
          expect(seenTestCaseIds.has(testResult.testCaseId)).toBe(false);
          seenTestCaseIds.add(testResult.testCaseId);
        }
      }
    },
    SUITE_TIMEOUT_MS,
  );

  test(
    "a hostile submission cannot affect its concurrent neighbours",
    async () => {
      const jobs: Job[] = [
        { id: "h1", language: "python", sourceCode: SUM.python, marker: 600, want: "AC" },
        { id: "h2", language: "cpp", sourceCode: SUM.cpp, marker: 700, want: "AC" },
        { id: "h3", language: "python", sourceCode: HOSTILE, marker: 800, want: "TLE" },
        { id: "h4", language: "java", sourceCode: SUM.java, marker: 900, want: "AC" },
      ];

      const outcomes = await runAll(jobs);

      for (const { job, result } of outcomes) {
        expect(result.verdict).toBe(job.want);
      }
    },
    SUITE_TIMEOUT_MS,
  );

  test(
    "no sandbox container survives a batch of submissions",
    async () => {
      await runAll([
        { id: "c1", language: "python", sourceCode: SUM.python, marker: 1_000, want: "AC" },
        { id: "c2", language: "python", sourceCode: HOSTILE, marker: 1_100, want: "TLE" },
        {
          id: "c3",
          language: "python",
          sourceCode: `chunks=[]\nwhile True: chunks.append("A"*(10*1024*1024))`,
          marker: 1_200,
          want: "MLE",
        },
      ]);

      expect(labelledContainers()).toHaveLength(0);
    },
    SUITE_TIMEOUT_MS,
  );
});
