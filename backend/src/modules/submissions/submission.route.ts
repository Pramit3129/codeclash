import express from "express";

import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { asyncHandler } from "../../utils/http.js";

import {
  createSubmission,
  getSubmission,
  streamSubmission,
  getSubmissions
} from "./submission.controller.js";

export const submissionRouter = express.Router();

/*
 * Every accepted submission spawns a Docker container and occupies the
 * single-slot judge queue, so this endpoint is far more expensive than a
 * normal write and needs its own throttle.
 *
 * Keyed by user rather than IP: the cost is per-account, and IP keying
 * would let one user behind a shared NAT throttle everyone else.
 */
const submissionRateLimit = rateLimit({
  windowSec: 60,
  max: 20,
  prefix: "submissions",
  keyFn: (req) => req.auth?.userId ?? "anonymous",
});

submissionRouter.post(
  "/",
  authenticate,
  authorize("USER", "ADMIN"),
  submissionRateLimit,
  asyncHandler(createSubmission),
);

submissionRouter.get(
  "/:id/judgeStream",
  authenticate,
  authorize("USER", "ADMIN"),
  asyncHandler(streamSubmission),
);

submissionRouter.get(
  "/:id",
  authenticate,
  authorize("USER", "ADMIN"),
  asyncHandler(getSubmission),
);
submissionRouter.get("/getSubmissions/:problemId", authenticate, authorize("USER", "ADMIN"), asyncHandler(getSubmissions));

export default submissionRouter;
