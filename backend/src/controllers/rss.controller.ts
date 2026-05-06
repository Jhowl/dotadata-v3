import type { Request, Response } from "express";
import { getBlogPosts } from "@/models/blog.js";
import { env } from "@/config/env.js";

const escapeXml = (value: string) =>
  value.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

export const rssController = {
  feed: async (_req: Request, res: Response) => {
    const posts = await getBlogPosts();
    const origin = env.FRONTEND_ORIGIN.replace(/\/$/, "");
    const items = posts
      .map(
        (p) => `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${origin}/blog/${escapeXml(p.slug)}</link>
      <guid>${origin}/blog/${escapeXml(p.slug)}</guid>
      <description>${escapeXml(p.summary)}</description>
      <pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>
    </item>`,
      )
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>DotaData Blog</title>
    <link>${origin}/blog</link>
    <description>Latest posts from DotaData</description>
${items}
  </channel>
</rss>`;

    res
      .status(200)
      .set({
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
      })
      .send(xml);
  },
};
