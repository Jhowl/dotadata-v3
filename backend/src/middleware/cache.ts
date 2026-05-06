import type { NextFunction, Request, Response } from "express";
import { getRedisJson, setRedisJson } from "@/services/redis.js";

export const ONE_HOUR = 60 * 60;
export const SIX_HOURS = 60 * 60 * 6;
export const ONE_DAY = 60 * 60 * 24;

const buildKey = (req: Request) => `route:${req.method}:${req.originalUrl}`;

export const cacheRoute =
  (ttlSeconds: number) => async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET") return next();
    const key = buildKey(req);

    const cached = await getRedisJson<{ status: number; body: unknown }>(key, ttlSeconds);
    if (cached.found) {
      res.status(cached.value.status).json(cached.value.body);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        void setRedisJson(key, { status: res.statusCode, body }, ttlSeconds);
      }
      return originalJson(body);
    };
    next();
  };
