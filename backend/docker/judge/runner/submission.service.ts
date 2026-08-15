import { ProblemRepository } from "./problem.repository.ts";
import { SubmissionRepository } from "./submission.repository.ts";
import { judgeQueue } from "./judge.queue.ts";

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
      throw new Error("Source code cannot be empty");
    }

    const problem =
      await this.problemRepository.findById(problemId);

    if (problem.testCases.length === 0) {
      throw new Error("Problem has no test cases");
    }

    const submission =
      await this.submissionRepository.createQueued({
        userId,
        problemId,
        language,
        sourceCode,
        totalTestCases: problem.testCases.length,
      });

    await judgeQueue.add("judge-submission", {
      submissionId: submission.id,
      userId,
      problemId,
      language,
      sourceCode,
    });

    return submission;
  }
}