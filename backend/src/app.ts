import express from "express";
import helmet from "helmet";
import cors from "cors";

import { healthRouter } from "./routes/health.route.ts";

const app = express();

app.use(helmet());
app.use(cors());

app.use(express.json());

app.use("/healthz", healthRouter);
app.use("/health", healthRouter);

export { app };
