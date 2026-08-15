import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../../src/lib/prisma.js";

export class ProblemRepository {
  constructor(
    private readonly prisma?: PrismaClient,
  ) {}

  private get db(): PrismaClient {
    return this.prisma || defaultPrisma;
  }

  async findById(problemId: string) {
    const problem =
      await this.db.problem.findUnique({

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
