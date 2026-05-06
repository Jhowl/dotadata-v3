import type { Request, Response } from "express";
import { z } from "zod";
import { COMMENT_BODY_MAX, createComment, listComments, softDeleteComment } from "@/models/comments.js";
import { HttpError } from "@/middleware/error.js";

const listSchema = z.object({
  entityType: z.enum(["league", "team"]),
  entityId: z.string().min(1),
});

const createSchema = z.object({
  entityType: z.enum(["league", "team"]),
  entityId: z.string().min(1),
  body: z.string().min(1).max(COMMENT_BODY_MAX),
});

export const commentsController = {
  list: async (req: Request, res: Response) => {
    const { entityType, entityId } = listSchema.parse(req.query);
    res.json(await listComments(entityType, entityId));
  },

  create: async (req: Request, res: Response) => {
    if (!req.user) throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
    const { entityType, entityId, body } = createSchema.parse(req.body);
    const result = await createComment(req.user.steamid, entityType, entityId, body);
    if (!result.ok) throw new HttpError(400, "CREATE_FAILED", result.error);
    res.status(201).json(result.comment);
  },

  remove: async (req: Request, res: Response) => {
    if (!req.user) throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
    const id = String(req.params.id ?? "");
    const result = await softDeleteComment(id, req.user.steamid);
    if (!result.ok) throw new HttpError(400, "DELETE_FAILED", result.error ?? "Delete failed");
    res.status(204).end();
  },
};
