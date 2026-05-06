import type { NextFunction, Request, Response } from "express";

export type AsyncHandler = (req: Request, res: Response, next: NextFunction) => unknown | Promise<unknown>;

export const wrap = (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
