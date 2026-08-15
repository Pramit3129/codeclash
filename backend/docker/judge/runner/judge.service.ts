import { DockerRunner } from "./docker.runner.ts";
import { OutputComparator } from "./output.comparator.ts";

import type { RunRequest } from "./runner.type.ts";
import type { TestCase } from "./test-case.type.ts";

import type {
  JudgeResult,
  TestResult,
  Verdict,
} from "./verdict.types.ts";

export class JudgeService {
  constructor(
    private readonly runner: DockerRunner,
    private readonly comparator: OutputComparator,
  ) { }

  async judge(
    request: RunRequest,
    testCases: TestCase[],
  ): Promise<JudgeResult> {
    const submissionStartTime =
      performance.now();

    let passedTestCases = 0;

    const testResults: TestResult[] = [];

    /*
     * One Docker container for the entire submission.
     */
    const sandbox =
      await this.runner.createSandbox(
        request,
      );

    try {
      /*
       * Run tests sequentially.
       */
      for (const testCase of testCases) {
        const testStartTime =
          performance.now();

        const result =
          await this.runner.execute(
            sandbox,
            request,
            testCase.stdin,
          );

        const executionTimeMs =
          performance.now() -
          testStartTime;

        /*
         * First determine whether the program
         * failed during execution.
         */
        const executionVerdict =
          this.classifyExecution(result);

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

            totalTestCases:
              testCases.length,

            failedTestCaseId:
              testCase.id,

            executionTimeMs:
              performance.now() -
              submissionStartTime,

            testResults,
          };
        }

        /*
         * Program exited successfully.
         *
         * Now compare its output.
         */
        const accepted =
          this.comparator.compare(
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

            totalTestCases:
              testCases.length,

            failedTestCaseId:
              testCase.id,

            executionTimeMs:
              performance.now() -
              submissionStartTime,

            testResults,
          };
        }

        /*
         * This test passed.
         */
        testResults.push({
          testCaseId: testCase.id,

          verdict: "AC",

          stdout: result.stdout,
          stderr: result.stderr,

          exitCode: result.exitCode,

          executionTimeMs,
        });

        passedTestCases++;
      }

      /*
       * We reached here only if every test passed.
       */
      return {
        verdict: "AC",

        passedTestCases,

        totalTestCases:
          testCases.length,

        failedTestCaseId: null,

        executionTimeMs:
          performance.now() -
          submissionStartTime,

        testResults,
      };
    } finally {
      /*
       * Always destroy the sandbox.
       */
      await this.runner.destroySandbox(
        sandbox,
      );
    }
  }

  private classifyExecution(
    result: Awaited<
      ReturnType<DockerRunner["execute"]>
    >,
  ): Verdict | null {
    if (result.timedOut) {
      return "TLE";
    }

    if (result.memoryExceeded) {
      return "MLE";
    }

    if (result.outputExceeded) {
      return "OLE";
    }

    if (result.exitCode !== 0) {
      return "RE";
    }

    return null;
  }
}

