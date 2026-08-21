import type { Request, Response } from "express";

import { prisma } from "../../lib/prisma.js";

import { BadRequestError } from "../../utils/errors.js";
import { createSubscriber } from "../../lib/redis.ts";

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

  const submission = await prisma.submission.findUnique({
    where: {
      id: result.data.id,
    },
    include: {
      testResults: true,
    },
  });

  if (!submission || submission.userId !== req.auth!.userId) {
    return res.status(404).json({
      success: false,
      message: "Submission not found",
    });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  res.flushHeaders();

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Submission already finished before SSE connection opened.
  if (
    submission.status === "COMPLETED" ||
    submission.status === "FAILED"
  ) {
    sendEvent("VERDICT", submission);
    return res.end();
  }

  const subscriber = createSubscriber();
  const channel = `submission:${submission.id}`;

  let closed = false;

  const cleanup = async () => {
    if (closed) return;

    closed = true;

    try {
      await subscriber.unsubscribe(channel);
      await subscriber.quit();
    } catch {
      subscriber.disconnect();
    }
  };

  const heartbeat = setInterval(() => {
    if (!closed) {
      res.write(": heartbeat\n\n");
    }
  }, 15_000);

  req.on("close", async () => {
    clearInterval(heartbeat);
    await cleanup();
  });

  await subscriber.subscribe(channel);

  subscriber.on("message", async (_channel, message) => {
    if (closed) return;

    try {
      const payload = JSON.parse(message);

      sendEvent(payload.event, payload.result);

      if (payload.event === "VERDICT") {
        clearInterval(heartbeat);
        await cleanup();
        res.end();
      }
    } catch (error) {
      console.error("SSE message handling failed:", error);
    }
  });

  // Re-check after subscribing to avoid the
  // DB-check → Redis-subscribe race.
  const currentSubmission = await prisma.submission.findUnique({
    where: {
      id: submission.id,
    },
    select: {
      status: true,
    },
  });

  if (
    currentSubmission?.status === "COMPLETED" ||
    currentSubmission?.status === "FAILED"
  ) {
    const finalSubmission = await prisma.submission.findUnique({
      where: {
        id: submission.id,
      },
      include: {
        testResults: true,
      },
    });

    if (finalSubmission) {
      sendEvent("VERDICT", finalSubmission);
    }

    clearInterval(heartbeat);
    await cleanup();
    return res.end();
  }
};
