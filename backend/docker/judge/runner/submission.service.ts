import { ProblemRepository } from "./problem.repository.ts";
import { SubmissionRepository } from "./submission.repository.ts";
import { judgeQueue } from "./judge.queue.ts";
import { LANGUAGE_CONFIG } from "./language.config.ts";
import { BadRequestError } from "../../../src/utils/errors.js";

import type { SupportedLanguage } from "./runner.type.ts";

export class SubmissionService {
  constructor(
    private readonly submissionRepository: SubmissionRepository,
    private readonly problemRepository: ProblemRepository,
  ) {}

  async submit({
    userId,
    problemId,
    language,
    sourceCode,
  }: {
    userId: string;
    problemId: string;
    language: SupportedLanguage;
    sourceCode: string;
  }) {
    if (!sourceCode.trim()) {
      throw new BadRequestError("Source code cannot be empty");
    }

    /*
     * Every Docker parameter is derived server-side: the image and
     * commands come from LANGUAGE_CONFIG keyed by the validated
     * language, and the limits come from the problem row. Nothing in
     * the request body reaches the Docker CLI.
     */
    if (!LANGUAGE_CONFIG[language]) {
      throw new BadRequestError(
        `Unsupported language: ${language}`,
      );
    }

    const problem =
      await this.problemRepository.findById(problemId);

    if (problem.testCases.length === 0) {
      throw new BadRequestError(
        "Problem has no test cases",
      );
    }

    const submission =
      await this.submissionRepository.createQueued({
        userId,
        problemId,
        language,
        sourceCode,
        totalTestCases: problem.testCases.length,
      });

    try {
      await judgeQueue.add("judge-submission", {
        submissionId: submission.id,
        userId,
        problemId,
        language,
        sourceCode,
      });
    } catch (error) {
      /*
       * The row exists but nothing will ever pick it up. Move it to a
       * terminal state rather than leaving it QUEUED forever.
       */
      await this.submissionRepository
        .markFailed({
          submissionId: submission.id,
          reason: "Failed to enqueue judge job",
        })
        .catch(() => {
          /* The original error below is the useful one. */
        });

      throw error;
    }

    return submission;
  }
}