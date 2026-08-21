import crypto from "node:crypto";
import { QueueEvents } from "bullmq";

import { prisma } from "../../lib/prisma.js";
import { redis } from "../../lib/redis.js";
import { logger } from "../../lib/logger.js";
import {
  AppError,
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../utils/errors.js";

import {
  RUN_QUEUE_NAME,
  runQueue,
} from "../../../docker/judge/runner/queue/run.queue.ts";
import { LANGUAGE_CONFIG } from "../../../docker/judge/runner/config/language.config.ts";
import type { SupportedLanguage } from "../../../docker/judge/runner/types/runner.type.ts";
import type {
  RunOutcome,
  RunTestCase,
} from "../../../docker/judge/runner/types/run.type.ts";

import type { RunTestCaseInput } from "./run.types.js";

const RUN_WAIT_TIMEOUT_MS = 30_000;

// Six queued runs at concurrency 1 still land inside the wait ceiling;
// deeper than that and the tail would only be waiting to time out.
const MAX_QUEUE_DEPTH = Number(process.env.RUN_MAX_QUEUE_DEPTH ?? 6);

// One in-flight run per user, so a held-down Run button can't fill the
// queue from a single account.
const INFLIGHT_TTL_SEC = 60;

/** Compare-and-delete, so a run never releases a lock it no longer owns. */
const RELEASE_IF_OWNED = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

function releaseIfOwned(key: string, token: string): Promise<unknown> {
  return redis.eval(RELEASE_IF_OWNED, 1, key, token);
}

// QueueEvents opens a blocking Redis connection: never the shared client,
// and one instance per process rather than one per request.
let queueEvents: QueueEvents | null = null;

function getQueueEvents(): QueueEvents {
  if (!queueEvents) {
    queueEvents = new QueueEvents(RUN_QUEUE_NAME, {
      connection: redis.duplicate(),
    });

    queueEvents.on("error", (error) => {
      logger.error({ err: error }, "run queue events error");
    });
  }

  return queueEvents;
}

/** Lets the HTTP server release the blocking connection on shutdown. */
export async function closeRunQueueEvents(): Promise<void> {
  if (!queueEvents) return;
  await queueEvents.close();
  queueEvents = null;
}

export class RunService {
  /** Runs user code and waits for the worker. Nothing is persisted. */
  async run({
    userId,
    problemId,
    language,
    sourceCode,
    testCases,
  }: {
    userId: string;
    problemId: string;
    language: SupportedLanguage;
    sourceCode: string;
    testCases?: RunTestCaseInput[];
  }): Promise<RunOutcome> {
    if (!sourceCode.trim()) {
      throw new BadRequestError("Source code cannot be empty");
    }

    if (!LANGUAGE_CONFIG[language]) {
      throw new BadRequestError(`Unsupported language: ${language}`);
    }

    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      select: {
        id: true,
        timeLimitMs: true,
        memoryLimitMb: true,
        testCases: {
          where: { isSample: true },
          orderBy: { ordinal: "asc" },
          select: {
            id: true,
            ordinal: true,
            input: true,
            expectedOutput: true,
          },
        },
      },
    });

    if (!problem) {
      throw new NotFoundError("Problem not found");
    }

    const resolved = this.resolveTestCases(problem.testCases, testCases);

    if (resolved.length === 0) {
      throw new BadRequestError("No test cases to run");
    }

    const runId = crypto.randomUUID();
    const inflightKey = `run:inflight:${userId}`;

    // TTL so a crashed API cannot strand a user behind their own lock.
    const acquired = await redis.set(
      inflightKey,
      runId,
      "EX",
      INFLIGHT_TTL_SEC,
      "NX",
    );

    if (acquired !== "OK") {
      throw new ConflictError("A run is already in progress");
    }

    try {
      await this.assertCapacity();

      const job = await runQueue.add("run-code", {
        runId,
        userId,
        problemId: problem.id,
        language,
        sourceCode,
        timeLimitMs: problem.timeLimitMs,
        memoryLimitMb: problem.memoryLimitMb,
        testCases: resolved,
      });

      try {
        const outcome = (await job.waitUntilFinished(
          getQueueEvents(),
          RUN_WAIT_TIMEOUT_MS,
        )) as RunOutcome;

        // Result is in hand; leaving it in Redis only costs memory.
        void job.remove().catch(() => {});

        return outcome;
      } catch (error) {
        await job.remove().catch(() => {});

        logger.error(
          { err: error, runId, problemId: problem.id, language },
          "run job did not produce a result",
        );

        // Rejects on both job failure and wait timeout, and crosses the
        // process boundary as a plain Error — so tell them apart by message.
        const timedOut = /timed out/i.test(
          error instanceof Error ? error.message : "",
        );

        throw timedOut
          ? new AppError(
              504,
              "RUN_TIMEOUT",
              "Run did not complete in time, please try again",
            )
          : new AppError(500, "RUN_FAILED", "Run failed, please try again");
      }
    } finally {
      await releaseIfOwned(inflightKey, runId).catch(() => {});
    }
  }

  /** Rejects fast when saturated, instead of queueing work that will time out. */
  private async assertCapacity(): Promise<void> {
    let waiting: number;

    try {
      waiting = await runQueue.getWaitingCount();
    } catch (error) {
      // Never fail a run because the depth probe itself broke.
      logger.warn({ err: error }, "run queue depth probe failed");
      return;
    }

    if (waiting >= MAX_QUEUE_DEPTH) {
      logger.warn({ waiting, max: MAX_QUEUE_DEPTH }, "run queue saturated");
      throw new AppError(
        503,
        "RUN_BUSY",
        "The judge is busy right now, please try again in a moment",
      );
    }
  }

  /**
   * Turns the client's list into executable cases. `isSample` and `ordinal`
   * come from the browser, so sample status is re-derived here: a case is a
   * sample only if it wasn't marked custom, it matches a stored sample (by
   * ordinal, else by input), and its input is unchanged.
   *
   * That last check is the security one — without it, `isSample: true` on a
   * hand-written input would be judged against an expected output it was
   * never meant for. Anything failing it still runs, just as a custom case
   * with no verdict and no expected output.
   *
   * An empty list means "run the samples".
   */
  private resolveTestCases(
    samples: {
      id: string;
      ordinal: number;
      input: string;
      expectedOutput: string;
    }[],
    supplied: RunTestCaseInput[] | undefined,
  ): RunTestCase[] {
    if (!supplied || supplied.length === 0) {
      return samples.map((sample) => ({
        id: sample.id,
        stdin: sample.input,
        expectedOutput: sample.expectedOutput,
        isSample: true,
      }));
    }

    const samplesByOrdinal = new Map(
      samples.map((sample) => [sample.ordinal, sample]),
    );

    // First sample wins if two share an input.
    const samplesByInput = new Map<string, (typeof samples)[number]>();
    for (const sample of samples) {
      const key = this.normalizeInput(sample.input);
      if (!samplesByInput.has(key)) samplesByInput.set(key, sample);
    }

    return supplied.map((testCase, index) => {
      const claimsCustom = testCase.isSample === false;

      const byOrdinal =
        claimsCustom || testCase.ordinal === undefined
          ? undefined
          : samplesByOrdinal.get(testCase.ordinal);

      const input = testCase.input ?? byOrdinal?.input ?? "";

      const sample =
        byOrdinal ??
        (claimsCustom
          ? undefined
          : samplesByInput.get(this.normalizeInput(input)));

      if (
        sample &&
        this.normalizeInput(sample.input) === this.normalizeInput(input)
      ) {
        return {
          id: sample.id,
          stdin: sample.input,
          expectedOutput: sample.expectedOutput,
          isSample: true,
        };
      }

      return {
        id: `custom-${index}`,
        stdin: input,
        isSample: false,
      };
    });
  }

  /**
   * Identity comparison only; the stdin fed to the program is always the
   * stored input. Absorbs the CRLF and trailing-newline drift a textarea
   * introduces on its own — inner whitespace changes stay a real edit.
   */
  private normalizeInput(value: string): string {
    return value.replace(/\r\n/g, "\n").replace(/\s+$/, "");
  }
}

export const runService = new RunService();
