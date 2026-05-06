import type { Request, Response } from "express";
import {
  getMatchesByYear,
  getPatches,
  getSeasonSnapshot,
  getTeams,
} from "@/models/queries.js";
import { buildMatchCsv } from "@/utils/csv.js";
import { yearParam } from "@/validators/common.js";

export const seasonsController = {
  byYear: async (req: Request, res: Response) => {
    const { year } = yearParam.parse(req.params);
    res.json(await getSeasonSnapshot(year));
  },

  matches: async (req: Request, res: Response) => {
    const { year } = yearParam.parse(req.params);
    res.json(await getMatchesByYear(year));
  },

  exportCsv: async (req: Request, res: Response) => {
    const { year } = yearParam.parse(req.params);
    const [matches, teams, patches] = await Promise.all([
      getMatchesByYear(year),
      getTeams(),
      getPatches(),
    ]);
    const csv = buildMatchCsv({
      matches,
      teams,
      patches,
      tournamentResolver: (m) => m.leagueId,
      seriesKeyResolver: (m) => m.seriesId ?? null,
    });
    res
      .status(200)
      .set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="season-${year}.csv"`,
        "Cache-Control": "public, s-maxage=3600, max-age=0, stale-while-revalidate=86400",
      })
      .send(csv);
  },
};
