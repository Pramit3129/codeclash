import { z } from "zod";

export const createSubmissionSchema = z.object({
  problemId: z.string().min(1),
  language: z.enum([
    "python",
    "javascript",
    "js",
    "java",
    "cpp",
    "c++",
  ]),
  sourceCode: z.string().min(1),
});

export const submissionIdSchema = z.object({
  id: z.string().min(1),
});

export type CreateSubmissionInput =
  z.infer<typeof createSubmissionSchema>;
