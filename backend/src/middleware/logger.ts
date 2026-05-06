import pinoHttpModule from "pino-http";
import { logger } from "@/services/logger.js";

const pinoHttp = pinoHttpModule as unknown as typeof pinoHttpModule.default;

export const httpLogger = pinoHttp({
  logger,
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
});
