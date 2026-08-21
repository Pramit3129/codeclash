import { ProblemRepository } from "../repositories/problem.repository.ts";
import { SubmissionRepository } from "../repositories/submission.repository.ts";
import { judgeQueue } from "../queue/judge.queue.ts";
import { LANGUAGE_CONFIG } from "../config/language.config.ts";
import { BadRequestError } from "../../../../src/utils/errors.js";

import type { SupportedLanguage } from "../types/runner.type.ts";

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

    if (!LANGUAGE_CONFIG[language]) {
      throw new BadRequestError(`Unsupported language: ${language}`);
    }

    const problem = await this.problemRepository.findById(problemId);

    if (problem.testCases.length === 0) {
      throw new BadRequestError("Problem has no test cases");
    }

    const submission = await this.submissionRepository.createQueued({
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
      await this.submissionRepository
        .markFailed({
          submissionId: submission.id,
          reason: "Failed to enqueue judge job",
        })
        .catch(() => {});

      throw error;
    }

    return submission;
  }
}
