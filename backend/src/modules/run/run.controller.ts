import type { Request, Response } from "express";

import { BadRequestError } from "../../utils/errors.js";
import { createRunSchema } from "./run.types.js";
import { runService } from "./run.service.ts";

export const createRun = async (req: Request, res: Response) => {
  const result = createRunSchema.safeParse(req.body);

  if (!result.success) {
    throw new BadRequestError("Invalid run request", {
      details: result.error.flatten().fieldErrors,
    });
  }

  const outcome = await runService.run({
    userId: req.auth!.userId,
    problemId: result.data.problemId,
    language: result.data.language,
    sourceCode: result.data.sourceCode,
    testCases: result.data.testCases,
  });

  return res.status(200).json({
    success: true,
    run: outcome,
  });
};
