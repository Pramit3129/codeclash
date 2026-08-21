import { DockerRunner } from "../utils/docker.runner.ts";
import { OutputComparator } from "../utils/output.comparator.ts";

import type { RunRequest } from "../types/runner.type.ts";
import type { RunOutcome, RunTestCase, RunTestCaseResult } from "../types/run.type.ts";
import type { Verdict } from "../types/verdict.types.ts";

/**
 * Executes user code behind the "Run" button. Unlike JudgeService, every
 * test case runs (no early exit on failure) and only sample cases get a
 * verdict — a custom case comes back as plain output.
 */
export class RunService {
  constructor(
    private readonly runner: DockerRunner,
    private readonly comparator: OutputComparator,
  ) {}

  async run(request: RunRequest, testCases: RunTestCase[]): Promise<RunOutcome> {
    const startTime = performance.now();
    const totalSampleCases = testCases.filter((tc) => tc.isSample).length;

    const sandbox = await this.runner.createSandbox(request);

    try {
      const prepResult = await this.runner.prepareSandbox(sandbox, request);

      if (prepResult && prepResult.exitCode !== 0) {
        return {
          status: "CE",
          compileError:
            (prepResult.stderr || prepResult.stdout).trim() ||
            "Compilation failed",
          passedSampleCases: 0,
          totalSampleCases,
          executionTimeMs: performance.now() - startTime,
          results: [],
        };
      }

      const results: RunTestCaseResult[] = [];
      let passedSampleCases = 0;

      for (const testCase of testCases) {
        const testStartTime = performance.now();

        const result = await this.runner.execute(
          sandbox,
          request,
          testCase.stdin,
        );

        const executionTimeMs = performance.now() - testStartTime;

        // Custom cases carry no verdict at all, not even TLE/RE.
        let verdict: Verdict | null = null;

        if (testCase.isSample) {
          const executionVerdict = this.classifyExecution(result);

          if (executionVerdict !== null) {
            verdict = executionVerdict;
          } else {
            const accepted = this.comparator.compare(
              result.stdout,
              testCase.expectedOutput ?? "",
            );

            verdict = accepted ? "AC" : "WA";
            if (accepted) passedSampleCases++;
          }
        }

        results.push({
          testCaseId: testCase.id,
          isSample: testCase.isSample,
          verdict,
          input: testCase.stdin,
          expectedOutput: testCase.expectedOutput ?? null,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          executionTimeMs,
        });

        // A runaway process survived the kill grace period: anything run
        // after this would report garbage.
        if (sandbox.poisoned) break;
      }

      return {
        status: "OK",
        compileError: null,
        passedSampleCases,
        totalSampleCases,
        executionTimeMs: performance.now() - startTime,
        results,
      };
    } finally {
      await this.runner.destroySandbox(sandbox);
    }
  }

  /**
   * Maps execution result to failure verdict (TLE/MLE/OLE/RE), or null if clean.
   */
  classifyExecution(
    result: Awaited<ReturnType<DockerRunner["execute"]>>,
  ): Verdict | null {
    if (result.timedOut) return "TLE";
    if (result.memoryExceeded) return "MLE";
    if (result.outputExceeded) return "OLE";
    if (result.exitCode !== 0) return "RE";
    return null;
  }
}
