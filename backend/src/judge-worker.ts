import {
  judgeWorker,
  reapOnStartup,
  shutdownJudgeWorker,
} from "../docker/judge/runner/judge.worker.ts";
import { redis } from "./lib/redis.ts";
import { logger } from "./lib/logger.ts";

/**
 * Hard deadline for a graceful stop. Orchestrators send SIGKILL not long
 * after SIGTERM, so we must finish well inside that window; exiting late
 * is what leaks sandbox containers during a deploy.
 */
const SHUTDOWN_TIMEOUT_MS = 30_000;

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    logger.warn({ signal }, "shutdown already in progress");
    return;
  }

  shuttingDown = true;
  logger.info({ signal }, "judge worker shutting down");

  const deadline = setTimeout(() => {
    logger.error(
      { signal, timeoutMs: SHUTDOWN_TIMEOUT_MS },
      "graceful shutdown timed out, exiting",
    );

    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  /*
   * Do not hold the process open purely for the deadline timer.
   */
  deadline.unref();

  try {
    await shutdownJudgeWorker();
    await redis.quit();

    clearTimeout(deadline);
    logger.info({ signal }, "judge worker stopped cleanly");
    process.exit(0);
  } catch (error) {
    clearTimeout(deadline);
    logger.error({ signal, err: error }, "error during shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

/*
 * A crashed worker must not silently keep consuming jobs in a bad state:
 * log loudly and let the orchestrator restart us, at which point the
 * startup reaper cleans up whatever the crash left behind.
 */
process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "uncaught exception in judge worker");
  void shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "unhandled rejection in judge worker");
  void shutdown("unhandledRejection");
});

void (async () => {
  await reapOnStartup();

  logger.info(
    { concurrency: judgeWorker.opts.concurrency },
    "judge worker ready",
  );
})();
