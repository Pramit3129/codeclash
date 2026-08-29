import { z } from "zod";

/**
 * Hard cap on submitted source, enforced before the job payload is
 * built. The global express.json 1mb limit is far too permissive here:
 * every byte is copied into the BullMQ payload in Redis and stored
 * permanently in PostgreSQL. 64 KB is far beyond any real solution.
 */
export const MAX_SOURCE_CODE_BYTES = 64 * 1024;

/**
 * Aliases accepted from clients, normalised to the canonical
 * SupportedLanguage keys used by LANGUAGE_CONFIG.
 *
 * Previously "js" and "c++" were accepted here but had no entry in
 * LANGUAGE_CONFIG, so those submissions were queued and then failed
 * inside the worker, stranding the row with verdict = null.
 */
const LANGUAGE_ALIASES = {
  python: "python",
  javascript: "javascript",
  js: "javascript",
  java: "java",
  cpp: "cpp",
  "c++": "cpp",
} as const;

export const createSubmissionSchema = z.object({
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
      (value) =>
        Buffer.byteLength(value, "utf8") <= MAX_SOURCE_CODE_BYTES,
      {
        message: `Source code must not exceed ${MAX_SOURCE_CODE_BYTES} bytes`,
      },
    ),
});

export const submissionIdSchema = z.object({
  id: z.string().min(1).max(64),
});

export type CreateSubmissionInput = z.infer<
  typeof createSubmissionSchema
>;

export const problemIdSchema = z.object({
  problemId: z.string().min(1).max(64),
});

export const getSubmissionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

