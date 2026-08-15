import { PrismaClient } from "@prisma/client";

import { DockerRunner } from "../docker.runner.ts";
import { OutputComparator } from "../output.comparator.ts";
import { JudgeService } from "../judge.service.ts";
import { SubmissionService } from "../submission.service.ts";
import { SubmissionRepository } from "../submission.repository.ts";
import { ProblemRepository } from "../problem.repository.ts";

const prisma =
  new PrismaClient();

const runner =
  new DockerRunner();

const comparator =
  new OutputComparator();

const judgeService =
  new JudgeService(
    runner,
    comparator,
  );

const submissionRepository =
  new SubmissionRepository(
    prisma,
  );

const problemRepository =
  new ProblemRepository(
    prisma,
  );

const submissionService =
  new SubmissionService(
    judgeService,
    submissionRepository,
    problemRepository,
  );

const user =
  await prisma.user.findFirst();

if (!user) {
  throw new Error(
    "No user exists in database",
  );
}

const problem =
  await prisma.problem.findFirst({
    orderBy: {
      createdAt: "asc",
    },
  });

if (!problem) {
  throw new Error(
    "No problem exists in database",
  );
}

const submission =
  await submissionService.submit({
    userId: user.id,

    problemId: problem.id,

    language: "python",

    sourceCode: `
a, b = map(int, input().split())
print(a + b)
`,
  });

console.dir(
  submission,
  {
    depth: null,
  },
);

await prisma.$disconnect();