import type { Request, Response } from "express";
import {
  getAllMatchesByLeague,
  getLeagueBySlug,
  getLeagueChampion,
  getLeagueLastWinners,
  getLeaguePickBanAnalysis,
  getLeaguePickBanStats,
  getLeagueSummaries,
  getLeagueSummary,
  getLeagueTeamParticipation,
  getLeagues,
  getMatchesByLeague,
  getPatches,
  getTeams,
  getTopPerformersByLeague,
} from "@/models/queries.js";
import { buildMatchCsv } from "@/utils/csv.js";
import { slugParam } from "@/validators/common.js";
import { HttpError } from "@/middleware/error.js";

export const leaguesController = {
  list: async (_req: Request, res: Response) => {
    res.json(await getLeagues());
  },

  summaries: async (_req: Request, res: Response) => {
    res.json(await getLeagueSummaries());
  },

  lastWinners: async (_req: Request, res: Response) => {
    res.json(await getLeagueLastWinners());
  },

  bySlug: async (req: Request, res: Response) => {
    const { slug } = slugParam.parse(req.params);
    const league = await getLeagueBySlug(slug);
    if (!league) throw new HttpError(404, "LEAGUE_NOT_FOUND", "League not found");
    res.json(league);
  },

  summary: async (req: Request, res: Response) => {
    const { slug } = slugParam.parse(req.params);
    const league = await getLeagueBySlug(slug);
    if (!league) throw new HttpError(404, "LEAGUE_NOT_FOUND", "League not found");
    const summary = await getLeagueSummary(league.id);
    res.json(summary);
  },

  matches: async (req: Request, res: Response) => {
    const { slug } = slugParam.parse(req.params);
    const all = req.query.all === "1" || req.query.all === "true";
    const league = await getLeagueBySlug(slug);
    if (!league) throw new HttpError(404, "LEAGUE_NOT_FOUND", "League not found");
    const matches = all
      ? await getAllMatchesByLeague(league.id)
      : await getMatchesByLeague(league.id);
    res.json(matches);
  },

  champion: async (req: Request, res: Response) => {
    const { slug } = slugParam.parse(req.params);
    const league = await getLeagueBySlug(slug);
    if (!league) throw new HttpError(404, "LEAGUE_NOT_FOUND", "League not found");
    res.json(await getLeagueChampion(league.id));
  },

  participation: async (req: Request, res: Response) => {
    const { slug } = slugParam.parse(req.params);
    const league = await getLeagueBySlug(slug);
    if (!league) throw new HttpError(404, "LEAGUE_NOT_FOUND", "League not found");
    res.json(await getLeagueTeamParticipation(league.id));
  },

  pickBan: async (req: Request, res: Response) => {
    const { slug } = slugParam.parse(req.params);
    const league = await getLeagueBySlug(slug);
    if (!league) throw new HttpError(404, "LEAGUE_NOT_FOUND", "League not found");
    res.json(await getLeaguePickBanStats(league.id));
  },

  pickBanAnalysis: async (req: Request, res: Response) => {
    const { slug } = slugParam.parse(req.params);
    const league = await getLeagueBySlug(slug);
    if (!league) throw new HttpError(404, "LEAGUE_NOT_FOUND", "League not found");
    res.json(await getLeaguePickBanAnalysis(league.id));
  },

  topPerformers: async (req: Request, res: Response) => {
    const { slug } = slugParam.parse(req.params);
    const league = await getLeagueBySlug(slug);
    if (!league) throw new HttpError(404, "LEAGUE_NOT_FOUND", "League not found");
    res.json(await getTopPerformersByLeague(league.id));
  },

  exportCsv: async (req: Request, res: Response) => {
    const { slug } = slugParam.parse(req.params);
    const league = await getLeagueBySlug(slug);
    if (!league) throw new HttpError(404, "LEAGUE_NOT_FOUND", "League not found");
    const [matches, teams, patches] = await Promise.all([
      getAllMatchesByLeague(league.id),
      getTeams(),
      getPatches(),
    ]);
    const csv = buildMatchCsv({
      matches,
      teams,
      patches,
      tournamentResolver: () => league.name,
      seriesKeyResolver: (m) => m.seriesId ?? null,
    });
    res
      .status(200)
      .set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${league.slug}.csv"`,
        "Cache-Control": "public, s-maxage=3600, max-age=0, stale-while-revalidate=86400",
      })
      .send(csv);
  },
};
