import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "@/config/env.js";
import { httpLogger } from "@/middleware/logger.js";
import { corsMiddleware } from "@/middleware/cors.js";
import { parseSession } from "@/middleware/auth.js";
import { errorHandler, notFound } from "@/middleware/error.js";
import { apiRouter } from "@/routes/index.js";

export const createApp = () => {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(corsMiddleware);
  app.use(httpLogger);
  app.use(cookieParser(env.AUTH_SECRET));
  app.use(express.json({ limit: "64kb" }));
  app.use(parseSession);

  app.use("/api/v1", apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
