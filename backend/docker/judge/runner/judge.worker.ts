import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { redis } from "../../../src/lib/redis.js";
import { JUDGE_QUEUE_NAME } from "./judge.queue.js";
import { DockerRunner } from "./docker.runner.ts";
import { OutputComparator } from "./output.comparator.ts";
import { JudgeService } from "./judge.service.ts";
import { ProblemRepository } from "./problem.repository.ts";
import { SubmissionRepository } from "./submission.repository.ts";
import type { SupportedLanguage } from "./runner.type.ts";

const prisma = new PrismaClient();
const runner = new DockerRunner();
const comparator = new OutputComparator();
const judgeService = new JudgeService(runner, comparator);
const problemRepository = new ProblemRepository(prisma);
const submissionRepository = new SubmissionRepository(prisma);

export const judgeWorker = new Worker(
  JUDGE_QUEUE_NAME,
  async (job) => {
    console.log(
      `[JudgeWorker] Processing job ${job.id}`,
      job.data,
    );

    const {
      submissionId,
      userId,
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

    const problem =
      await problemRepository.findById(problemId);

    if (problem.testCases.length === 0) {
      throw new Error(
        `Problem ${problemId} has no test cases`,
      );
    }

    const testCases =
      problem.testCases.map(
        (testCase) => ({
          id: testCase.id,

          stdin: testCase.input,

          expectedOutput:
            testCase.expectedOutput,

          isSample:
            testCase.isSample,
        }),
      );

    const result =
      await judgeService.judge(
        {
          language,
          sourceCode,
          stdin: "",
          timeLimitMs:
            problem.timeLimitMs,
          memoryLimitMb:
            problem.memoryLimitMb,
        },
        testCases,
      );

    await submissionRepository.createResult({
      submissionId,
      result,
    });

    console.log(
      `[JudgeWorker] Submission ${submissionId} → ${result.verdict}`,
    );

    return result;
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