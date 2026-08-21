import { Worker, UnrecoverableError } from "bullmq";
import { redis } from "../../../../src/lib/redis.js";
import { logger } from "../../../../src/lib/logger.js";
import { RUN_QUEUE_NAME } from "./run.queue.ts";
import { DockerRunner } from "../utils/docker.runner.ts";
import { OutputComparator } from "../utils/output.comparator.ts";
import { RunService } from "../services/run.service.ts";
import { LANGUAGE_CONFIG } from "../config/language.config.ts";
import { resolveConcurrency } from "../utils/judge.concurrency.ts";
import type { RunJobData } from "../types/run.type.ts";

const RUN_MAX_STORED_OUTPUT_BYTES = 32 * 1024;

const runner = new DockerRunner();
const comparator = new OutputComparator();
const runService = new RunService(runner, comparator);

const RUN_CONCURRENCY = resolveConcurrency(
  process.env.RUN_CONCURRENCY,
  (suppliedValue) => {
    logger.warn(
      { RUN_CONCURRENCY: suppliedValue },
      "invalid RUN_CONCURRENCY, falling back to 1",
    );
  },
);

export const runWorker = new Worker(
  RUN_QUEUE_NAME,
  async (job) => {
    const data = job.data as RunJobData;

    logger.info(
      {
        jobId: job.id,
        runId: data.runId,
        problemId: data.problemId,
        language: data.language,
        testCases: data.testCases.length,
      },
      "run job started",
    );

    if (!LANGUAGE_CONFIG[data.language]) {
      throw new UnrecoverableError(`Unsupported language: ${data.language}`);
    }

    if (data.testCases.length === 0) {
      throw new UnrecoverableError("Run has no test cases");
    }

    const outcome = await runService.run(
      {
        language: data.language,
        sourceCode: data.sourceCode,
        stdin: "",
        timeLimitMs: data.timeLimitMs,
        memoryLimitMb: data.memoryLimitMb,
        // Reading the output is the point of a run: keep more than the judge.
        maxStoredOutputBytes: RUN_MAX_STORED_OUTPUT_BYTES,
      },
      data.testCases,
    );

    logger.info(
      {
        jobId: job.id,
        runId: data.runId,
        status: outcome.status,
        passedSampleCases: outcome.passedSampleCases,
        totalSampleCases: outcome.totalSampleCases,
        executionTimeMs: Math.round(outcome.executionTimeMs),
      },
      "run job completed",
    );

    return outcome;
  },
  {
    connection: redis,
    concurrency: RUN_CONCURRENCY,
    stalledInterval: 60_000,
    maxStalledCount: 1,
  },
);

runWorker.on("failed", (job, error) => {
  logger.error(
    {
      jobId: job?.id,
      runId: (job?.data as RunJobData | undefined)?.runId,
      err: { name: error?.name, message: error?.message },
    },
    "run job failed",
  );
});

runWorker.on("error", (error) => {
  logger.error({ err: error }, "run worker error");
});

export async function shutdownRunWorker(): Promise<void> {
  await runWorker.close();
}
