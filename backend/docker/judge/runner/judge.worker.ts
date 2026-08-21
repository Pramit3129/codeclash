import { Worker, UnrecoverableError } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { redis } from "../../../src/lib/redis.js";
import { logger } from "../../../src/lib/logger.js";
import { JUDGE_QUEUE_NAME } from "./judge.queue.js";
import { DockerRunner } from "./docker.runner.ts";
import { OutputComparator } from "./output.comparator.ts";
import { JudgeService } from "./judge.service.ts";
import { ProblemRepository } from "./problem.repository.ts";
import { SubmissionRepository } from "./submission.repository.ts";
import { LANGUAGE_CONFIG } from "./language.config.ts";
import { resolveConcurrency } from "./judge.concurrency.ts";
import type { SupportedLanguage } from "./runner.type.ts";
import { publishVerdict } from "./pub-sub/publisher.ts";

const prisma = new PrismaClient();
const runner = new DockerRunner();
const comparator = new OutputComparator();
const judgeService = new JudgeService(runner, comparator);
const problemRepository = new ProblemRepository(prisma);
const submissionRepository = new SubmissionRepository(prisma);

/*
 * One judge job at a time per worker process.
 *
 * Sandboxes are isolated from each other, but each one is allowed a full
 * CPU share and the problem's memory limit, so raising this trades judge
 * throughput against timing accuracy: co-scheduled submissions inflate
 * each other's wall-clock time and cause spurious TLEs.
 */
const JUDGE_CONCURRENCY = resolveConcurrency(
  process.env.JUDGE_CONCURRENCY,

  /*
   * A misconfiguration must degrade to "works, serially" and say so —
   * never to "silently stops judging".
   */
  (suppliedValue) => {
    logger.warn(
      { JUDGE_CONCURRENCY: suppliedValue },
      "invalid JUDGE_CONCURRENCY, falling back to 1",
    );
  },
);

/**
 * Raised for faults that are the judge's fault rather than the
 * submitted program's: Docker unreachable, database down, bad
 * configuration. These are retryable and must never reach a user as a
 * verdict.
 */
class InfrastructureError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "InfrastructureError";
  }
}

/*
 * Log payloads deliberately exclude sourceCode: it is attacker-supplied,
 * unbounded, and of no diagnostic value in aggregate logs.
 */
const jobContext = (job: { id?: string | null; data: unknown }) => {
  const data = job.data as {
    submissionId?: string;
    problemId?: string;
    language?: string;
  };

  return {
    jobId: job.id,
    submissionId: data?.submissionId,
    problemId: data?.problemId,
    language: data?.language,
  };
};

export const judgeWorker = new Worker(
  JUDGE_QUEUE_NAME,
  async (job) => {
    const {
      submissionId,
      problemId,
      language,
      sourceCode,
    } = job.data as {
      submissionId: string;
      userId: string;
      problemId: string;
      language: SupportedLanguage;
      sourceCode: string;
    };

    logger.info(jobContext(job), "judge job started");

    /*
     * Validate against the trusted server-side language table before
     * touching Docker. The API accepts aliases ("js", "c++") that have
     * no entry here; without this check the mismatch surfaces deep in
     * the runner and the submission is retried three times before
     * being stranded.
     */
    if (!LANGUAGE_CONFIG[language]) {
      throw new UnrecoverableError(
        `Unsupported language: ${language}`,
      );
    }

    let problem;

    try {
      problem = await problemRepository.findById(problemId);
    } catch (error) {
      throw new InfrastructureError("Failed to load problem", {
        cause: error,
      });
    }

    if (problem.testCases.length === 0) {
      /*
       * Bad problem configuration. Retrying cannot fix it, so fail the
       * job permanently instead of burning three attempts.
       */
      throw new UnrecoverableError(
        `Problem ${problemId} has no test cases`,
      );
    }

    await submissionRepository.markRunning(submissionId);

    const testCases = problem.testCases.map((testCase) => ({
      id: testCase.id,
      stdin: testCase.input,
      expectedOutput: testCase.expectedOutput,
      isSample: testCase.isSample,
    }));

    let result;

    try {
      result = await judgeService.judge(
        {
          language,
          sourceCode,
          stdin: "",
          timeLimitMs: problem.timeLimitMs,
          memoryLimitMb: problem.memoryLimitMb,
        },
        testCases,
      );
    } catch (error) {
      /*
       * JudgeService only throws when the sandbox itself could not be
       * created or driven. A misbehaving submission produces a verdict,
       * never an exception, so anything landing here is infrastructure.
       */
      throw new InfrastructureError("Judge execution failed", {
        cause: error,
      });
    }

    try {
      await submissionRepository.createResult({
        submissionId,
        result,
      });

      publishVerdict(submissionId, result);

    } catch (error) {
      throw new InfrastructureError(
        "Failed to persist judge result",
        { cause: error },
      );
    }

    logger.info(
      {
        ...jobContext(job),
        verdict: result.verdict,
        passedTestCases: result.passedTestCases,
        totalTestCases: result.totalTestCases,
        executionTimeMs: Math.round(result.executionTimeMs),
      },
      "judge job completed",
    );

    return result;
  },
  {
    connection: redis,

    concurrency: JUDGE_CONCURRENCY,

    /*
     * A judge run is bounded by (compile timeout + per-test time limit
     * x test count) plus Docker overhead. If a job exceeds this the
     * worker is assumed wedged and BullMQ hands the job to another
     * worker. Deliberately generous: reclaiming a job that is merely
     * slow causes duplicate execution.
     */
    stalledInterval: 60_000,
    maxStalledCount: 2,
  },
);

