/**
 * RunService: verdict rules, no-early-exit, and the wall-clock budget.
 * Pure unit tests — the DockerRunner is faked.
 */
import { describe, expect, test } from "bun:test";

import { OutputComparator } from "../utils/output.comparator.ts";
import { RunService } from "../services/run.service.ts";
import type { DockerRunner, Sandbox } from "../utils/docker.runner.ts";
import type { RunRequest, RunResult } from "../types/runner.type.ts";
import type { RunTestCase } from "../types/run.type.ts";

const request: RunRequest = {
  language: "python",
  sourceCode: "print(1)",
  stdin: "",
  timeLimitMs: 2_000,
  memoryLimitMb: 256,
};

const execResult = (over: Partial<RunResult> = {}): RunResult => ({
  stdout: "",
  stderr: "",
  exitCode: 0,
  timedOut: false,
  memoryExceeded: false,
  outputExceeded: false,
  stdoutTruncated: false,
  stderrTruncated: false,
  ...over,
});

/** Scripted results per case, plus a count of what actually executed. */
function fakeRunner(
  results: RunResult[],
  options: { compileExitCode?: number; delayMs?: number } = {},
) {
  const state = { executions: 0, destroyed: 0 };

  const runner = {
    async createSandbox(): Promise<Sandbox> {
      return {
        executionId: "test",
        executionDir: "/tmp/test",
        containerName: "test",
        poisoned: false,
      };
    },
    async prepareSandbox() {
      return options.compileExitCode === undefined
        ? null
        : { exitCode: options.compileExitCode, stdout: "", stderr: "boom" };
    },
    async execute(): Promise<RunResult> {
      const result = results[state.executions] ?? execResult();
      state.executions++;

      if (options.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      }

      return result;
    },
    async destroySandbox() {
      state.destroyed++;
    },
  } as unknown as DockerRunner;

  return { runner, state };
}

const sample = (id: string, expectedOutput: string): RunTestCase => ({
  id,
  stdin: "in",
  expectedOutput,
  isSample: true,
});

const custom = (id: string): RunTestCase => ({
  id,
  stdin: "in",
  isSample: false,
});

const service = (runner: DockerRunner) =>
  new RunService(runner, new OutputComparator());

describe("verdicts are produced for sample cases only", () => {
  test("a matching sample is AC", async () => {
    const { runner } = fakeRunner([execResult({ stdout: "5\n" })]);
    const outcome = await service(runner).run(request, [sample("s1", "5")]);

    expect(outcome.results[0]!.verdict).toBe("AC");
    expect(outcome.passedSampleCases).toBe(1);
  });

  test("a mismatching sample is WA", async () => {
    const { runner } = fakeRunner([execResult({ stdout: "4\n" })]);
    const outcome = await service(runner).run(request, [sample("s1", "5")]);

    expect(outcome.results[0]!.verdict).toBe("WA");
    expect(outcome.passedSampleCases).toBe(0);
  });

  test("a clean custom case has no verdict", async () => {
    const { runner } = fakeRunner([execResult({ stdout: "anything\n" })]);
    const outcome = await service(runner).run(request, [custom("c1")]);

    expect(outcome.results[0]!.verdict).toBeNull();
    expect(outcome.results[0]!.expectedOutput).toBeNull();
  });

  test.each([
    ["timedOut", { timedOut: true }],
    ["memoryExceeded", { memoryExceeded: true }],
    ["outputExceeded", { outputExceeded: true }],
    ["non-zero exit", { exitCode: 1 }],
  ])(
    "a custom case that fails with %s still has no verdict",
    async (_label, over) => {
      const { runner } = fakeRunner([execResult(over)]);
      const outcome = await service(runner).run(request, [custom("c1")]);

      expect(outcome.results[0]!.verdict).toBeNull();
    },
  );

  test.each([
    ["timedOut", { timedOut: true }, "TLE"],
    ["memoryExceeded", { memoryExceeded: true }, "MLE"],
    ["outputExceeded", { outputExceeded: true }, "OLE"],
    ["non-zero exit", { exitCode: 1 }, "RE"],
  ])(
    "a sample that fails with %s reports %s",
    async (_label, over, expected) => {
      const { runner } = fakeRunner([execResult(over)]);
      const outcome = await service(runner).run(request, [sample("s1", "5")]);

      expect(outcome.results[0]!.verdict).toBe(expected as never);
    },
  );
});

describe("every case runs", () => {
  test("a failing sample does not stop the ones after it", async () => {
    const { runner, state } = fakeRunner([
      execResult({ stdout: "wrong\n" }),
      execResult({ stdout: "5\n" }),
      execResult({ stdout: "custom\n" }),
    ]);

    const outcome = await service(runner).run(request, [
      sample("s1", "5"),
      sample("s2", "5"),
      custom("c1"),
    ]);

    expect(state.executions).toBe(3);
    expect(outcome.results).toHaveLength(3);
    expect(outcome.results.map((r) => r.verdict)).toEqual(["WA", "AC", null]);
    expect(outcome.passedSampleCases).toBe(1);
    expect(outcome.totalSampleCases).toBe(2);
  });

  test("the sandbox is destroyed even when execution throws", async () => {
    const { runner, state } = fakeRunner([]);
    (runner as unknown as { execute: () => Promise<RunResult> }).execute = () =>
      Promise.reject(new Error("docker exploded"));

    await expect(
      service(runner).run(request, [custom("c1")]),
    ).rejects.toThrow("docker exploded");

    expect(state.destroyed).toBe(1);
  });
});

describe("compile failure", () => {
  test("returns CE with no results and runs nothing", async () => {
    const { runner, state } = fakeRunner([], { compileExitCode: 1 });
    const outcome = await service(runner).run(request, [sample("s1", "5")]);

    expect(outcome.status).toBe("CE");
    expect(outcome.compileError).toBe("boom");
    expect(outcome.results).toEqual([]);
    expect(state.executions).toBe(0);
    expect(state.destroyed).toBe(1);
  });
});

describe("truncation is surfaced", () => {
  test("a truncated stream is flagged on the result", async () => {
    const { runner } = fakeRunner([
      execResult({ stdout: "cut", stdoutTruncated: true }),
    ]);

    const outcome = await service(runner).run(request, [custom("c1")]);

    expect(outcome.results[0]!.stdoutTruncated).toBe(true);
    expect(outcome.results[0]!.stderrTruncated).toBe(false);
  });
});

describe("wall-clock budget", () => {
  test("cases past the budget are reported as skipped, not dropped", async () => {
    process.env.RUN_WALL_BUDGET_MS = "30";

    // Re-import so the module picks up the patched budget.
    const { RunService: Fresh } = await import(
      `../services/run.service.ts?budget=${Date.now()}`
    );

    const { runner, state } = fakeRunner(
      [execResult({ stdout: "1" }), execResult({ stdout: "2" })],
      { delayMs: 50 },
    );

    const outcome = await new Fresh(runner, new OutputComparator()).run(
      request,
      [custom("c1"), custom("c2"), custom("c3")],
    );

    delete process.env.RUN_WALL_BUDGET_MS;

    expect(outcome.budgetExceeded).toBe(true);
    expect(outcome.results).toHaveLength(3);
    expect(state.executions).toBeLessThan(3);
    expect(outcome.results.at(-1)!.skipped).toBe(true);
  });
});
