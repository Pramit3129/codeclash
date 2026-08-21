import { DockerRunner } from "../utils/docker.runner.ts";
import { OutputComparator } from "../utils/output.comparator.ts";
import { JudgeService } from "../services/judge.service.ts";
import type { TestCase } from "../types/test-case.type.ts";
import type { Problem } from "../types/problem.type.ts";

const runner = new DockerRunner();
const comparator = new OutputComparator();
const judgeService = new JudgeService(runner, comparator);

const testCases: TestCase[] = [
  {
    id: "test-1",
    stdin: "5\n",
    expectedOutput: "10\n",
    isSample: true,
  },
  {
    id: "test-2",
    stdin: "10\n",
    expectedOutput: "20\n",
    isSample: false,
  },
  {
    id: "test-3",
    stdin: "25\n",
    expectedOutput: "50\n",
    isSample: false,
  },
];

const problem: Problem = {
  id: "two-times",
  title: "Two Times",
  statement: "Read an integer and print twice its value.",
  timeLimitMs: 2000,
  memoryLimitMb: 256,
  testCases,
};

const sourceCode = `
n = int(input())
print(n * 2)
`;

const result = await judgeService.judge(
  "manual-sub",
  {
    language: "python",
    sourceCode,
    stdin: "",
    timeLimitMs: problem.timeLimitMs,
    memoryLimitMb: problem.memoryLimitMb,
  },
  problem.testCases,
);

console.log(result);