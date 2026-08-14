import { prisma } from "../src/lib/prisma.js";
import { specs } from "./seed/problem.ts";

async function main() {
  for (const spec of specs) {

    // ----------------------------------------
    // 1. Combine samples and hidden inputs
    // ----------------------------------------

    const inputs = [
      ...spec.samples.map((input) => ({
        input,
        isSample: true,
      })),

      ...spec.hidden.map((input) => ({
        input,
        isSample: false,
      })),
    ];


    // ----------------------------------------
    // 2. Convert inputs into TestCase objects
    // ----------------------------------------

    const testCases = inputs.map((testCase, ordinal) => ({
      ordinal,

      // Normalize input to always end with newline
      input: testCase.input.endsWith("\n")
        ? testCase.input
        : testCase.input + "\n",

      // THIS is where solve() is actually used
      expectedOutput:
        spec.solve(testCase.input).trimEnd() + "\n",

      isSample: testCase.isSample,
    }));


    // ----------------------------------------
    // 3. Insert/update the Problem
    // ----------------------------------------

    await prisma.problem.upsert({
      where: {
        slug: spec.slug,
      },

      create: {
        slug: spec.slug,
        title: spec.title,
        statementMd: spec.statementMd,
        constraintsMd: spec.constraintsMd,
        difficulty: spec.difficulty,
        timeLimitMs: spec.timeLimitMs,
        memoryLimitMb: spec.memoryLimitMb,
        starterCode: spec.starterCode,

        testCases: {
          create: testCases,
        },
      },

      update: {
        title: spec.title,
        statementMd: spec.statementMd,
        constraintsMd: spec.constraintsMd,
        difficulty: spec.difficulty,
        timeLimitMs: spec.timeLimitMs,
        memoryLimitMb: spec.memoryLimitMb,
        starterCode: spec.starterCode,

        // Remove old test cases and recreate them
        testCases: {
          deleteMany: {},

          create: testCases,
        },
      },
    });

    console.log(`Seeded: ${spec.slug}`);
  }
}


main()
  .catch((error) => {
    console.error(error);

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });