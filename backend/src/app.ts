import express from "express";
import helmet from "helmet";
import cors from "cors";

import { rootRouter } from "./routes/root.route.ts";
import { healthRouter } from "./routes/health.route.ts";
import { readyRouter } from "./routes/ready.route.ts";

const app = express();

app.use(helmet());
app.use(cors());

app.use(express.json());

app.use("/", rootRouter);
app.use("/healthz", healthRouter);
app.use("/health", healthRouter);
app.use("/readyz", readyRouter);

export { app };

