import type { Request, Response } from "express";
import { ProblemService } from "./problem.service.js";
import { BadRequestError } from "../../utils/errors.js";
import { fetchProblemsSchema, getProblemDetailSchema } from "./problem.types.js";


export const fetchProblems = async (req: Request, res: Response) => {
    const result = fetchProblemsSchema.safeParse(req.query);

    if (!result.success) {
        throw new BadRequestError(
            "Invalid query parameters",
            {
                details: result.error.flatten().fieldErrors,
            }
        );
    }

    const { limit, cursor, difficulty } = result.data;

    const problemService = new ProblemService();

    const problems = await problemService.fetchProblems(
        limit,
        cursor,
        difficulty
    );

    return res.status(200).json({
        success: true,
        problems,
    });
};

export const getProblemDetailBySlug = async (
    req: Request,
    res: Response
) => {
    const result = getProblemDetailSchema.safeParse(req.params);

    if (!result.success) {
        throw new BadRequestError(
            "Invalid request parameters",
            {
                details: result.error.flatten().fieldErrors,
            }
        );
    }

    const problemService = new ProblemService();

    const problemDetails =
        await problemService.getProblemDetailBySlug(
            result.data.slug
        );

    res.setHeader(
        "Cache-Control",
        "public, max-age=60"
    );

    return res.status(200).json({
        success: true,
        problemDetails,
    });
};
