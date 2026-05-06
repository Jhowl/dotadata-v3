import { createApp } from "@/app.js";
import { env } from "@/config/env.js";
import { logger } from "@/services/logger.js";
import { initRateLimitStore } from "@/middleware/rate-limit.js";

await initRateLimitStore();

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "api listening");
});

const shutdown = (signal: string) => {
  logger.info({ signal }, "shutting down");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
