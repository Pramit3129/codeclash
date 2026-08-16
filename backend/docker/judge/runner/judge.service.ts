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
       * Prepare sandbox (e.g. compile C++ or Java code if applicable).
       */
      const prepResult =
        await this.runner.prepareSandbox(
          sandbox,
          request,
        );

      if (prepResult && prepResult.exitCode !== 0) {
        return {
          verdict: "CE",

          passedTestCases: 0,

          totalTestCases:
            testCases.length,

          failedTestCaseId: null,

          executionTimeMs:
            performance.now() -
            submissionStartTime,

          testResults: [],
        };
      }

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

  /**
   * Maps one execution outcome to a failure verdict, or null when the
   * program ran cleanly and its output still needs comparing.
   *
   * Precedence matters: the limits we enforce ourselves (TLE, OLE) are
   * decided before the exit code, because we SIGKILL those and the
   * resulting 137 would otherwise read as RE.
   *
   * Pure — no Docker, no I/O. Public only so it can be unit tested
   * directly.
   */
  classifyExecution(
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

