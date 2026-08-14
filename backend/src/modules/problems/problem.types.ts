import type { Prisma } from "@prisma/client";
import { z } from "zod"
export const problemListSelect = {
  id: true,
  slug: true,
  title: true,
  difficulty: true,
} satisfies Prisma.ProblemSelect;


export interface problemSelect {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
}

export interface FetchProblemsResponse {
  items: problemSelect[];
  nextCursor: string | null;
}

export const problemDetailSelect = {
  id: true,
  slug: true,
  title: true,
  statementMd: true,
  constraintsMd: true,
  difficulty: true,
  timeLimitMs: true,
  memoryLimitMb: true,
  starterCode: true,

  testCases: {
    where: {
      isSample: true,
    },

    select: {
      ordinal: true,
      input: true,
      expectedOutput: true,
    },

    orderBy: {
      ordinal: "asc",
    },
  },
} satisfies Prisma.ProblemSelect;

export interface TestCaseType {
  ordinal: number;
  input: string;
  expectedOutput: string;
}

export interface ProblemDetailType {
  id: string;
  slug: string;
  title: string;
  statementMd: string;
  constraintsMd: string | null;
  difficulty: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  starterCode: any;
  testCases: TestCaseType[];
}

export interface problemDetailsResponse {
  id: string;
  slug: string;
  title: string;
  statementMd: string;
  constraintsMd: string | null;
  difficulty: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  starterCode: any;
  testCases: TestCaseType[];
}
export const fetchProblemsSchema = z.object({
    limit: z.coerce
        .number()
        .min(1)
        .max(50)
        .default(20),
    cursor: z.string().optional(),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
});


export const getProblemDetailSchema = z.object({
    slug: z.string(),
});