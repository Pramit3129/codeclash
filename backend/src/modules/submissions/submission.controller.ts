import type { Request, Response } from "express";

import { prisma } from "../../lib/prisma.js";

import { BadRequestError } from "../../utils/errors.js";

import {
  createSubmissionSchema,
  submissionIdSchema,
} from "./submission.types.js";

import { SubmissionService } from "../../../docker/judge/runner/submission.service.ts";
import { ProblemRepository } from "../../../docker/judge/runner/problem.repository.ts";

import { SubmissionRepository } from "../../../docker/judge/runner/submission.repository.ts";

import type { SupportedLanguage } from "../../../docker/judge/runner/runner.type.ts";

const getSubmissionService = () => {
  const problemRepository =
    new ProblemRepository(prisma);

  const submissionRepository =
    new SubmissionRepository(prisma);

  return new SubmissionService(
    submissionRepository,
    problemRepository,
  );
};

export const createSubmission = async (
  req: Request,
  res: Response,
) => {
  const submissionService = getSubmissionService();

  const result =
    createSubmissionSchema.safeParse(
      req.body,
    );

  if (!result.success) {
    throw new BadRequestError(
      "Invalid submission",
      {
        details:
          result.error.flatten().fieldErrors,
      },
    );
  }

  const userId = req.auth!.userId;

  const submission =
    await submissionService.submit({
      userId,
      problemId: result.data.problemId,
      language:
        result.data.language as SupportedLanguage,
      sourceCode:
        result.data.sourceCode,
    });

  return res.status(202).json({
    success: true,
    submission: {
      id: submission.id,
      status: submission.status,
      verdict: submission.verdict,
      totalTestCases:
        submission.totalTestCases,
      passedTestCases:
        submission.passedTestCases,
      createdAt:
        submission.createdAt,
    },
  });
};

export const getSubmission = async (
  req: Request,
  res: Response,
) => {
  const result =
    submissionIdSchema.safeParse(
      req.params,
    );

  if (!result.success) {
    throw new BadRequestError(
      "Invalid submission ID",
      {
        details:
          result.error.flatten().fieldErrors,
      },
    );
  }

  const submission =
    await prisma.submission.findUnique({
      where: {
        id: result.data.id,
      },
      include: {
        testResults: true,
      },
    });

  if (!submission) {
    return res.status(404).json({
      success: false,
      message: "Submission not found",
    });
  }

  // Users may only inspect their own submissions.
  if (submission.userId !== req.auth!.userId) {

    return res.status(404).json({
      success: false,
      message: "Submission not found",
    });
  }

  return res.status(200).json({
    success: true,
    submission,
  });
};
