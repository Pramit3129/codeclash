import { env } from "./config/env.js";
import { app } from "./app.js";
import { logger } from "./lib/logger.js";
import { connectRedis } from "./lib/redis.js";
import { closeRunQueueEvents } from "./modules/run/run.service.js";

const server = app.listen(env.PORT, "0.0.0.0", async () => {
  await connectRedis();
  logger.info(`Server started on port ${env.PORT} in ${env.NODE_ENV} mode`);
});

const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}. Closing HTTP server...`);
  server.close(async () => {
    // Blocking Redis connection: unclosed, it stretches every deploy.
    await closeRunQueueEvents().catch((err) =>
      logger.error({ err }, "failed to close run queue events"),
    );

    logger.info("HTTP server closed.");
    process.exit(0);
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
