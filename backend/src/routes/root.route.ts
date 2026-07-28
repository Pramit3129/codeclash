import { Router } from "express";
import type { Request, Response } from "express";

export const rootRouter = Router();

rootRouter.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    name: "CodeClash API",
    version: "0.1.0",
    status: "running",
  });
});
