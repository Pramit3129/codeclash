import type { TestCase } from "./test-case.type.ts";

export interface Problem {
  id: string;
  title: string;
  statement: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  testCases: TestCase[];
}
