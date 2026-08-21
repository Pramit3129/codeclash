import { z } from "zod";

// Every byte travels through the BullMQ payload in Redis, so the same cap
// as the submission path applies here.
export const MAX_SOURCE_CODE_BYTES = 64 * 1024;

// Each case holds a sandbox container for its duration.
export const MAX_RUN_TEST_CASES = 10;
export const MAX_TEST_CASE_INPUT_BYTES = 16 * 1024;

const LANGUAGE_ALIASES = {
  python: "python",
  javascript: "javascript",
  js: "javascript",
  java: "java",
  cpp: "cpp",
  "c++": "cpp",
} as const;

// `ordinal` and `isSample` are claims, not facts: RunService re-derives
// sample status from the database (see resolveTestCases).
const runTestCaseSchema = z.object({
  ordinal: z.number().int().min(0).optional(),

  isSample: z.boolean().optional(),

  input: z
    .string()
    .refine(
      (value) =>
        Buffer.byteLength(value, "utf8") <= MAX_TEST_CASE_INPUT_BYTES,
      {
        message: `Test case input must not exceed ${MAX_TEST_CASE_INPUT_BYTES} bytes`,
      },
    )
    .optional(),
});

// Per-case caps still allow 10 x 16 KB through Redis; this bounds the sum.
export const MAX_TOTAL_INPUT_BYTES = 64 * 1024;

export const createRunSchema = z.object({
  problemId: z.string().min(1).max(64),

  language: z
    .enum(
      Object.keys(LANGUAGE_ALIASES) as [
        keyof typeof LANGUAGE_ALIASES,
        ...(keyof typeof LANGUAGE_ALIASES)[],
      ],
    )
    .transform((value) => LANGUAGE_ALIASES[value]),

  sourceCode: z
    .string()
    .min(1)
    .refine(
      (value) => Buffer.byteLength(value, "utf8") <= MAX_SOURCE_CODE_BYTES,
      {
        message: `Source code must not exceed ${MAX_SOURCE_CODE_BYTES} bytes`,
      },
    ),

  // Omitted or empty means "run the problem's sample cases".
  testCases: z
    .array(runTestCaseSchema)
    .max(
      MAX_RUN_TEST_CASES,
      `A run may not contain more than ${MAX_RUN_TEST_CASES} test cases`,
    )
    .refine(
      (cases) =>
        cases.reduce(
          (total, tc) => total + Buffer.byteLength(tc.input ?? "", "utf8"),
          0,
        ) <= MAX_TOTAL_INPUT_BYTES,
      {
        message: `Test case inputs must not exceed ${MAX_TOTAL_INPUT_BYTES} bytes in total`,
      },
    )
    .optional(),
});

export type CreateRunInput = z.infer<typeof createRunSchema>;
export type RunTestCaseInput = z.infer<typeof runTestCaseSchema>;
