import express from 'express';
// import { ProblemController } from './problem.controller.js';
import { asyncHandler } from '../../utils/http.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import * as ctrl from './problem.controller.js'

export const problemRouter = express.Router();

// GET /api/problems?limit=3&cursor=P3
problemRouter.get(
    "/",
    authenticate,
    authorize('USER', 'ADMIN'),
    asyncHandler(ctrl.fetchProblems)
);


// GET /api/problems/two-sum
problemRouter.get(
    "/:slug",
    authenticate,
    authorize('USER', 'ADMIN'),
    asyncHandler(ctrl.getProblemDetailBySlug)
);

export default problemRouter;