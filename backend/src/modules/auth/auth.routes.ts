import { Router } from "express";
import * as ctrl from "./auth.controller.js";
import { asyncHandler } from "../../utils/http.js";
import { authenticate, optionalAuthenticate } from "../../middleware/authenticate.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { authorize } from "../../middleware/authorize.js";

export const authRouter = Router();

// Throttle credential endpoints per-IP to blunt brute force / abuse.
const loginLimiter = rateLimit({
  prefix: "auth-login",
  windowSec: 15 * 60,
  max: 20,
});
const registerLimiter = rateLimit({
  prefix: "auth-register",
  windowSec: 60 * 60,
  max: 10,
});
const refreshLimiter = rateLimit({
  prefix: "auth-refresh",
  windowSec: 60,
  max: 60,
});
const oauthLimiter = rateLimit({
  prefix: "auth-oauth",
  windowSec: 5 * 60,
  max: 30,
});

const wsTicketLimiter = rateLimit({
  prefix: "auth-ws-ticket",
  windowSec: 60,
  max: 5,
});

// ---- Local ----
authRouter.post("/register", registerLimiter, asyncHandler(ctrl.register));
authRouter.post("/login", loginLimiter, asyncHandler(ctrl.login));

// ---- Session lifecycle ----
authRouter.post("/refresh", refreshLimiter, asyncHandler(ctrl.refresh));
authRouter.post("/logout", asyncHandler(ctrl.logout));
authRouter.post("/logout-all", authenticate, asyncHandler(ctrl.logoutAll));

// ---- Profile / account management (authenticated) ----
authRouter.get("/me", authenticate, asyncHandler(ctrl.me));
authRouter.get("/sessions", authenticate, asyncHandler(ctrl.listSessions));
authRouter.delete(
  "/sessions/:id",
  authenticate,
  asyncHandler(ctrl.revokeSession),
);
authRouter.post("/password", authenticate, asyncHandler(ctrl.setPassword));
authRouter.delete("/account", authenticate, asyncHandler(ctrl.deleteAccount));
authRouter.delete(
  "/accounts/:provider",
  authenticate,
  asyncHandler(ctrl.unlink),
);

// ---- Google OAuth ----
// optionalAuthenticate so a logged-in user starting the flow enters "link" mode.
authRouter.get(
  "/google",
  oauthLimiter,
  optionalAuthenticate,
  asyncHandler(ctrl.googleStart),
);
authRouter.get("/google/callback", asyncHandler(ctrl.googleCallback));

// ---- GitHub OAuth ----
authRouter.get(
  "/github",
  oauthLimiter,
  optionalAuthenticate,
  asyncHandler(ctrl.githubStart),
);
authRouter.get("/github/callback", asyncHandler(ctrl.githubCallback));

// ----- ws-ticket routes -----
authRouter.post("/issue-ws-ticket", wsTicketLimiter, authenticate, authorize('USER'), asyncHandler(ctrl.issueWsTicket));

