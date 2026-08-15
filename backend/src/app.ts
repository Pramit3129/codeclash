import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";

import { env } from "./config/env.js";
import { rootRouter } from "./routes/root.route.js";
import { healthRouter } from "./routes/health.route.js";
import { readyRouter } from "./routes/ready.route.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { problemRouter } from "./modules/problems/problem.route.ts";
import { submissionRouter } from "./modules/submissions/submission.route.ts";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.ts";

const app = express();

// Behind a load balancer / reverse proxy in production: trust it so secure
// cookies and req.ip (rate limiting) work correctly.
app.set("trust proxy", 1);

app.use(helmet());

// Allow the configured frontend origin(s) with credentials so the httpOnly
// refresh cookie is accepted cross-origin. Origins are normalized (trailing
// slashes stripped) so "https://app.example.com/" matches the browser's
// "https://app.example.com".
const allowedOrigins = (env.CORS_ORIGINS ?? env.FRONTEND_URL)
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser clients (no Origin) and configured origins.
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/+$/, "");
      if (allowedOrigins.includes(normalized)) {
        return callback(null, true);
      }
      console.log("CORS blocked origin:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/", rootRouter);
app.use("/healthz", healthRouter);
app.use("/health", healthRouter);
app.use("/readyz", readyRouter);
app.use("/api/auth", authRouter);
app.use("/api/problems", problemRouter);
app.use("/api/submissions", submissionRouter);


// 404 + centralized error handling (must be last).
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
