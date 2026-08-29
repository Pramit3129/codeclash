import type { Request, Response } from "express";
import { BadRequestError } from "../../utils/errors.js";
import {
  createSubmissionSchema,
  problemIdSchema,
  submissionIdSchema,
} from "./submission.types.js";
import { submissionService } from "./submission.service.ts";
import type { SupportedLanguage } from "../../../docker/judge/runner/types/runner.type.ts";

export const createSubmission = async (
  req: Request,
  res: Response,
) => {
  const result = createSubmissionSchema.safeParse(req.body);

  if (!result.success) {
    throw new BadRequestError("Invalid submission", {
      details: result.error.flatten().fieldErrors,
    });
  }

  const userId = req.auth!.userId;

  const submission = await submissionService.createSubmission({
    userId,
    problemId: result.data.problemId,
    language: result.data.language as SupportedLanguage,
    sourceCode: result.data.sourceCode,
  });

  return res.status(202).json({
    success: true,
    submission: {
      id: submission.id,
      status: submission.status,
      verdict: submission.verdict,
      totalTestCases: submission.totalTestCases,
      passedTestCases: submission.passedTestCases,
      createdAt: submission.createdAt,
    },
  });
};

export const getSubmission = async (
  req: Request,
  res: Response,
) => {
  const result = submissionIdSchema.safeParse(req.params);

  if (!result.success) {
    throw new BadRequestError("Invalid submission ID", {
      details: result.error.flatten().fieldErrors,
    });
  }

  const submission = await submissionService.getSubmissionById(
    result.data.id,
    req.auth!.userId,
  );

  return res.status(200).json({
    success: true,
    submission,
  });
};

export const streamSubmission = async (
  req: Request,
  res: Response,
) => {
  const result = submissionIdSchema.safeParse(req.params);

  if (!result.success) {
    throw new BadRequestError("Invalid submission ID", {
      details: result.error.flatten().fieldErrors,
    });
  }

  await submissionService.streamSubmission(
    result.data.id,
    req.auth!.userId,
    req,
    res,
  );
};

export const getSubmissions = async (req: Request, res: Response) => {
  const user = req.auth?.userId;
  const result = problemIdSchema.safeParse(req.params);

  if (!result.success) {
    throw new BadRequestError("Invalid Problem ID", {
      details: result.error.flatten().fieldErrors,
    });
  }

  const submissions = await submissionService.getUserSubmissions(
    req.auth!.userId,
    result.data.problemId,
  );

  return res.status(200).json({
    success: true,
    submissions,
  });
}
