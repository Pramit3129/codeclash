/**
 * Idempotency regression: replaying a judge job must not duplicate rows.
 *
 * Exercises the real SubmissionRepository against a real PostgreSQL
 * database — not a mock — because the mechanism under test IS the
 * database write: an upsert against @@unique([submissionId, testCaseId])
 * inside a transaction. A mocked repository would prove nothing.
 *
 * Why this matters: BullMQ redelivers a job after a worker stall or
 * crash (verified in production: a SIGKILLed worker's job was replayed
 * ~70s later). The original nested `create` would have hit the unique
 * constraint on that second run and failed the job permanently.
 *
 * ISOLATION: requires an explicit JUDGE_TEST_DATABASE_URL. It never
 * falls back to DATABASE_URL, so it cannot touch production data, and
 * it refuses to run against a URL that looks like a managed host.
 *
 *   docker run -d --name judge-test-db -e POSTGRES_USER=judge \
 *     -e POSTGRES_PASSWORD=judge -e POSTGRES_DB=judge -p 55433:5432 postgres:16-alpine
 *   export JUDGE_TEST_DATABASE_URL=postgresql://judge:judge@localhost:55433/judge
 *   DATABASE_URL=$JUDGE_TEST_DATABASE_URL bunx prisma migrate deploy
 *   bun test ./docker/judge/runner/tests/idempotency.test.ts
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { PrismaClient } from "@prisma/client";

import { SubmissionRepository } from "../submission.repository.ts";
import type { JudgeResult, TestResult } from "../verdict.types.ts";

const TEST_DATABASE_URL = process.env.JUDGE_TEST_DATABASE_URL;

/*
 * Refuse anything that looks like a hosted/production database, even if
 * someone points the variable at one by mistake.
 */
const looksManaged =
  !!TEST_DATABASE_URL &&
  /neon\.tech|rds\.amazonaws|supabase|railway|render\.com|planetscale/i.test(
    TEST_DATABASE_URL,
  );

if (TEST_DATABASE_URL && looksManaged) {
  throw new Error(
    "JUDGE_TEST_DATABASE_URL points at what looks like a managed/production database; refusing to run destructive tests.",
  );
}

const enabled = !!TEST_DATABASE_URL && !looksManaged;

if (!enabled) {
  console.warn(
    "[idempotency] SKIPPED - set JUDGE_TEST_DATABASE_URL to a throwaway database to run (see file header).",
  );
}

const prisma = enabled
  ? new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } })
  : null;

const repo = enabled ? new SubmissionRepository(prisma!) : null;

