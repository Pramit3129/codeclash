import { JudgeService } from "./judge.service.ts";
import { SubmissionRepository } from "./submission.repository.ts";
import { ProblemRepository } from "./problem.repository.ts";

import type {
  SupportedLanguage,
} from "./runner.type.ts";

export class SubmissionService {
  constructor(
    private readonly judgeService: JudgeService,
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
      throw new Error(
        "Source code cannot be empty",
      );
    }

    const problem =
      await this.problemRepository.findById(
        problemId,
      );

    if (problem.testCases.length === 0) {
      throw new Error(
        "Problem has no test cases",
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
      await this.judgeService.judge(
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

    return this.submissionRepository.create({
      userId,
      problemId,
      language,
      sourceCode,
      result,
    });
  }
}