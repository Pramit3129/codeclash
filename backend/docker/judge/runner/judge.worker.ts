import { Worker } from "bullmq";
import { redis } from "../../../src/lib/redis.js";
import { JUDGE_QUEUE_NAME } from "./judge.queue.js";

export const judgeWorker =
    new Worker(
        JUDGE_QUEUE_NAME,
        async (job) => {
            console.log(
                `[JudgeWorker] Processing job ${job.id}`,
                job.data,
            );

            // Judge execution will be added here
            // in the next step.
        },
        {
            connection: redis,

            concurrency: 1,
        },
    );

judgeWorker.on("completed", (job) => {
    console.log(
        `[JudgeWorker] Completed job ${job.id}`,
    );
});

judgeWorker.on("failed", (job, error) => {
    console.error(
        `[JudgeWorker] Failed job ${job?.id}`,
        error,
    );
});

judgeWorker.on("error", (error) => {
    console.error(
        "[JudgeWorker] Worker error",
        error,
    );
});