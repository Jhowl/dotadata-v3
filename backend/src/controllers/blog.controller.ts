import type { Request, Response } from "express";
import { z } from "zod";
import { getBlogPostBySlug, getBlogPosts } from "@/models/blog.js";
import { supabaseAdmin } from "@/services/supabase.js";
import { env } from "@/config/env.js";
import { slugParam } from "@/validators/common.js";
import { HttpError } from "@/middleware/error.js";

const upsertSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  content_markdown: z.string().min(1),
  is_published: z.boolean().default(true),
  published_at: z.string().datetime().optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
  seo_title: z.string().optional(),
  seo_description: z.string().optional(),
});

export const blogController = {
  list: async (_req: Request, res: Response) => {
    res.json(await getBlogPosts());
  },

  bySlug: async (req: Request, res: Response) => {
    const { slug } = slugParam.parse(req.params);
    const post = await getBlogPostBySlug(slug);
    if (!post) throw new HttpError(404, "POST_NOT_FOUND", "Post not found");
    res.json(post);
  },

  upsert: async (req: Request, res: Response) => {
    const auth = req.header("authorization") ?? "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
    if (!env.BLOG_ADMIN_TOKEN || token !== env.BLOG_ADMIN_TOKEN) {
      throw new HttpError(401, "UNAUTHORIZED", "Invalid admin token");
    }
    if (!supabaseAdmin) throw new HttpError(503, "DB_UNAVAILABLE", "Database not configured");

    const payload = upsertSchema.parse(req.body);
    const { error } = await supabaseAdmin.from("blog_posts").upsert(payload, { onConflict: "slug" });
    if (error) throw new HttpError(500, "DB_ERROR", error.message);
    res.status(204).end();
  },
};
