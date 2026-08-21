import { Worker, UnrecoverableError } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { redis } from "../../../../src/lib/redis.js";
import { logger } from "../../../../src/lib/logger.js";
import { JUDGE_QUEUE_NAME } from "./judge.queue.ts";
import { DockerRunner } from "../utils/docker.runner.ts";
import { OutputComparator } from "../utils/output.comparator.ts";
import { JudgeService } from "../services/judge.service.ts";
import { ProblemRepository } from "../repositories/problem.repository.ts";
import { SubmissionRepository } from "../repositories/submission.repository.ts";
import { LANGUAGE_CONFIG } from "../config/language.config.ts";
import { resolveConcurrency } from "../utils/judge.concurrency.ts";
import type { SupportedLanguage } from "../types/runner.type.ts";
import { publishEvent } from "../pub-sub/publisher.ts";

const prisma = new PrismaClient();
const runner = new DockerRunner();
const comparator = new OutputComparator();
const judgeService = new JudgeService(runner, comparator);
const problemRepository = new ProblemRepository(prisma);
const submissionRepository = new SubmissionRepository(prisma);

const JUDGE_CONCURRENCY = resolveConcurrency(
  process.env.JUDGE_CONCURRENCY,
  (suppliedValue) => {
    logger.warn(
      { JUDGE_CONCURRENCY: suppliedValue },
      "invalid JUDGE_CONCURRENCY, falling back to 1",
    );
  },
);

class InfrastructureError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "InfrastructureError";
  }
}

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
    const { submissionId, problemId, language, sourceCode } = job.data as {
      submissionId: string;
      userId: string;
      problemId: string;
      language: SupportedLanguage;
      sourceCode: string;
    };

    logger.info(jobContext(job), "judge job started");

    if (!LANGUAGE_CONFIG[language]) {
      throw new UnrecoverableError(`Unsupported language: ${language}`);
    }

    let problem;
    try {
      problem = await problemRepository.findById(problemId);
    } catch (error) {
      throw new InfrastructureError("Failed to load problem", { cause: error });
    }

    if (problem.testCases.length === 0) {
      throw new UnrecoverableError(`Problem ${problemId} has no test cases`);
    }

    await submissionRepository.markRunning(submissionId);

    const testCases = problem.testCases.map((tc) => ({
      id: tc.id,
      stdin: tc.input,
      expectedOutput: tc.expectedOutput,
      isSample: tc.isSample,
    }));

    let result;
    try {
      result = await judgeService.judge(
        submissionId,
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
      throw new InfrastructureError("Judge execution failed", { cause: error });
    }

    try {
      await submissionRepository.createResult({
        submissionId,
        result,
      });
      await publishEvent(1, submissionId, result);
    } catch (error) {
      throw new InfrastructureError("Failed to persist judge result", { cause: error });
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
    stalledInterval: 60_000,
    maxStalledCount: 2,
  },
);

judgeWorker.on("failed", async (job, error) => {
  const context = job ? jobContext(job) : {};
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

  if (!job) return;

  const attemptsAllowed = job.opts.attempts ?? 1;
  const exhausted =
    error instanceof UnrecoverableError ||
    error?.name === "UnrecoverableError" ||
    job.attemptsMade >= attemptsAllowed;

  if (!exhausted) return;

  const { submissionId } = job.data as { submissionId?: string };
  if (!submissionId) return;

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

  const STRANDED_AFTER_MS = 15 * 60_000;

  try {
    const stranded = await submissionRepository.failStrandedRunning({
      olderThanMs: STRANDED_AFTER_MS,
    });
    if (stranded > 0) {
      logger.warn(
        { count: stranded },
        "marked stranded RUNNING submissions as FAILED",
      );
    }
  } catch (error) {
    logger.error({ err: error }, "stranded submission sweep failed");
  }
}

export async function shutdownJudgeWorker(): Promise<void> {
  await judgeWorker.close();

  try {
    await prisma.$disconnect();
  } catch (error) {
    logger.error({ err: error }, "prisma disconnect failed");
  }

  try {
    await runner.reapOrphanedSandboxes();
  } catch (error) {
    logger.error({ err: error }, "shutdown sandbox sweep failed");
  }
}
