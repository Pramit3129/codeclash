import { PrismaClient } from "@prisma/client";

export class ProblemRepository {
  constructor(
    private readonly prisma: PrismaClient,
  ) {}

  async findById(problemId: string) {
    const problem =
      await this.prisma.problem.findUnique({
        where: {
          id: problemId,
        },

        include: {
          testCases: {
            orderBy: {
              ordinal: "asc",
            },
          },
        },
      });

    if (!problem) {
      throw new Error(
        `Problem not found: ${problemId}`,
      );
    }

    return problem;
  }
}
