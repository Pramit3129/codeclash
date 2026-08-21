import express from "express";

import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { asyncHandler } from "../../utils/http.js";

import { createRun } from "./run.controller.js";

export const runRouter = express.Router();

// A run spawns a sandbox like a submission does, but Run is pressed far
// more often than Submit — hence its own, looser per-user throttle.
const runRateLimit = rateLimit({
  windowSec: 60,
  max: 30,
  prefix: "runs",
  keyFn: (req) => req.auth?.userId ?? "anonymous",
});

runRouter.post(
  "/",
  authenticate,
  authorize("USER", "ADMIN"),
  runRateLimit,
  asyncHandler(createRun),
);

export default runRouter;
