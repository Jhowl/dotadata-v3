import type { Request, Response } from "express";
import {
  getMatchesByPatch,
  getPatchBySlug,
  getPatchesWithCounts,
  getTopPerformersByPatch,
} from "@/models/queries.js";
import { patchParam } from "@/validators/common.js";
import { HttpError } from "@/middleware/error.js";

export const patchesController = {
  list: async (_req: Request, res: Response) => {
    res.json(await getPatchesWithCounts());
  },

  byPatch: async (req: Request, res: Response) => {
    const { patch } = patchParam.parse(req.params);
    const result = await getPatchBySlug(patch);
    if (!result) throw new HttpError(404, "PATCH_NOT_FOUND", "Patch not found");
    res.json(result);
  },

  matches: async (req: Request, res: Response) => {
    const { patch } = patchParam.parse(req.params);
    const result = await getPatchBySlug(patch);
    if (!result) throw new HttpError(404, "PATCH_NOT_FOUND", "Patch not found");
    res.json(await getMatchesByPatch(result.id));
  },

  topPerformers: async (req: Request, res: Response) => {
    const { patch } = patchParam.parse(req.params);
    const result = await getPatchBySlug(patch);
    if (!result) throw new HttpError(404, "PATCH_NOT_FOUND", "Patch not found");
    res.json(await getTopPerformersByPatch(result.id));
  },
};
