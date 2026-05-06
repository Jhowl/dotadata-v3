import type { Request, Response } from "express";
import { getHeroes, getPlayersByIds } from "@/models/queries.js";
import { idsQuery } from "@/validators/common.js";

export const heroesController = {
  list: async (_req: Request, res: Response) => {
    res.json(await getHeroes());
  },
};

export const playersController = {
  byIds: async (req: Request, res: Response) => {
    const { ids } = idsQuery.parse(req.query);
    const map = await getPlayersByIds(ids);
    res.json(Object.fromEntries(map));
  },
};
