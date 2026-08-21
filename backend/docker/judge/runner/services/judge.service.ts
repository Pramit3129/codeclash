import { DockerRunner } from "../utils/docker.runner.ts";
import { OutputComparator } from "../utils/output.comparator.ts";
import { publishEvent } from "../pub-sub/publisher.ts";

import type { RunRequest } from "../types/runner.type.ts";
import type { TestCase } from "../types/test-case.type.ts";
import type { JudgeResult, TestResult, Verdict } from "../types/verdict.types.ts";

export class JudgeService {
  constructor(
    private readonly runner: DockerRunner,
    private readonly comparator: OutputComparator,
  ) {}

  async judge(
    submissionId: string,
    request: RunRequest,
    testCases: TestCase[],
  ): Promise<JudgeResult> {
    const submissionStartTime = performance.now();
    let passedTestCases = 0;
    const testResults: TestResult[] = [];

    const sandbox = await this.runner.createSandbox(request);

    try {
      const prepResult = await this.runner.prepareSandbox(sandbox, request);

      if (prepResult && prepResult.exitCode !== 0) {
        return {
          verdict: "CE",
          passedTestCases: 0,
          totalTestCases: testCases.length,
          failedTestCaseId: null,
          executionTimeMs: performance.now() - submissionStartTime,
          testResults: [],
        };
      }

      for (const testCase of testCases) {
        const testStartTime = performance.now();

        const result = await this.runner.execute(
          sandbox,
          request,
          testCase.stdin,
        );

        const executionTimeMs = performance.now() - testStartTime;
        const executionVerdict = this.classifyExecution(result);

        if (executionVerdict !== null) {
          testResults.push({
            testCaseId: testCase.id,
            verdict: executionVerdict,
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
            executionTimeMs,
          });

          return {
            verdict: executionVerdict,
            passedTestCases,
            totalTestCases: testCases.length,
            failedTestCaseId: testCase.id,
            executionTimeMs: performance.now() - submissionStartTime,
            testResults,
          };
        }

        const accepted = this.comparator.compare(
          result.stdout,
          testCase.expectedOutput,
        );

        if (!accepted) {
          testResults.push({
            testCaseId: testCase.id,
            verdict: "WA",
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
            executionTimeMs,
          });

          return {
            verdict: "WA",
            passedTestCases,
            totalTestCases: testCases.length,
            failedTestCaseId: testCase.id,
            executionTimeMs: performance.now() - submissionStartTime,
            testResults,
          };
        }

        testResults.push({
          testCaseId: testCase.id,
          verdict: "AC",
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          executionTimeMs,
        });

        passedTestCases++;

        await publishEvent(2, submissionId, {
          testCaseId: testCase.id,
          passedTestCases,
          totalTestCases: testCases.length,
          verdict: "AC",
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          executionTimeMs,
        });
      }

      return {
        verdict: "AC",
        passedTestCases,
        totalTestCases: testCases.length,
        failedTestCaseId: null,
        executionTimeMs: performance.now() - submissionStartTime,
        testResults,
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