/** Unique per run so repeated runs never collide. */
const RUN = `idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

let problemId: string;
let userId: string;
let testCaseIds: string[] = [];

beforeAll(async () => {
  if (!enabled) return;

  const user = await prisma!.user.create({
    data: { username: `${RUN}-user`, displayName: "Idempotency", role: "USER" },
  });
  userId = user.id;

  const problem = await prisma!.problem.create({
    data: {
      slug: `${RUN}-problem`,
      title: "Idempotency Fixture",
      statementMd: "fixture",
      constraintsMd: "fixture",
      difficulty: "EASY",
      timeLimitMs: 1000,
      memoryLimitMb: 256,
      starterCode: {},
      testCases: {
        create: [0, 1, 2, 3, 4].map((i) => ({
          ordinal: i,
          input: `${i} ${i}\n`,
          expectedOutput: `${i * 2}\n`,
          isSample: i === 0,
        })),
      },
    },
    include: { testCases: { orderBy: { ordinal: "asc" } } },
  });

  problemId = problem.id;
  testCaseIds = problem.testCases.map((t) => t.id);
});

afterAll(async () => {
  if (!enabled) return;

  // Cascades to submissions and their test results.
  await prisma!.problem.deleteMany({ where: { slug: `${RUN}-problem` } });
  await prisma!.user.deleteMany({ where: { username: `${RUN}-user` } });
  await prisma!.$disconnect();
});

async function newSubmission() {
  return repo!.createQueued({
    userId,
    problemId,
    language: "python",
    sourceCode: "a, b = map(int, input().split())\nprint(a + b)",
    totalTestCases: testCaseIds.length,
  });
}

function acResult(count = testCaseIds.length): JudgeResult {
  const testResults: TestResult[] = testCaseIds.slice(0, count).map((id, i) => ({
    testCaseId: id,
    verdict: "AC",
    stdout: `${i * 2}\n`,
    stderr: "",
    exitCode: 0,
    executionTimeMs: 12.5,
  }));

  return {
    verdict: "AC",
    passedTestCases: count,
    totalTestCases: testCaseIds.length,
    failedTestCaseId: null,
    executionTimeMs: 100,
    testResults,
  };
}

const rowsFor = (submissionId: string) =>
  prisma!.submissionTestResult.findMany({ where: { submissionId } });

describe.skipIf(!enabled)("createResult idempotency", () => {
  test("replaying the identical result creates no duplicate rows", async () => {
    const sub = await newSubmission();
    expect(sub.status).toBe("QUEUED");

    await repo!.markRunning(sub.id);
    await repo!.createResult({ submissionId: sub.id, result: acResult() });

    const first = await rowsFor(sub.id);
    expect(first).toHaveLength(5);

    // The replay a BullMQ retry would perform.
    await repo!.markRunning(sub.id);
    await repo!.createResult({ submissionId: sub.id, result: acResult() });

    const second = await rowsFor(sub.id);
    expect(second).toHaveLength(5);

    const unique = new Set(second.map((r) => r.testCaseId));
    expect(unique.size).toBe(second.length);

    const final = await prisma!.submission.findUnique({ where: { id: sub.id } });
    expect(final!.status).toBe("COMPLETED");
    expect(final!.verdict).toBe("AC");
    expect(final!.passedTestCases).toBe(5);
    expect(final!.totalTestCases).toBe(5);
    expect(final!.failureReason).toBeNull();
  });

  test("three replays still yield exactly one row per test case", async () => {
    const sub = await newSubmission();

    for (let i = 0; i < 3; i++) {
      await repo!.createResult({ submissionId: sub.id, result: acResult() });
    }

    const rows = await rowsFor(sub.id);
    expect(rows).toHaveLength(5);
    expect(new Set(rows.map((r) => r.testCaseId)).size).toBe(5);
  });

  test("a replay updates row content in place rather than appending", async () => {
    const sub = await newSubmission();

    await repo!.createResult({ submissionId: sub.id, result: acResult() });

    const changed = acResult();
    changed.testResults[0]!.stdout = "REPLAYED\n";
    changed.testResults[0]!.executionTimeMs = 999;

    await repo!.createResult({ submissionId: sub.id, result: changed });

    const rows = await rowsFor(sub.id);
    expect(rows).toHaveLength(5);

    const updated = rows.find((r) => r.testCaseId === testCaseIds[0]);
    expect(updated!.stdout).toBe("REPLAYED\n");
    expect(updated!.executionTimeMs).toBe(999);
  });

  test("a shorter replay drops stale rows from the longer first run", async () => {
    const sub = await newSubmission();

    // First run judged all five cases.
    await repo!.createResult({ submissionId: sub.id, result: acResult(5) });
    expect(await rowsFor(sub.id)).toHaveLength(5);

    /*
     * Replay fails on case 2, so judging stops early. The persisted rows
     * must match THIS run, not a mixture of both.
     */
    const shorter: JudgeResult = {
      verdict: "WA",
      passedTestCases: 1,
      totalTestCases: 5,
      failedTestCaseId: testCaseIds[1]!,
      executionTimeMs: 40,
      testResults: [
        { testCaseId: testCaseIds[0]!, verdict: "AC", stdout: "0\n", stderr: "", exitCode: 0, executionTimeMs: 10 },
        { testCaseId: testCaseIds[1]!, verdict: "WA", stdout: "x\n", stderr: "", exitCode: 0, executionTimeMs: 10 },
      ],
    };

    await repo!.createResult({ submissionId: sub.id, result: shorter });

    const rows = await rowsFor(sub.id);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.testCaseId))).toEqual(
      new Set([testCaseIds[0]!, testCaseIds[1]!]),
    );

    const final = await prisma!.submission.findUnique({ where: { id: sub.id } });
    expect(final!.verdict).toBe("WA");
    expect(final!.status).toBe("COMPLETED");
    expect(final!.failedTestCaseId).toBe(testCaseIds[1]!);
  });

  test("a CE replay (zero test results) persists no rows and stays CE", async () => {
    const sub = await newSubmission();

    const ce: JudgeResult = {
      verdict: "CE",
      passedTestCases: 0,
      totalTestCases: 5,
      failedTestCaseId: null,
      executionTimeMs: 30,
      testResults: [],
    };

    await repo!.createResult({ submissionId: sub.id, result: ce });
    await repo!.createResult({ submissionId: sub.id, result: ce });

    expect(await rowsFor(sub.id)).toHaveLength(0);

    const final = await prisma!.submission.findUnique({ where: { id: sub.id } });
    expect(final!.verdict).toBe("CE");
    expect(final!.status).toBe("COMPLETED");
  });

  test("concurrent replays of the same submission do not duplicate rows", async () => {
    const sub = await newSubmission();

    const outcomes = await Promise.allSettled([
      repo!.createResult({ submissionId: sub.id, result: acResult() }),
      repo!.createResult({ submissionId: sub.id, result: acResult() }),
    ]);

    /*
     * One may lose a write conflict; what must never happen is duplicate
     * rows or a half-written submission.
     */
    expect(outcomes.some((o) => o.status === "fulfilled")).toBe(true);

    const rows = await rowsFor(sub.id);
    expect(new Set(rows.map((r) => r.testCaseId)).size).toBe(rows.length);
    expect(rows.length).toBeLessThanOrEqual(5);

    const final = await prisma!.submission.findUnique({ where: { id: sub.id } });
    expect(["QUEUED", "COMPLETED"]).toContain(final!.status);
  });

  test("markFailed records a terminal infrastructure failure, not a verdict", async () => {
    const sub = await newSubmission();

    await repo!.markRunning(sub.id);
    await repo!.markFailed({ submissionId: sub.id, reason: "Docker unavailable" });

    const final = await prisma!.submission.findUnique({ where: { id: sub.id } });
    expect(final!.status).toBe("FAILED");
    expect(final!.verdict).toBeNull();
    expect(final!.failureReason).toBe("Docker unavailable");
  });

  test("markFailed truncates an unbounded reason", async () => {
    const sub = await newSubmission();

    await repo!.markFailed({ submissionId: sub.id, reason: "x".repeat(5000) });

    const final = await prisma!.submission.findUnique({ where: { id: sub.id } });
    expect(final!.failureReason!.length).toBe(500);
  });

  test("a successful replay after a failure restores a correct verdict", async () => {
    const sub = await newSubmission();

    await repo!.markFailed({ submissionId: sub.id, reason: "transient" });
    await repo!.createResult({ submissionId: sub.id, result: acResult() });

    const final = await prisma!.submission.findUnique({ where: { id: sub.id } });
    expect(final!.status).toBe("COMPLETED");
    expect(final!.verdict).toBe("AC");
    expect(await rowsFor(sub.id)).toHaveLength(5);
  });
});
