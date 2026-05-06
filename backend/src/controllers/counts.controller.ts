import type { Request, Response } from "express";
import { getCounts } from "@/models/queries.js";

export const countsController = {
  get: async (_req: Request, res: Response) => {
    res.json(await getCounts());
  },
};
