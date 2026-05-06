import type { Request, Response } from "express";
import {
  getMatchesByTeam,
  getMatchesByTeamForHandicap,
  getTeamBySlug,
  getTeamPickBanStats,
  getTeamSummaries,
  getTeamSummary,
  getTeams,
  getTeamsByIds,
  getTopPerformersByTeam,
} from "@/models/queries.js";
import { slugParam } from "@/validators/common.js";
import { HttpError } from "@/middleware/error.js";

export const teamsController = {
  list: async (req: Request, res: Response) => {
    const idsRaw = typeof req.query.ids === "string" ? req.query.ids : "";
    if (idsRaw) {
      const ids = idsRaw.split(",").map((s) => s.trim()).filter(Boolean);
      res.json(await getTeamsByIds(ids));
      return;
    }
    res.json(await getTeams());
  },

  summaries: async (_req: Request, res: Response) => {
    res.json(await getTeamSummaries());
  },

  bySlug: async (req: Request, res: Response) => {
    const { slug } = slugParam.parse(req.params);
    const team = await getTeamBySlug(slug);
    if (!team) throw new HttpError(404, "TEAM_NOT_FOUND", "Team not found");
    res.json(team);
  },

  summary: async (req: Request, res: Response) => {
    const { slug } = slugParam.parse(req.params);
    const team = await getTeamBySlug(slug);
    if (!team) throw new HttpError(404, "TEAM_NOT_FOUND", "Team not found");
    res.json(await getTeamSummary(team.id));
  },

  matches: async (req: Request, res: Response) => {
    const { slug } = slugParam.parse(req.params);
    const team = await getTeamBySlug(slug);
    if (!team) throw new HttpError(404, "TEAM_NOT_FOUND", "Team not found");
    res.json(await getMatchesByTeam(team.id));
  },

  handicap: async (req: Request, res: Response) => {
    const { slug } = slugParam.parse(req.params);
    const team = await getTeamBySlug(slug);
    if (!team) throw new HttpError(404, "TEAM_NOT_FOUND", "Team not found");
    res.json(await getMatchesByTeamForHandicap(team.id));
  },

  pickBan: async (req: Request, res: Response) => {
    const { slug } = slugParam.parse(req.params);
    const team = await getTeamBySlug(slug);
    if (!team) throw new HttpError(404, "TEAM_NOT_FOUND", "Team not found");
    res.json(await getTeamPickBanStats(team.id));
  },

  topPerformers: async (req: Request, res: Response) => {
    const { slug } = slugParam.parse(req.params);
    const team = await getTeamBySlug(slug);
    if (!team) throw new HttpError(404, "TEAM_NOT_FOUND", "Team not found");
    res.json(await getTopPerformersByTeam(team.id));
  },
};
