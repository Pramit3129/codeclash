import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { createSubscriber } from "../../lib/redis.ts";
import { NotFoundError } from "../../utils/errors.js";

import { SubmissionService as RunnerSubmissionService } from "../../../docker/judge/runner/services/submission.service.ts";
import { ProblemRepository } from "../../../docker/judge/runner/repositories/problem.repository.ts";
import { SubmissionRepository } from "../../../docker/judge/runner/repositories/submission.repository.ts";
import type { SupportedLanguage } from "../../../docker/judge/runner/types/runner.type.ts";
import { tr } from "zod/locales";

export class SubmissionService {
  private getRunnerService() {
    const problemRepository = new ProblemRepository(prisma);
    const submissionRepository = new SubmissionRepository(prisma);
    return new RunnerSubmissionService(submissionRepository, problemRepository);
  }

  async createSubmission({
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
    const runnerService = this.getRunnerService();
    return runnerService.submit({
      userId,
      problemId,
      language,
      sourceCode,
    });
  }

  async getSubmissionById(id: string, userId: string) {
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        testResults: true,
      },
    });

    if (!submission || submission.userId !== userId) {
      throw new NotFoundError("Submission not found");
    }

    return submission;
  }

  async streamSubmission(id: string, userId: string, req: Request, res: Response) {
    const submission = await this.getSubmissionById(id, userId);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const sendEvent = (event: string, data: unknown) => {
      res.write(
        `data: ${JSON.stringify({
          event,
          data,
        })}\n\n`,
      );
      if (typeof (res as any).flush === "function") {
        (res as any).flush();
      }
    };

    // If submission is already finished before SSE connection opens
    if (submission.status === "COMPLETED" || submission.status === "FAILED") {
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

    // Re-check status after subscribing to prevent DB-check -> Redis-subscribe race condition
    const currentSubmission = await prisma.submission.findUnique({
      where: { id: submission.id },
      select: { status: true },
    });

    if (
      currentSubmission?.status === "COMPLETED" ||
      currentSubmission?.status === "FAILED"
    ) {
      const finalSubmission = await prisma.submission.findUnique({
        where: { id: submission.id },
        include: { testResults: true },
      });

      if (finalSubmission) {
        sendEvent("VERDICT", finalSubmission);
      }

      clearInterval(heartbeat);
      await cleanup();
      return res.end();
    }
  }
  async getUserSubmissions(userId: string, problemId: string) {
    const submissions = await prisma.submission.findMany({
      where: {
        userId,
        problemId
      },
      select:{
        passedTestCases:true,
        totalTestCases:true,
        verdict: true,
        createdAt: true,
        language: true,
        id: true,
        failureReason: true,
        status: true,
        executionTimeMs: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })
    return submissions;
  }
}

export const submissionService = new SubmissionService();
