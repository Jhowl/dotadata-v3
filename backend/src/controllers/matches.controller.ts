import type { Request, Response } from "express";
import { getMatchesByIds, getMatchesByLeagueIds } from "@/models/queries.js";

const splitIds = (raw: unknown): string[] => {
  if (typeof raw !== "string" || !raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
};

export const matchesController = {
  query: async (req: Request, res: Response) => {
    const ids = splitIds(req.query.ids);
    const leagueIds = splitIds(req.query.leagueIds);

    if (ids.length) {
      res.json(await getMatchesByIds(ids));
      return;
    }
    if (leagueIds.length) {
      res.json(await getMatchesByLeagueIds(leagueIds));
      return;
    }
    res.json([]);
  },
};
