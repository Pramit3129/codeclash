import { prisma } from "../../lib/prisma.js";
import { NotFoundError } from "../../utils/errors.js";
import { problemListSelect, problemDetailSelect, type problemSelect, type FetchProblemsResponse, type ProblemDetailType, type problemDetailsResponse } from "./problem.types.js";

export class ProblemService {
    async fetchProblems(
        limit: number,
        cursor?: string,
        difficulty?: "EASY" | "MEDIUM" | "HARD",
    ): Promise<FetchProblemsResponse> {
        const problems: problemSelect[] = await prisma.problem.findMany({
            where:
                difficulty
                    ? {
                        difficulty,
                    }
                    : undefined,
            orderBy: {
                createdAt: "asc",
            },
            take: limit + 1,
            ...(cursor
                ? {
                    cursor: {
                        id: cursor,
                    },
                    skip: 1,
                }
                : {}),
            select: problemListSelect,
        });

        const hasMore = problems.length > limit;
        const items = problems.slice(0, limit);
        return {
            items,
            nextCursor: hasMore
                ? (problems[limit - 1]!.id)
                : null,
        };
    }

    async getProblemDetailBySlug(slug: string): Promise<problemDetailsResponse> {
        const problem: ProblemDetailType | null = await prisma.problem.findUnique({
            where: {
                slug,
            },
            select: problemDetailSelect,
        });
        if (!problem) {
            throw new NotFoundError("Problem not found")
        }
        return problem;
    }
}