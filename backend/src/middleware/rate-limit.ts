import rateLimit, { type Store } from "express-rate-limit";
import { getRedisClient } from "@/services/redis.js";
import { logger } from "@/services/logger.js";

let sharedStore: Store | undefined;

export const initRateLimitStore = async () => {
  const client = await getRedisClient();
  if (!client) {
    logger.warn("rate-limit: redis unavailable, falling back to in-memory store");
    return;
  }
  const { default: RedisStore } = await import("rate-limit-redis");
  sharedStore = new RedisStore({
    sendCommand: (...args: string[]) => client.sendCommand(args) as Promise<string>,
    prefix: "rl:",
  });
  logger.info("rate-limit: redis store ready");
};

type Options = {
  windowMs: number;
  max: number;
  keyGenerator?: (req: import("express").Request) => string;
};

export const createRateLimiter = ({ windowMs, max, keyGenerator }: Options) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store: sharedStore,
    ...(keyGenerator ? { keyGenerator: keyGenerator as never } : {}),
  });
