/**
 * Verdict matrix across every supported language.
 *
 * Exercises JudgeService end to end against real sandboxes; nothing here
 * touches PostgreSQL. Requires Docker and the four judge images.
 */
import { describe, expect, test } from "bun:test";

import { DockerRunner } from "../utils/docker.runner.ts";
import { OutputComparator } from "../utils/output.comparator.ts";
import { JudgeService } from "../services/judge.service.ts";

import type { SupportedLanguage } from "../types/runner.type.ts";
import type { TestCase } from "../types/test-case.type.ts";

const judge = new JudgeService(new DockerRunner(), new OutputComparator());

const CASE_TIMEOUT_MS = 90_000;

/** Mirrors the configured "Sum of Two Numbers" problem. */
const testCases: TestCase[] = [
  { id: "t1", stdin: "2 3\n", expectedOutput: "5\n", isSample: true },
  { id: "t2", stdin: "10 20\n", expectedOutput: "30\n", isSample: false },
  { id: "t3", stdin: "-4 9\n", expectedOutput: "5\n", isSample: false },
  { id: "t4", stdin: "0 0\n", expectedOutput: "0\n", isSample: false },
  { id: "t5", stdin: "100 -50\n", expectedOutput: "50\n", isSample: false },
];

interface LanguageFixture {
  ac: string;
  wa: string;
  re: string;
  tle: string;
  /** Malformed source. Expected CE in every language, interpreted included. */
  ce: string;
}

const FIXTURES: Record<SupportedLanguage, LanguageFixture> = {
  python: {
    ac: `a, b = map(int, input().split())\nprint(a + b)`,
    wa: `a, b = map(int, input().split())\nprint(a - b)`,
    re: `a, b = map(int, input().split())\nprint(a // 0)`,
    tle: `while True: pass`,
    ce: `def broken(:\n    this is not python`,
  },

  javascript: {
    ac: `const l=require("fs").readFileSync(0,"utf8").trim().split(/\\s+/).map(Number);console.log(l[0]+l[1]);`,
    wa: `const l=require("fs").readFileSync(0,"utf8").trim().split(/\\s+/).map(Number);console.log(l[0]-l[1]);`,
    re: `throw new Error("boom");`,
    tle: `while(true){}`,
    ce: `function broken( { this is not javascript`,
  },

  java: {
    ac: `import java.util.*;
public class Main { public static void main(String[] a){ Scanner s=new Scanner(System.in); System.out.println(s.nextInt()+s.nextInt()); } }`,
    wa: `import java.util.*;
public class Main { public static void main(String[] a){ Scanner s=new Scanner(System.in); System.out.println(s.nextInt()-s.nextInt()); } }`,
    re: `public class Main { public static void main(String[] a){ throw new RuntimeException("boom"); } }`,
    tle: `public class Main { public static void main(String[] a){ while(true){} } }`,
    ce: `public class Main { this is not java }`,
  },

  cpp: {
    ac: `#include <iostream>
int main(){ long long a,b; std::cin>>a>>b; std::cout<<a+b<<std::endl; }`,
    wa: `#include <iostream>
int main(){ long long a,b; std::cin>>a>>b; std::cout<<a-b<<std::endl; }`,
    re: `#include <cstdlib>
int main(){ abort(); }`,
    tle: `int main(){ while(true){} }`,
    ce: `int main(){ this is not c++ }`,
  },
};

const languages = Object.keys(FIXTURES) as SupportedLanguage[];

function run(
  language: SupportedLanguage,
  sourceCode: string,
  over: { timeLimitMs?: number; memoryLimitMb?: number } = {},
) {
  return judge.judge(
    "sub_test",
    {
      language,
      sourceCode,
      stdin: "",
      timeLimitMs: over.timeLimitMs ?? 2_000,
      memoryLimitMb: over.memoryLimitMb ?? 256,
    },
    testCases,
  );
}

describe.each(languages)("%s", (language) => {
  const fixture = FIXTURES[language];

  test(
    "correct solution is AC and runs every test case",
    async () => {
      const result = await run(language, fixture.ac);

      expect(result.verdict).toBe("AC");
      expect(result.passedTestCases).toBe(testCases.length);
      expect(result.failedTestCaseId).toBeNull();
      expect(result.testResults).toHaveLength(testCases.length);
    },
    CASE_TIMEOUT_MS,
  );

  test(
    "wrong answer stops at the first failing case",
    async () => {
      const result = await run(language, fixture.wa);

      expect(result.verdict).toBe("WA");
      expect(result.failedTestCaseId).toBe("t1");

      // Judging is short-circuited rather than run to completion.
      expect(result.testResults).toHaveLength(1);
    },
    CASE_TIMEOUT_MS,
  );

  test(
    "runtime crash is RE",
    async () => {
      const result = await run(language, fixture.re);
      expect(result.verdict).toBe("RE");
    },
    CASE_TIMEOUT_MS,
  );

  test(
    "infinite loop is TLE",
    async () => {
      const result = await run(language, fixture.tle);
      expect(result.verdict).toBe("TLE");
    },
    CASE_TIMEOUT_MS,
  );

  test(
    "syntax error is CE and runs no test cases",
    async () => {
      const result = await run(language, fixture.ce);

      expect(result.verdict).toBe("CE");
      expect(result.passedTestCases).toBe(0);
      expect(result.testResults).toHaveLength(0);
    },
    CASE_TIMEOUT_MS,
  );
});