/*
 * Terminal-state bookkeeping.
 *
 * BullMQ retries are configured on the producer side (judge.queue.ts).
 * Once all attempts are exhausted the submission must not be left at
 * status = QUEUED/RUNNING forever, so it is moved to FAILED — an
 * explicit infrastructure outcome, distinct from any verdict.
 */
judgeWorker.on("failed", async (job, error) => {
  const context = job ? jobContext(job) : {};

  /*
   * Include the underlying cause: InfrastructureError wraps the real
   * fault (a Prisma/Docker error), and logging only the wrapper's
   * message reduces every failure to an unactionable
   * "Failed to persist judge result".
   */
  const cause = (error as { cause?: unknown })?.cause;

  logger.error(
    {
      ...context,
      err: { name: error?.name, message: error?.message },
      cause:
        cause instanceof Error
          ? { name: cause.name, message: cause.message }
          : cause,
      attemptsMade: job?.attemptsMade,
    },
    "judge job failed",
  );

  if (!job) {
    return;
  }

  const attemptsAllowed = job.opts.attempts ?? 1;
  const exhausted =
    error instanceof UnrecoverableError ||
    error?.name === "UnrecoverableError" ||
    job.attemptsMade >= attemptsAllowed;

  if (!exhausted) {
    return;
  }

  const { submissionId } = job.data as { submissionId?: string };

  if (!submissionId) {
    return;
  }

  try {
    await submissionRepository.markFailed({
      submissionId,
      reason: error?.message ?? "Unknown judge failure",
    });
  } catch (markError) {
    logger.error(
      { ...context, err: markError },
      "failed to record terminal FAILED state",
    );
  }
});

judgeWorker.on("error", (error) => {
  logger.error({ err: error }, "judge worker error");
});

/**
 * Removes sandbox containers orphaned by a previous worker process.
 * `finally` blocks do not run through SIGKILL or a host failure, so
 * without this a crash leaks containers indefinitely.
 */
export async function reapOnStartup(): Promise<void> {
  try {
    const reaped = await runner.reapOrphanedSandboxes();

    if (reaped.length > 0) {
      logger.warn(
        { count: reaped.length, containers: reaped },
        "reaped orphaned judge sandboxes from a previous run",
      );
    }
  } catch (error) {
    logger.error({ err: error }, "sandbox reaper failed");
  }

  /*
   * Well beyond any legitimate run (compile timeout plus per-test
   * limits across all test cases), so a submission actively being
   * judged by a live worker is never stolen.
   */
  const STRANDED_AFTER_MS = 15 * 60_000;

  try {
    const stranded =
      await submissionRepository.failStrandedRunning({
        olderThanMs: STRANDED_AFTER_MS,
      });

    if (stranded > 0) {
      logger.warn(
        { count: stranded },
        "marked stranded RUNNING submissions as FAILED",
      );
    }
  } catch (error) {
    logger.error(
      { err: error },
      "stranded submission sweep failed",
    );
  }
}

/**
 * Stops accepting new jobs, lets the in-flight job finish, then closes
 * Redis and Prisma. Without this a deploy SIGTERMs the worker mid-run
 * and leaks its sandbox container.
 *
 * `close(false)` waits for the active job rather than killing it; the
 * caller applies the hard deadline.
 */
export async function shutdownJudgeWorker(): Promise<void> {
  await judgeWorker.close();

  try {
    await prisma.$disconnect();
  } catch (error) {
    logger.error({ err: error }, "prisma disconnect failed");
  }

  /*
   * Sweep again on the way out: if the active job was force-terminated
   * its sandbox may still exist.
   */
  try {
    await runner.reapOrphanedSandboxes();
  } catch (error) {
    logger.error({ err: error }, "shutdown sandbox sweep failed");
  }
}
