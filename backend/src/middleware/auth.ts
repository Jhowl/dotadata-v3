import type { NextFunction, Request, Response } from "express";
import { SESSION_COOKIE, verifySessionToken } from "@/services/session.js";

declare module "express-serve-static-core" {
  interface Request {
    user?: { steamid: string };
  }
}

export const parseSession = (req: Request, _res: Response, next: NextFunction) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) {
    const payload = verifySessionToken(token);
    if (payload) req.user = { steamid: payload.sub };
  }
  next();
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
    return;
  }
  next();
};