/**
 * Reference-solution regression.
 *
 * Pins the canonical "Sum of Two Numbers" Python solution to AC 5/5,
 * asserting per-test output rather than only the aggregate verdict.
 *
 * The expected outputs mirror the verified production run of submission
 * cmsu9bznh0003pk01i4tmiyw6 (5, 30, 300, -5, 1000000), so a regression
 * here corresponds to a real user-visible break.
 */
describe("Sum of Two Numbers - Python reference solution", () => {
  const REFERENCE = `a, b = map(int, input().split())\nprint(a + b)`;

  const productionShapedCases: TestCase[] = [
    { id: "p1", stdin: "2 3\n", expectedOutput: "5\n", isSample: true },
    { id: "p2", stdin: "10 20\n", expectedOutput: "30\n", isSample: false },
    { id: "p3", stdin: "100 200\n", expectedOutput: "300\n", isSample: false },
    { id: "p4", stdin: "-10 5\n", expectedOutput: "-5\n", isSample: false },
    { id: "p5", stdin: "999999 1\n", expectedOutput: "1000000\n", isSample: false },
  ];

  test(
    "is AC with 5/5 test cases and correct per-test output",
    async () => {
      const result = await judge.judge(
        "sub_test",
        {
          language: "python",
          sourceCode: REFERENCE,
          stdin: "",
          timeLimitMs: 1_000,
          memoryLimitMb: 256,
        },
        productionShapedCases,
      );

      expect(result.verdict).toBe("AC");
      expect(result.passedTestCases).toBe(5);
      expect(result.totalTestCases).toBe(5);
      expect(result.failedTestCaseId).toBeNull();
      expect(result.testResults).toHaveLength(5);

      const expectedStdout = ["5", "30", "300", "-5", "1000000"] as const;

      result.testResults.forEach((testResult, i) => {
        expect(testResult.verdict).toBe("AC");
        expect(testResult.exitCode).toBe(0);
        expect(testResult.stdout.trim()).toBe(expectedStdout[i]!);
        expect(testResult.stderr).toBe("");
      });
    },
    CASE_TIMEOUT_MS,
  );

  test(
    "runs within the production 1000ms per-test limit",
    async () => {
      const result = await judge.judge(
        "sub_test",
        {
          language: "python",
          sourceCode: REFERENCE,
          stdin: "",
          timeLimitMs: 1_000,
          memoryLimitMb: 256,
        },
        productionShapedCases,
      );

      expect(result.verdict).toBe("AC");

      for (const testResult of result.testResults) {
        expect(testResult.executionTimeMs).toBeLessThan(1_000);
      }
    },
    CASE_TIMEOUT_MS,
  );
});

describe("judge service edge cases", () => {
  test(
    "a problem with zero test cases is vacuously AC",
    async () => {
      const result = await judge.judge(
        "sub_test",
        {
          language: "python",
          sourceCode: "print(1)",
          stdin: "",
          timeLimitMs: 2_000,
          memoryLimitMb: 256,
        },
        [],
      );

      expect(result.verdict).toBe("AC");
      expect(result.totalTestCases).toBe(0);
      expect(result.testResults).toHaveLength(0);
    },
    CASE_TIMEOUT_MS,
  );

  test(
    "a later failing case still reports the earlier passes",
    async () => {
      // Correct except for the final case.
      const result = await run(
        "python",
        `a, b = map(int, input().split())
print(0 if (a, b) == (100, -50) else a + b)`,
      );

      expect(result.verdict).toBe("WA");
      expect(result.passedTestCases).toBe(4);
      expect(result.failedTestCaseId).toBe("t5");
      expect(result.testResults).toHaveLength(5);
    },
    CASE_TIMEOUT_MS,
  );

  test(
    "memory exhaustion is MLE, not RE",
    async () => {
      const result = await run(
        "python",
        `chunks = []
while True:
    chunks.append("A" * (10 * 1024 * 1024))`,
        { memoryLimitMb: 64, timeLimitMs: 5_000 },
      );

      expect(result.verdict).toBe("MLE");
    },
    CASE_TIMEOUT_MS,
  );

  test(
    "runaway output is OLE, not WA",
    async () => {
      const result = await run(
        "python",
        `while True:
    print("A" * 100000)`,
      );

      expect(result.verdict).toBe("OLE");
    },
    CASE_TIMEOUT_MS,
  );

  test(
    "an unsupported language is rejected rather than executed",
    async () => {
      await expect(
        judge.judge(
          "sub_test",
          {
            // "js" is an API-level alias that must be normalised before
            // reaching the judge; it is not a runner language.
            language: "js" as SupportedLanguage,
            sourceCode: "console.log(1)",
            stdin: "",
            timeLimitMs: 2_000,
            memoryLimitMb: 256,
          },
          testCases,
        ),
      ).rejects.toThrow(/Unsupported language/);
    },
    CASE_TIMEOUT_MS,
  );
});
