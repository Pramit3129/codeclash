// import { DockerRunner } from "../docker.runner";

// const runner = new DockerRunner();

// const result = await runner.run({
//   language: "python",

// //   sourceCode: `
// // chunks = []

// // while True:
// //     chunks.append(bytearray(10 * 1024 * 1024))
// // `,
// // sourceCode: `
// // while True:
// //     pass
// // `,
//   sourceCode: `
// n = int(input())
// print(10 / 0)
// `,

//   stdin: "5\n",

//   timeLimitMs: 20000,
//   memoryLimitMb: 256,
// });

// console.log(result);
