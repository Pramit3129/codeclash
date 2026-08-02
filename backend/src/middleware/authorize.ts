import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { UserRole } from "@prisma/client";
import { ForbiddenError, UnauthorizedError } from "../utils/errors.js";

// Role gate. Must run after `authenticate`.
export function authorize(...roles: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      throw new UnauthorizedError("Authentication required");
    }
    if (roles.length > 0 && !roles.includes(req.auth.role)) {
      throw new ForbiddenError("Insufficient permissions");
    }
    next();
  };
}
