import express from "express";

import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { asyncHandler } from "../../utils/http.js";

import {
  createSubmission,
  getSubmission,
} from "./submission.controller.js";

export const submissionRouter =
  express.Router();

submissionRouter.post(
  "/",
  authenticate,
  authorize("USER", "ADMIN"),
  asyncHandler(createSubmission),
);

submissionRouter.get(
  "/:id",
  authenticate,
  authorize("USER", "ADMIN"),
  asyncHandler(getSubmission),
);

export default submissionRouter;
