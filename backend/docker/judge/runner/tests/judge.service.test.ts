import { DockerRunner } from "../docker.runner.ts";
import { OutputComparator } from "../output.comparator.ts";
import { JudgeService } from "../judge.service.ts";
import type { TestCase } from "../test-case.type.ts";
import type { Problem } from "../problem.type.ts";

const runner = new DockerRunner();

const comparator =
  new OutputComparator();

const judgeService =
  new JudgeService(
    runner,
    comparator,
  );


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

// const result = await judge.judge(
//   {
//     language: "python",

// //     sourceCode: `
// // n = int(input())
// // print(n * 2)
// // `,
// //     sourceCode: `
// // while True:
// //     pass
// // `,
// //     sourceCode: `
// // chunks = []

// // while True:
// //     chunks.append(bytearray(10 * 1024 * 1024))
// // `,
// //     sourceCode: `
// // n = int(input())
// // print(10 / 0)
// // `,
// sourceCode: `
// while True:
//   print("A" * 100000)
// `,

//     stdin: "",

//     timeLimitMs: 2000,
//     memoryLimitMb: 256,
//   },

//   [
//     {
//       id: "test-1",
//       stdin: "5\n",
//       expectedOutput: "10\n",
//     },
//     // {
//     //   id: "test-2",
//     //   stdin: "10\n",
//     //   expectedOutput: "20\n",
//     // },
//     {
//       id: "test-2",
//       stdin: "10\n",
//       expectedOutput: "999\n",
//     },
//     // {
//     //   id: "test-2",
//     //   stdin: "10\n",
//     //   expectedOutput: "999\n",
//     // },
//     {
//       id: "test-3",
//       stdin: "25\n",
//       expectedOutput: "50\n",
//     },
//   ],
// );
const result = await judgeService.judge(
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